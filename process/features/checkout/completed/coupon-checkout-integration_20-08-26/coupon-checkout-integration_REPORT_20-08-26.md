---
phase: coupon-checkout-integration
date: 2026-08-20
status: COMPLETE_WITH_GAPS
feature: checkout
plan: process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_PLAN_20-08-26.md
---

# EXECUTE Report — Coupon Checkout Integration

## What Was Done

All 19 Implementation Checklist items (Groups A–F) implemented.

**A. Coupon lookup + validation service**
1. `features/admin-coupons/services/admin-coupons.repository.ts` — added read-only `findByCode(code)` (`.eq("code").maybeSingle()`, reuses `COUPON_SELECT` + `toAdminCoupon`); exported on the repo object. No existing method touched.
2. `features/checkout/constants.ts` — added `COUPON_MESSAGES` (3 strings verbatim from the DB trigger + 2 new app-layer-only), `couponBelowMinOrderMessage(minOrderValue)`, and `COUPON_TRIGGER_MESSAGES` (the 3 trigger texts, used for insert-error mapping). Single shared source for preview-time and submit-time copy.
3. `features/checkout/services/coupon-validation.service.ts` (NEW) — `validateAndComputeDiscount({ code, subtotal })`. Rejects: not-found / inactive / expired / usage-exhausted / below `min_order_value`. Discount: `FIXED` → `discount`; `PERCENTAGE` → `subtotal * discount/100`; both clamped `Math.max(0, Math.min(raw, subtotal))` then rounded.

**B. Preview endpoint**
4. `features/checkout/schemas/coupon-preview.schema.ts` (NEW) — request `{ couponCode (1–50, trimmed), subtotal (>=0) }` + `CouponPreviewResponse` union.
5. `src/middlewares/rate-limit.middleware.ts` — new `couponPreviewLimiter` (20 / 15min / IP, code `TOO_MANY_COUPON_CHECKS`), sized like `emailStatusLimiter`. Explicitly NOT `globalLimiter`.
6. `app/api/checkout/coupon/validate/route.ts` (NEW) — guard order exactly per plan: `const limited = await couponPreviewLimiter(req); if (limited) return limited;` → `authenticate(req)` → Zod parse → service. `AppError` w/ 400 → `200 { valid:false, reason }`; other errors rethrow.

**C. Order-creation wiring**
7. `features/checkout/schemas/checkout.schema.ts` — `couponCode: z.string().trim().min(1).max(50).optional()`; `checkoutFormSchema` now omits `lines` + `couponCode`.
8. `features/checkout/services/order.repository.ts` — `create()` takes a 5th optional `coupon` param; sets `coupon_id: couponId ?? null`; extends `OrderShippingAddressSnapshot` with optional `couponCode`/`couponDiscountAmount` (existing JSONB column, no migration); on `orderError`, matches against `COUPON_TRIGGER_MESSAGES` → `BadRequestError` with the trigger's verbatim text, else the pre-existing generic wrap.
9. `features/checkout/services/checkout.service.ts` — fresh re-validation before `resolvePayment` using `cartSummary.subtotal` (PRE-discount); `combinedDiscount = cartSummary.discountAmount + couponDiscountAmount` (additive); `merchandiseTotal = cartSummary.total - couponDiscountAmount`; passes coupon fields through to `create()`; `summary` gains `couponCode`/`couponDiscountAmount`. **No change to the existing payOS-cancel catch block** — reused as-is.
10. `features/checkout/types/index.ts` — `OrderMoneySummary` gains both optional coupon fields.

**D. Email + order history**
11. `features/checkout/services/order-email.service.ts` — separate `Mã giảm giá` row (code `escapeHtml`'d, amount formatted), rendered only when `summary.couponCode` present; the generic `Giảm giá` total row is unchanged.
12. `features/account/types/index.ts` — `AccountOrder` gains both optional coupon fields.
13. `features/account/services/account-order.service.ts` — `OrderListRow.shipping_address` typed with the two new fields; `toAccountOrder()` maps them (JSONB already in the existing SELECT — no column added).
14. `components/account/AccountOrderList.tsx` — conditional coupon line on the existing compact card.

**E. Checkout page UI**
15. `components/checkout/CheckoutOrderSummary.tsx` — new optional `couponCode`/`couponDiscountAmount` props; second `Mã giảm giá: {CODE}` line rendered below the existing `Giảm giá (x%)` line (both visible together); total reflects the coupon; "Tiết kiệm" line now sums both discounts.
16. `components/checkout/CheckoutCouponField.tsx` (NEW) — input + "Áp dụng"; applied chip with a dedicated `×` remove control; rejected state shows the server's `reason` inline. Enter key applies without submitting the order form.
17. `lib/useCheckoutCoupon.ts` (NEW) — `{ coupon, apply(code, subtotal), remove() }` over `apiRequest`, states idle/checking/applied/rejected.
18. `components/checkout/CheckoutForm.tsx` — wires the hook: sends `couponCode` only when status is `applied`; passes preview props to `CheckoutOrderSummary`; renders `CheckoutCouponField` immediately before `CheckoutSubmitBlock`.

**F. Regression** — 19. `admin-coupons.repository.test.ts` run unmodified, green.

## What Was Skipped or Deferred

- Nothing from the checklist. The stale-preview-after-cart-change case remains the plan's documented accepted UX gap (server-side fresh re-validation is the backstop).

## Test Gate Outcomes

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (clean, no output) |
| `npx vitest run` — 7 scoped files (coupon-validation, coupon/validate route, checkout.schema, order.repository, checkout.service, order-email.service, admin-coupons.repository) | PASS — 7 files, 86 tests |
| Full `npx vitest run` | 61/62 files pass, 435 tests pass, 0 failing tests. 1 pre-existing suite-collection failure: `lib/useAddresses.test.tsx` (`@supabase/ssr` needs env vars) — identical to the pre-edit baseline |
| `npm run lint` | 537 repo-wide pre-existing problems (bulk in `src/components/charts/**`). Of my 18 touched files, 17 lint clean; `CheckoutForm.tsx` has 2 `react-hooks/refs` errors on the pre-existing `placingOrderRef` — verified pre-existing by stashing my diff and re-linting (same 2 errors) |

Baseline comparison: pre-edit baseline had 2 failing files (`app/api/staff/uploads/route.test.ts` ×3 tests, `lib/useAddresses.test.tsx`). The uploads failures were fixed concurrently by Track A. **No new failures introduced.**

New tests added: 11 (coupon-validation) + 7 (preview route) + 4 (checkout.schema) + 6 (order.repository coupon cases) + 7 (checkout.service coupon cases) + 3 (order-email coupon cases) = 38.

## Plan Deviations

1. **Test-first order (Mode A red-first)** — for Group A the implementation was written immediately before its test file rather than confirming a literal red stub first. Within-blast-radius process deviation; all named gates are green and each AC has a real proving test.
2. **`route.ts` catch predicate** — plan implied `error instanceof BadRequestError`; that check failed under Vitest module resolution when the service was mocked. Used `error instanceof AppError && error.statusCode === 400` instead. Same semantics, test-provable.
3. **Limiter choice** — added a new `couponPreviewLimiter` (20/15min) rather than reusing `sessionLimiter`. Plan explicitly delegated this choice to EXECUTE; `globalLimiter` correctly avoided.
4. **`CheckoutOrderSummary` total display** — the pre-existing `shippingFee === null` branch showed `merchandiseTotal`; collapsed to always show `orderTotal` (which equals the merchandise total when `shippingFee` is null) so the coupon reduction is reflected in both branches. No behavior change when no coupon is applied.

Untouched as instructed: `features/cart/pricing.ts`, `VOUCHER_TIERS`, the `validate_and_apply_coupon()` trigger, all migrations, `admin-users`/`admin-contact`/`app/api/staff/uploads/route.ts`, `features/admin-coupons/services/*.service.ts` tests.

**Concurrent-track note:** re-read `features/admin-coupons/schemas/admin-coupons.schema.ts` at implementation time — the `.max(100)` PERCENTAGE cap **has landed** (as `percentageCapRefine`). Not duplicated. Our clamp is independent of it either way, as the plan required.

## Test Infra Gaps Found

- `lib/useAddresses.test.tsx` cannot collect without Supabase env vars set. Pre-existing, out of this plan's blast radius. Not fixed.

## Closeout Packet

1. **Selected plan path:** `process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_PLAN_20-08-26.md` (now archived — see below).
2. **Closeout classification:** Ready for UPDATE PROCESS archival.
3. **What was finished:** all 19 checklist items (Groups A-F); 5 new files, 13 modified; coupon lookup/validation service, preview endpoint (auth + rate-limited), fresh re-validation at order-creation time, additive discount stacking, confirmation-email coupon line, account order-history coupon display, checkout-page coupon field/hook/summary wiring.
4. **Verified vs unverified:** all 13 Fully-Automated verification rows independently re-confirmed green by a separate EVL vc-tester spawn (`npx tsc --noEmit` clean; scoped vitest 86/86; full vitest 435/435 across 61/62 files, 1 pre-existing unrelated failure; lint no new errors). Two Agent-Probe UI rows (checkout-page two-discount-line walkthrough, `/account` order-history coupon display) remain **CODE DONE, NOT VERIFIED** — by explicit user decision this session, not because of any defect. Tracked in `process/features/checkout/backlog/coupon-checkout-agent-probe-followups_20-08-26.md`.
4b. **Validate-contract:** present, inline in plan, `Gate: PASS`, dated 20-08-26, `generated-by: outer-pvl`.
5. **Cleanup done:** plan file updated with `## UPDATE PROCESS Closeout` section; backlog note written for the 2 outstanding Agent-Probe items; `process/context/payment/all-payment.md` updated with the coupon-checkout integration; task folder archived to `process/features/checkout/completed/`. **Still needed:** none for this plan — the 2 Agent-Probe walkthroughs and the risk-evidence-pack are tracked as accepted backlog, not "still needed" cleanup.
6. **Single best next valid state:** `ENTER UPDATE PROCESS MODE` (this session) — completed. No immediate next phase; the follow-up Agent-Probe walkthroughs live in the backlog note above for whenever `/checkout` or `/account` order history is next touched.
7. **Commit-checkpoint recommendation:** Execution commit recommended before the process commit — the 23 implementation/test files are well-tested and independently EVL-confirmed green; this UPDATE PROCESS session's own changes (plan closeout section, backlog note, context doc update, archival move) belong in a separate, later process-only commit.
8. **Regression status:** N/A — this is a single-plan feature, not a phase program; AC12 (existing `admin-coupons.repository.test.ts` suite, unmodified) is the only regression gate and it passed as part of the full 435/435 vitest run.
9. **SPEC achievement:** AC1–AC9, AC11, AC12 — **met** (Fully-Automated, independently re-confirmed). AC10 (DB-trigger race-condition guarantee) — **met at the app-error-mapping layer only** (Agent-Probe, by the plan's own accepted design — the trigger itself predates this feature and is not re-proven under real concurrency by any plan). No AC is unmet; the two UI Agent-Probe walkthroughs are proving-strategy gaps (tracked in backlog), not SPEC criterion failures.

**High-risk evidence pack:** NOT produced (billing-adjacent class) — explicit, informed user trade-off this session, not a silently-dropped requirement.

**Drift signal score:** HIGH (4 signals — (a) 23 files touched in EXECUTE +2, (d) task folder archived + backlog NOTE written +1, (e) none — no validate-contract deviation; plus this UPDATE PROCESS session itself touches `process/context/payment/all-payment.md` +1). **Strongly recommend UPDATE PROCESS -- harness/protocol files touched.** (context doc, not harness code, but the phrase is the required verbatim threshold string for this band.)

## Forward Preview

- **Test Infra Found:** Vitest-only, mocked-Supabase pattern reused throughout; `// @vitest-environment node` docblock required for any file importing a `server-only` chain.
- **Blast Radius Changes:** none beyond the plan's 18 files + the 5 new files listed above.
- **Commands to Stay Green:** `npx tsc --noEmit`; `npx vitest run features/checkout app/api/checkout features/admin-coupons`; `npm run lint`.
- **Dependency Changes:** none.
