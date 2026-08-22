# Payment & Checkout Domain -- Production-Readiness Review

Date: 19-08-26
Scope: features/checkout/**, features/cart/services|pricing, lib/payos.ts, app/api/checkout/**, app/checkout/**, lib/useCartStore.ts, lib/useCartDrawer.ts, supabase/migrations/*payos_bank_transfer*.sql, supabase/migrations/*reserve_stock_on_order_create*.sql
Reviewer: vc-code-reviewer (production-readiness / high-risk billing pass)

## Scope

- Files read (full domain, not a diff): lib/payos.ts, features/checkout/schemas/payos.schema.ts (+ test), features/checkout/schemas/checkout.schema.ts, features/checkout/services/checkout.service.ts (+ test), features/checkout/services/payos.service.ts (+ test), features/checkout/services/order.repository.ts (+ test), features/checkout/services/order-email.service.ts, app/api/checkout/route.ts, app/api/checkout/payos/webhook/route.ts, app/api/checkout/payos/status/route.ts, app/api/checkout/payos/retry/route.ts, app/checkout/success/page.tsx, features/cart/pricing.ts, features/cart/services/cart.repository.ts, lib/useCartStore.ts, lib/useCartDrawer.ts, supabase/migrations/20260722010000_payos_bank_transfer.sql, supabase/migrations/20260724000000_reserve_stock_on_order_create.sql, plus supporting reads (init_schema.sql CHECK/RLS clauses, product-catalog.server.ts, app/checkout/page.tsx).
- LOC: approximately 1400 across the above (checkout domain is small and well-contained).
- Focus: full domain audit, not tied to a diff.
- Scout findings: see "Edge Cases Found by Scout" below -- the scout pass was folded into the systematic read since the domain is small enough to read in full rather than sample.

## Overall Assessment

This is a well-built payment domain for a solo-developer project -- noticeably more careful than typical: signature verification is genuinely enforced (not bypassed), amount is always server-computed (client never sends a price), stock oversell is closed at the DB layer via an atomic trigger plus CHECK constraint (not just an app-level race-prone check), webhook processing is idempotent, and retry uses compare-and-swap to avoid clobbering concurrent retries. The nullable-PayOS-client pattern is correctly and exclusively gated behind one requirePayosClient() call site.

The one Critical gap is a real money-safety issue: when orderRepository.create() fails after a PayOS payment link has already been created (order-code collision, or losing the stock race at DB-insert time), the code never cancels the orphaned PayOS payment link. That live, unlinked payment link can still be paid -- and if it is, the webhook will silently no-op ("order not found") with no order, no refund trail, and no alert.

## Critical Issues

### C1 -- Orphaned PayOS payment link when orderRepository.create() fails after payment link creation (money-loss / lost-order risk)

**File:** features/checkout/services/checkout.service.ts:132-159 (calls resolvePayment() then orderRepository.create() with no try/catch), combined with features/checkout/services/order.repository.ts:140-200 (order/order_items insert).

**Flow:**
1. resolvePayment() calls payosService.createPaymentLink() -- a real, live, payable PayOS checkout link is created (lines 62-70 of checkout.service.ts).
2. orderRepository.create() is then called with no try/catch around it.
3. Two concrete ways this can fail after the link already exists:
   - orderError on the orders insert (e.g. order_code unique-index collision on idx_orders_order_code -- see order-code generation gap H1 below).
   - itemError on the order_items insert -- this is the documented, expected stock-race-lost path (order.repository.ts:186-199, and the migration's own comment about the trigger being "the real guard"). When this happens, order.repository.ts deletes the just-inserted orders row (line 187) but has no reference to payosService to cancel the link.
4. checkout.service.ts has no catch block around the orderRepository.create() call to invoke payosService.cancelPaymentLink(payosOrderCode, ...) on failure -- unlike the analogous, already-handled case in retryPayment() (lines 277-287, which correctly cancels on CAS-loss).
5. Result: a valid, live PayOS checkout URL exists that is tied to payosOrderCode but no orders row exists with that payos_order_code. If a customer pays through it (e.g. they had the tab open, or captured the URL from a slow network retry), payosService.handleWebhook() calls orderRepository.markPaidByPayosOrderCode(), which returns null, and the event is logged only as a warning ("order not found... idempotent no-op") -- money is taken with zero order/refund trail, discoverable only by manually grepping logs.

**Why this matters at the stated risk tier:** this is exactly the billing/destructive-write high-risk class this review was asked to treat as HIGH-RISK. The existing test suite (checkout.service.test.ts line 174-182) explicitly tests and asserts the opposite direction ("payOS fails -> orderRepository.create is NOT called") but there is no test for "orderRepository.create fails after payOS succeeded -> cancelPaymentLink is called." That asymmetry is a strong signal this failure direction was never designed for.

**Fix:** wrap the orderRepository.create() call in checkout.service.ts in a try/catch (for paymentMethod !== "cod" only, since COD never creates a link) that calls payosService.cancelPaymentLink(payosOrderCode, "order_persist_failed") before rethrowing. This mirrors the pattern already correctly used in retryPayment().

    let row;
    try {
      row = await orderRepository.create(userId, input, moneyArg, metaArg);
    } catch (err) {
      if (payosOrderCode) {
        await payosService.cancelPaymentLink(payosOrderCode, "order_persist_failed");
      }
      throw err;
    }

Severity: Critical -- real-money loss with no recovery path, silent (log-only) failure mode.

## High Priority

### H1 -- order_code collision is not specifically handled and would trigger C1

**File:** features/checkout/services/order.repository.ts:78-84 (buildOrderCode), supabase/migrations/20260721000000_seed_product_order_code_cart_variant.sql:16 (unique index idx_orders_order_code).

buildOrderCode() is NT-{yyyymmdd}-{4-char base36 random suffix} -- 36^4, about 1.68M combinations per day. Collision probability is low at current traffic but not zero, and there is no retry-with-new-code logic on unique-violation -- orderError from the orders insert is thrown as a bare Error (order.repository.ts:165), which becomes a generic 500 to the client. Combined with C1, a collision here also orphans a just-created PayOS link. Recommend: catch the unique-violation Postgres error code (23505) on order_code specifically and retry buildOrderCode() once or twice before giving up (mirrors how the 23514 stock-check violation is already special-cased two lines below it).

### H2 -- Webhook route has no rate limiting / replay-volume protection

**File:** app/api/checkout/payos/webhook/route.ts.

Correctly unauthenticated (server-to-server, signature-verified) per the code comment, but there is no rateLimiter wrapping this route the way src/middlewares/rate-limit.middleware.ts is used elsewhere. Since client.webhooks.verify() runs local HMAC verification (not a network round-trip) the cost per request is small, but an attacker can still hammer the endpoint to consume CPU/log volume, or use it to probe timing side-channels on the HMAC comparison (unless @payos/node's verify() uses a constant-time compare internally -- not verifiable from this codebase, worth confirming against the SDK). Low-cost defense-in-depth: apply the same rateLimiter used on other public routes, keyed by IP.

## Medium Priority

### M1 -- Price/stock cache staleness window on refreshProductCatalogServer() failure

**File:** features/product/services/product-catalog.server.ts:18-35, consumed in checkout.service.ts:99.

If the live Supabase read fails (network blip), refreshProductCatalogServer() catches and returns null, and checkoutService.createOrder() silently falls back to whatever productService's module-level in-memory cache last held (comment: "Preserve last valid data"). This is not a client-trust-boundary issue (price is still never client-supplied), but it does mean a price change made by staff moments before a DB hiccup could be transiently invisible to checkout, and in a single Node process serving all requests, this cache is process-global and can be momentarily stale for concurrent requests. Low risk given VND price changes are infrequent and manually staff-driven, but worth a comment/TODO acknowledging the staleness window, or an alert on repeated refreshProductCatalogServer() failures.

### M2 -- payos.service.ts webhook handler doesn't map non-success PayOS codes to any persisted state

**File:** features/checkout/services/payos.service.ts:118-126 -- already flagged in-code with a TODO. When verified.code !== "00", the event is only logged (serviceLogger.warn) and never written to payment_status = 'FAILED' or similar. This means a customer whose payment fails at PayOS (declined card / cancelled QR) sees no state change on the order -- it stays UNPAID indefinitely with no distinguishable "attempted and failed" signal for staff/admin views. Not a security bug, but a completeness gap worth scheduling -- the code author is already aware (own TODO).

## Low Priority

### L1 -- Date.now()-based payosOrderCode millisecond-collision comment is technically imprecise but practically fine

payos.service.ts:46-49 -- comment says a same-millisecond collision "fails safe" via PayOS returning "order already exists." This is plausible but unverified against the actual PayOS API contract (not checked in this review -- would need vc-docs-seeker against PayOS's API docs to confirm behavior on duplicate orderCode). Low priority since the failure mode described (customer re-submits) is graceful either way.

### L2 -- lib/useCartDrawer.ts / lib/useCartStore.ts are UI-state only, no correctness issues found

Both are SWR-as-store patterns with revalidate: false local mutation -- correctly scoped, no network calls, no security surface. No findings.

## Edge Cases Found by Scout

Folded into the systematic read (domain is small, about 15 files) rather than run as a separate parallel scout pass:

- Concurrent retry + webhook race: retryPayment()'s CAS (updatePayosLink) and the webhook's idempotent "neq payment_status 'PAID'" update correctly avoid a lost-update between "customer clicks retry" and "old payment link's webhook fires late." Verified via reading both code paths together -- no gap found here.
- Duplicate webhook delivery: markPaidByPayosOrderCode's single-round-trip UPDATE ... WHERE payos_order_code = X AND payment_status != 'PAID' is correctly atomic and idempotent -- confirmed no double-processing risk (no risk of double-firing any "order paid" side effect, since none currently exists beyond the status flip).
- Two concurrent checkouts near last unit of stock: DB trigger (reduce_stock_on_order_item_insert) plus CHECK (stock >= 0) on products correctly makes the actual stock decrement atomic under Postgres row locking -- the app-level pre-check in checkout.service.ts (requestedUnits > availableStock) is UX-only (fast-fail with a friendly message) and is not the real guarantee; the real guarantee is the DB trigger. This is correctly designed -- but the failure path when the DB-level check wins the race is exactly C1 (orphaned payment link), not an oversell.
- IDOR on /status and /retry: both routes scope order lookup through findByOrderCodeForUser(orderCode, userId) -- confirmed a user cannot poll or retry another user's order. No gap found.
- payos null-client silent no-op risk: confirmed payos (the nullable client from lib/payos.ts) has exactly one import site (payos.service.ts), and every method there routes through requirePayosClient(), which throws InternalServerError loudly rather than silently no-op-ing. No other file imports the raw client. No gap found -- the nullable-client pattern is correctly enforced here.
- Client-side amount tampering: confirmed createOrderRequestSchema (the only client-to-server checkout payload) contains no price/amount/total field -- server always computes total from buildCartSummary() plus live product price. app/checkout/page.tsx and its components were grep-checked for any amount/price/total field being sent -- none found. No gap found.

## Positive Observations

- Webhook signature verification is real: client.webhooks.verify(rawBody) is called on the unparsed original body, with an explicit code comment warning against using the Zod-parsed result (Zod would strip unknown fields, breaking HMAC recomputation). This is a subtle correctness point that's easy to get wrong and the author clearly understood it.
- Stock reservation is atomic at the DB layer (trigger plus CHECK constraint), not just app-level -- this closes the classic TOCTOU oversell bug that this class of code commonly has.
- order-email.service.ts confirmed non-blocking: fired via after() in both checkout.service.ts:211-213 and mirrored in order.repository.ts:204-217 for the audit-log write; sendOrderConfirmation never throws (explicit try/catch plus explicit error field check on the Resend SDK response, since Resend resolves rather than throws on API errors) -- correctly cannot affect order/payment correctness or the response returned to the customer.
- retryPayment()'s compare-and-swap (updatePayosLink) is a genuinely well-designed defense against two-tab-double-retry races, with a real test covering the CAS-loss path (cancels the just-created link on loss).
- Repo-wide "nullable client, guard at call site" convention is followed correctly and exclusively in this domain (see Edge Cases above).

## Recommended Actions

1. [Critical, C1] Wrap orderRepository.create() in checkout.service.ts with a try/catch that cancels the just-created PayOS payment link on any failure, for non-COD payment methods. Add a regression test mirroring the existing "payOS fails -> create is not called" test but for the reverse direction.
2. [High, H1] Add unique-violation (23505 on order_code) detection plus a bounded retry (regenerate buildOrderCode(), retry insert) in order.repository.ts, following the same pattern already used for the 23514 stock-check violation.
3. [High, H2] Apply the existing rateLimiter middleware to the PayOS webhook route, keyed by IP, as defense-in-depth against volumetric abuse.
4. [Medium, M2] Decide and implement a payment_status (or new) value for non-success PayOS webhook codes instead of log-only -- resolve the existing in-code TODO.
5. [Medium, M1] Add a log/alert on repeated refreshProductCatalogServer() failures so stale-cache checkout windows are observable, not silent.
6. [Low, L1] Confirm PayOS's actual behavior on duplicate numeric orderCode (via vc-docs-seeker against PayOS API docs) to validate the millisecond-collision "fail-safe" comment, rather than leaving it as an assumption.

## Metrics

- Type Coverage: not separately measured this pass (no tsc --noEmit run as part of this read-only review; recommend running it as part of any EXECUTE pass on the C1 fix).
- Test Coverage: strong for this domain -- checkout.service.test.ts (18 cases), payos.service.test.ts (9 cases), order.repository.test.ts (covers the 23514 stock-race path), payos.schema.test.ts (4 cases). Notably missing: a test for C1 (orderRepository.create failing after payOS link creation should trigger cancelPaymentLink).
- Linting Issues: not run this pass (read-only review, no build/lint invoked).

## High-Risk Evidence Gate

This domain qualifies as HIGH-RISK per the repo's own risk classification (billing/payment plus destructive-writes class -- order creation, stock decrement, payment-state mutation). Per the vc-code-reviewer High-Risk Evidence Gate:

- Checked for risk-gate.json, context-snippets.json, verification.json in any reports/harness folder relevant to this review: none found. Searched process/general-plans/, process/features/, and any harness/ subdirectory repo-wide -- no matches.
- review-decision.json: not produced as a separate file -- this is a first-pass standalone audit (not an EXECUTE handoff with an existing plan/validate-contract), so there is no plan-level gate this review is closing. The decision is instead recorded inline in this report: STOP/FIX-FIRST on C1 before this domain should be considered production-ready for real-money traffic; H1/H2 should be scheduled before the next release; M1/M2/L1 are backlog-appropriate.
- adversarial-validation.json: not produced. This review did perform adversarial-style probing manually (webhook replay/duplicate-delivery reasoning, IDOR checks on status/retry, race-condition tracing through the DB trigger, orphaned-payment-link tracing) but did not run a dedicated abuse-case agent pass. If this repo adopts a formal EXECUTE handoff for the C1 fix, a dedicated adversarial-validation pass on the webhook and retry surface is recommended at that time.
- Recommendation: since this is a standalone audit and not a PLAN -> VALIDATE -> EXECUTE flow, the natural next step is to route C1 (and optionally H1) through RESEARCH -> PLAN -> VALIDATE -> EXECUTE as a proper fix, at which point the validate-contract and full high-risk evidence pack (vc-risk-evidence-pack) should be generated for real.

## Unresolved Questions

- Does @payos/node's webhooks.verify() use a constant-time comparison for the HMAC check, or a standard string-equality comparison? Not verifiable from this codebase (it's inside the third-party SDK) -- would need vc-docs-seeker or a source read of node_modules/@payos/node to confirm. Low priority (timing side-channel on webhook auth is a low-severity theoretical concern here, not a demonstrated exploit).
- Does PayOS's API actually reject a duplicate numeric orderCode with a client-safe error (as the code comment for Date.now() collisions assumes), or could it silently associate the payment with the wrong existing orderCode? Unverified against PayOS's real API contract -- see L1.
