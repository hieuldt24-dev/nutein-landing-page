---
name: plan:priority-bug-fixes
description: "Fix 5 independently verified bugs from two code-review passes (medium-scope resend-email review + user's high-scope full-diff review): oversell guard NaN-bypass, cart price fallback bundle-discount mismatch, order-confirmation email XSS, voucher tier ordering, Cloudinary-guard env-var leak"
date: 19-08-26
feature: N/A
---

# PLAN — Fix 5 Priority Bugs (Two Code-Review Passes)

**Date**: 19-08-26
**Status**: Ready for VALIDATE
**Complexity**: COMPLEX

## Overview

Context loaded from `process/context/all-context.md` (root context router — present on disk, contrary
to the task brief's assumption it was missing; no Bootstrap Guard gap to note), and the relevant
group routers: `process/context/payment/all-payment.md` (checkout/order flow), `process/context/tests/all-tests.md`
(Vitest-only test runner, co-located `*.test.ts(x)` convention), `process/context/email/all-email.md`
(Resend transactional email). RESEARCH/INNOVATE are effectively complete — all 5 findings below are
pre-verified with exact file:line locations from two independent code-review passes; this PLAN
converts them into an executable checklist. Per the user's explicit scope choice ("fix the most
severe bugs first"), the plan orders sections by severity: oversell guard (billing-adjacent) → XSS
(security) → cart price fallback (billing-adjacent, latent) → voucher tier ordering (display) →
Cloudinary env-var leak (info-disclosure, smallest/lowest-risk, last).

This is a single COMPLEX plan (not a phase program) — 5 independently-scoped, non-overlapping items
across cart/checkout/admin-uploads, similar in structure to the sibling
`full-codebase-review_PLAN_19-08-26.md` (read for format reference). No item depends on another;
a single agent-team/parallel-execute pass is possible, but sequential-per-section is also safe.

**Explicit non-overlap with the sibling active plan**
(`process/general-plans/active/full-codebase-review_19-08-26/full-codebase-review_PLAN_19-08-26.md`,
Gate: PASS, F1-F7): that plan's Section 2 (F6) already fixed `app/api/staff/uploads/route.ts`'s
**catch block** (confirmed live on disk: two-arg `InternalServerError(generic-message, details)`
already applied at the try/catch around `cloudinary.uploader.upload`). This plan's Item 5 touches a
**different, still-unfixed call site in the SAME FILE** — the `isCloudinaryConfigured` guard clause a
few lines above the catch block, which still does a single-arg `InternalServerError` call leaking
literal env var names. No other item in this plan touches any F1-F7 file. Do not re-open or duplicate
any F1-F7 checklist item.

## Goals

Close all 5 verified bugs with minimal, scoped diffs; add/extend Vitest coverage per repo convention
so each fix is provably correct and regression-protected.

## Scope

In scope: exactly the 5 items below.
Out of scope: the sibling plan's F1-F7 items (see non-overlap note above); any other findings from
either code-review pass not explicitly listed here (the user chose "fix the most severe bugs first"
— broader backlog items are deferred, not silently expanded into this plan).

## Execution Order

Severity-first, per user's explicit scope choice:
Item 1 (oversell/billing) → Item 3 (XSS/security) → Item 2 (price display/billing-adjacent, latent)
→ Item 4 (voucher display) → Item 5 (info-disclosure, mechanical 3-line fix)

Items are mutually independent (different files, no shared blast radius) — this order is a
recommendation for reviewability, not a hard dependency; EXECUTE may parallelize if desired.

---

## Implementation Checklist

### Item 1 — Stock check silently bypassed when `stock` is null/NaN

**Touchpoints:** `features/checkout/services/checkout.service.ts` (confirmed current lines: the
`stockResult = await refreshProductCatalogServer()` call at line ~99, and the `availableStock`
ternary at lines ~113-116, inside `createOrder()`).

**Confirmed current code (read live, 19-08-26):**
```ts
const stockResult = await refreshProductCatalogServer();
...
const requestedUnits = totalRequestedUnits(cartSummary.lines);
const availableStock = stockResult
  ? stockResult.stock
  : await orderRepository.getAvailableStock();
if (requestedUnits > availableStock) {
  throw new BadRequestError(...)
}
```

**Root cause:** `stockResult` is a truthy object (`{ stock: number }`) even when `stock` itself is
`NaN` (from `Number(row.stock)` on a null/non-numeric DB column upstream in
`refreshProductCatalogServer()`). The ternary only tests object-truthiness, not value-validity, so
the `getAvailableStock()` fallback never fires for a NaN stock, and `requestedUnits > NaN` is always
`false` — oversell guard is defeated.

**Fix:**
1. In `createOrder()`, replace the truthiness-only ternary with an explicit validity check: treat
   `stockResult` as usable ONLY when `stockResult` exists AND `Number.isFinite(stockResult.stock)`.
   Otherwise fall back to `orderRepository.getAvailableStock()` (same fallback already used for the
   null-`stockResult` case — no new fallback path, just widen the condition that triggers it).
   Suggested shape (illustrative, not literal-must-copy — confirm exact variable names against live
   file before editing):
   ```ts
   const availableStock =
     stockResult && Number.isFinite(stockResult.stock)
       ? stockResult.stock
       : await orderRepository.getAvailableStock();
   ```
2. Do not change `refreshProductCatalogServer()` itself or the upstream `Number(row.stock)`
   conversion — this fix is scoped to `checkout.service.ts`'s consumption of the result, per the task
   brief's exact framing ("Fix must ensure a NaN/invalid stock value triggers the same fallback/error
   path as a null `stockResult`"). If a deeper root-cause fix at the DB/catalog layer is desired later,
   that is a separate follow-up, not part of this item.
3. Confirm `orderRepository.getAvailableStock()`'s existing throw-on-DB-error behavior is unchanged
   and still reachable via this widened condition (read the method before editing to confirm no
   signature change needed).

**Test gate (Item 1):**
```
npx vitest run features/checkout/services/checkout.service.test.ts
```
New test cases (add to the existing `describe` block covering `createOrder`'s stock-check behavior —
do not create a new file):
(a) `refreshProductCatalogServer()` mocked to resolve `{ stock: NaN }` (simulating a null/non-numeric
DB `stock` column) → assert `orderRepository.getAvailableStock()` IS called and its return value is
what the oversell comparison actually uses (i.e. an order that would exceed the real stock is
rejected, not silently allowed through);
(b) same NaN-stock scenario but `getAvailableStock()` itself throws (simulating a real DB error) →
assert the error propagates (mirrors today's null-`stockResult` + DB-error behavior — no regression);
(c) confirm the existing "valid numeric stock" happy-path test(s) still pass unmodified (no regression
on the primary fast-path that avoids the extra `getAvailableStock()` round-trip).

---

### Item 3 — XSS / HTML injection risk in order confirmation email

**Touchpoints:** `features/checkout/services/order-email.service.ts` (`renderOrderConfirmationHtml`,
confirmed current lines ~10-32).

**Confirmed current code (read live, 19-08-26):** buyer/address fields interpolated directly, no
escaping:
```ts
<td>${order.buyer.fullName} · ${order.buyer.phone}</td>
<td>${order.address.street}, ${order.address.ward}, ${order.address.province}</td>
```
(plus `order.orderCode`, `order.buyer.email` is not interpolated into HTML — used only as the `to:`
field — but `fullName`, `phone`, `street`, `ward`, `province` are all customer-controlled free text
interpolated raw into HTML.)

**Confirmed: no existing HTML-escape helper found in the repo** (searched for `escapeHtml`,
`escape-html`, `sanitize*` across the codebase — the only `sanitize*` hits are the sibling plan's
NOT-YET-BUILT `lib/sanitize-blog-html.ts` proposal for blog content, which is a different, heavier
allowlist-based HTML *sanitizer* (permits some tags), not a plain-text *escaper*. This item needs the
simpler primitive — escape `&<>"'` — not the blog allowlist sanitizer. Do not import or depend on the
sibling plan's `sanitize-html` dependency; that dependency does not exist yet on this branch and this
item does not need it.

**Fix:**
1. Add a small local escape helper directly in `order-email.service.ts` (no new file, no new
   dependency — this is a 5-character-class escape, not general HTML sanitization):
   ```ts
   function escapeHtml(value: string): string {
     return value
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#39;");
   }
   ```
   (Order of replacements matters — `&` first, or later replacements would double-escape the
   entities just inserted.)
2. In `renderOrderConfirmationHtml`, wrap every customer-supplied string field with `escapeHtml(...)`
   at the point of interpolation: `order.buyer.fullName`, `order.buyer.phone`, `order.address.street`,
   `order.address.ward`, `order.address.province`. Do NOT wrap `order.orderCode` (server-generated,
   not user input — confirm via `buildOrderCode()` in `order.repository.ts` before excluding it; if
   research shows it is not purely server-generated, escape it too, but current understanding is it is
   safe). Do NOT wrap already-safe computed values (`formatCurrencyVnd(...)` output, `paymentLabel`/
   `shippingLabel` which are resolved from a fixed constants lookup, not raw user input).
3. Leave the rest of the template (structure, labels, `formatCurrencyVnd` calls) unchanged.

**Test gate (Item 3):**
```
npx vitest run features/checkout/services/order-email.service.test.ts
```
New test case (add to existing describe block, do not create a new file — this file already covers
`sendOrderConfirmation`): construct an `order` fixture with `buyer.fullName` (or `address.street`)
containing a payload like `</td></tr><tr><td>Fake` and a second payload like
`<img src=x onerror=alert(1)>`; call `renderOrderConfirmationHtml` (export it for testability if not
already exported, or test indirectly via `sendOrderConfirmation`'s mocked `resend.emails.send` call
capturing the `html` argument) and assert the resulting HTML string does NOT contain a raw unescaped
`<img` or unescaped `</td></tr><tr><td>` sequence from the input — assert instead the escaped
entities (`&lt;img`, `&lt;/td&gt;...`) are present.

---

### Item 2 — `CartLineItem` price fallback ignores bundle discount

**Touchpoints:** `components/shared/CartLineItem.tsx` (confirmed current lines: `lineSubtotal?: number`
prop at line ~11, fallback usage `formatCurrencyVnd(lineSubtotal ?? product.price * quantity)` at
line ~65). `components/shared/CartDrawer.tsx` (confirmed only current caller, line ~199 — already
passes `lineSubtotal={line.lineSubtotal}` explicitly).

**Decision (per task brief's stated preference, confirmed safe by checking the only call site):**
Make `lineSubtotal` a **required** prop. `CartDrawer.tsx` (the only current caller) already supplies
it unconditionally, so this is a compile-time-safe, zero-runtime-behavior-change fix that closes the
unsafe public contract for any future caller (e.g. a planned checkout-page reuse per
`docs/checkout-page-implementation-plan.md`, which also references `CartLineItem`).

**Fix:**
1. In `CartLineItem.tsx`, change the `CartLineItemProps` interface: `lineSubtotal?: number` →
   `lineSubtotal: number` (drop the `?`).
2. Change the render usage: `formatCurrencyVnd(lineSubtotal ?? product.price * quantity)` →
   `formatCurrencyVnd(lineSubtotal)` (drop the naive-multiply fallback entirely — it is now
   unreachable/disallowed by the type, so delete rather than leave dead code).
3. Do NOT touch `CartDrawer.tsx` — it already passes `lineSubtotal` explicitly, so this is a
   type-only tightening with no call-site change required. Run a TypeScript check (see gate below) to
   confirm no other caller breaks.
4. If `docs/checkout-page-implementation-plan.md` describes a planned second caller for
   `CartLineItem`, do NOT implement that caller here (out of scope) — just confirm via a repo-wide
   grep for `<CartLineItem` that `CartDrawer.tsx` is genuinely the only current usage before making
   the prop required, so this change cannot silently break an already-existing caller.

**Test gate (Item 2):**
```
npx tsc --noEmit
npx vitest run components/shared/CartLineItem.test.tsx
```
This repo has no existing `CartLineItem.test.tsx` — create it as a new co-located file (matches repo
convention: co-located `*.test.tsx`, see `AuthModal.test.tsx`/`TargetAudienceSection.test.tsx` in the
same directory for the existing component-test pattern/mocking style to follow). New test cases:
(a) renders `formatCurrencyVnd(lineSubtotal)` verbatim for a `quantity > 1` case where
`lineSubtotal !== product.price * quantity` (proves the bundle-discounted value is used, not the
naive multiply — this is the regression-proof case for the bug); (b) `npx tsc --noEmit` passing is
itself evidence AC for the required-prop contract change (a caller omitting `lineSubtotal` must now
fail to compile — this is proven by the type change itself, not by a runtime test; no test can
directly assert a compile error in Vitest, so the `tsc --noEmit` gate is the proving mechanism for
this half of the fix).

---

### Item 4 — Voucher tier progress bar can show wrong state due to unenforced ordering

**Touchpoints:** `features/cart/pricing.ts` (`buildProductVoucherTiers`, confirmed current lines
~163-174), `features/cart/constants.ts` (`VOUCHER_TIERS`, confirmed current lines ~46-51 — dead
default parameter value, not reachable at runtime).

**Confirmed current code:**
```ts
function buildProductVoucherTiers(): VoucherTier[] {
  const detail = productService.getProductDetail();
  return detail.variants.map((variant) => { ... } satisfies VoucherTier);
}
```
No sort step — relies on `detail.variants` array order matching ascending `thresholdVnd`, which is an
unenforced invariant once tiers are staff-editable product variants (unlike the old static
`VOUCHER_TIERS` constant, which was hand-ordered by construction).

**Fix:**
1. In `buildProductVoucherTiers()`, sort the mapped array by `thresholdVnd` ascending before
   returning: `.sort((a, b) => a.thresholdVnd - b.thresholdVnd)` appended to the existing `.map(...)`
   chain (or as a separate `.sort()` call on the mapped result — either is fine, keep it inside this
   function so every caller gets the invariant for free without re-deriving it, per the task brief's
   instruction).
2. Do not change `buildTierProgress`, `calculateProgressPercent`, or `CartVoucherProgress.tsx`'s
   `tiers.at(-1)` usage — those already correctly assume ascending order; this fix restores the
   invariant they depend on, rather than working around its absence downstream.
3. **`VOUCHER_TIERS` stale-default cleanup (confirmed via repo-wide grep, 19-08-26): the ONLY
   caller of `getVoucherProgress` is `buildCartSummary` at `pricing.ts` line ~246, which ALWAYS
   passes an explicit `resolvedTiers` argument (`tiers ?? buildProductVoucherTiers()` — never
   `undefined`). `getVoucherProgress`'s `tiers: VoucherTier[] = VOUCHER_TIERS` default parameter is
   therefore genuinely dead code — it can never execute in this codebase today.** Smaller safe change
   chosen (per task brief's "leaning toward removing the stale default... whichever is the smaller
   safe change"): remove the `= VOUCHER_TIERS` default value from `getVoucherProgress`'s signature,
   making `tiers` a required parameter (`tiers: VoucherTier[]`). Do NOT delete the `VOUCHER_TIERS`
   constant itself from `constants.ts` in this pass — it is still exported and could be referenced
   elsewhere (e.g. tests, docs, or a future reset-to-defaults feature); removing the unreachable
   default parameter closes the immediate staleness/confusion risk with a strictly smaller diff than
   also deleting the constant. Confirm via `npx tsc --noEmit` that no caller relies on the omitted
   default (the repo-wide grep already shows none — this is a defensive re-confirmation, not expected
   to surface anything new).

**Test gate (Item 4):**
```
npx vitest run features/cart/pricing.test.ts
npx tsc --noEmit
```
New test cases (add to existing `describe` blocks in `pricing.test.ts`, do not create a new file —
this file already exists and covers pricing logic): (a) construct a product-detail fixture (via the
same mocking approach existing `pricing.test.ts` cases use for `productService.getProductDetail`)
where variants are NOT in ascending price order (e.g. variant array order deliberately reversed vs.
`thresholdVnd`) → assert `buildProductVoucherTiers()`'s returned array IS ascending by
`thresholdVnd` regardless of input variant order; (b) confirm `calculateProgressPercent`/
`buildTierProgress`'s existing ascending-order-assuming tests still pass unmodified (no regression).

---

### Item 5 — Cloudinary "not configured" guard leaks internal env var names to client

**Touchpoints:** `app/api/staff/uploads/route.ts` (confirmed current lines 21-25, the
`isCloudinaryConfigured` guard clause — NOT the catch block at lines ~44-51, which the sibling
`full-codebase-review` plan's F6/Section 2 already fixed and is confirmed live on disk with the
two-arg pattern).

**Confirmed current code (read live, 19-08-26) — the ONLY remaining single-arg call in this file:**
```ts
if (!isCloudinaryConfigured) {
  throw new InternalServerError(
    "Thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET — kiểm tra lại file .env",
  );
}
```

**Fix (mechanical, 3-line, single call site — apply the EXACT same two-arg pattern already used two
lines below in this same file's catch block):**
1. Change the single-arg call to two args: generic client-facing message as arg 1, the current
   literal diagnostic string moved to arg 2 (`details` — `InternalServerError`'s constructor already
   supports `(message, details)` per `src/errors/app.error.ts:38`, no interface change needed):
   ```ts
   if (!isCloudinaryConfigured) {
     throw new InternalServerError(
       "Dịch vụ tải ảnh hiện chưa sẵn sàng — vui lòng thử lại sau.",
       "Thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET — kiểm tra lại file .env",
     );
   }
   ```
   (Generic message text is illustrative — match the tone/style of this file's own catch-block
   generic message, `"Tải ảnh lên thất bại — vui lòng thử lại sau."`, for consistency; do not
   reuse that exact string verbatim since the two errors are semantically different — misconfiguration
   vs. upload failure — pick a distinct generic message that doesn't imply the upload was attempted.)
2. Do not touch the catch block (already fixed by the sibling plan). Do not touch any other file. Do
   not add new logging — this item is scoped identically to how the sibling plan's F6 item was scoped
   (client-message-only change; the diagnostic string already reaches the `details` field, and this
   plan does not extend into a logger-call change the way the sibling plan's item 7a did, since that
   was specific to the catch-block's error class flowing through `error-handler.middleware.ts`'s
   `AppError` branch — the same underlying logging path already exists for this guard clause too,
   because both throw `InternalServerError`, so no separate logging fix is needed here).

**IMPORTANT — VALIDATE-time overlap finding (added at V1/V2, 19-08-26): this guard clause is ALREADY
FIXED on disk.** A separate, concurrently-executing `vc-execute-agent` working the sibling
`full-codebase-review_PLAN_19-08-26.md` plan was additionally instructed (as a natural extension of
that plan's own F6 item, same file/pattern) to close this exact guard-clause gap. Live read of
`app/api/staff/uploads/route.ts` at VALIDATE time (19-08-26) confirms lines 21-28 already use the
two-arg `InternalServerError` pattern, and `app/api/staff/uploads/route.test.ts` already exists with
a covering 4th test case (`"Cloudinary chưa cấu hình -> message generic, không lộ tên biến môi
trường"`) that asserts the response body excludes `CLOUDINARY_CLOUD_NAME`/`API_SECRET`. **Note the
concurrent fix reused the catch block's exact generic message string** (`"Tải ảnh lên thất bại — vui
lòng thử lại sau."`) rather than a semantically-distinct message as this plan's Fix step 1 suggested —
this is a cosmetic deviation from the plan's stated preference, not a correctness problem; AC6 (no env
var names leak) is satisfied either way. **EXECUTE MUST NOT blindly re-apply this diff** — see
Execute-Agent Instructions in the Validate Contract below for the required idempotent pre-check.

**Test gate (Item 5):**
```
npx vitest run app/api/staff/uploads/route.test.ts
```
This repo has no existing `app/api/staff/uploads/route.test.ts` on disk (confirmed 19-08-26 — the
sibling plan's Section 2 also flagged this as new-file work for its own catch-block case; this item
adds one more case to the SAME new file, not a second new file, so if the sibling plan's EXECUTE
already created this file first, ADD this item's case to it rather than re-creating it — check disk
state before writing). New test case: assert that when `isCloudinaryConfigured` is `false` (mock
`@/lib/cloudinary`'s `isCloudinaryConfigured` export), the thrown/response error's client-facing
`message` does NOT contain the literal strings `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, or `.env`, while the `details`/`code` field (per `AppError`'s shape) MAY
still contain them (server-side-only visibility, not asserted absent).

**VALIDATE-time confirmation: this test case already exists** in the live `route.test.ts` (4th `it`
block, described above) and passes the same assertion this plan specifies (no `CLOUDINARY_CLOUD_NAME`/
`API_SECRET` in the response body). EXECUTE should confirm this test is present and green rather than
adding a duplicate case — see Execute-Agent Instructions below.

---

## Public Contracts

- `POST /api/checkout` (via `checkoutService.createOrder`) — no new response shape change; behavior
  change only: an order that previously silently passed the oversell check due to NaN stock will now
  correctly fall back to `getAvailableStock()` and may be rejected with the existing
  `"Sản phẩm hiện đã hết hàng."` / `"Chỉ còn N hũ..."` `BadRequestError` responses (already-existing
  response shapes, just now reachable in a previously-unreachable failure mode).
- Order confirmation email HTML body — buyer/address text is now HTML-escaped before interpolation;
  any legitimately-entered name/address containing `&`, `<`, `>`, `"`, or `'` characters will now
  render as HTML entities in the email body instead of raw characters (correct, expected change — the
  previous raw-character rendering was itself the bug for any input containing those characters, even
  benign ones like `O'Brien` or `Nguyễn & Con`).
- `CartLineItem` component — `lineSubtotal` prop is now REQUIRED (was optional). Any future caller
  that does not pass `lineSubtotal` will fail to compile (`tsc` error), not fail silently at runtime.
  Confirmed zero currently-broken callers (only `CartDrawer.tsx`, already compliant).
- Voucher tier ordering — `buildProductVoucherTiers()`'s returned array order may now differ from
  `detail.variants`' raw array order (now always ascending by `thresholdVnd`, regardless of input
  order). Any code relying on tier array position matching `detail.variants` position (none found in
  this repo via search) would be affected — confirmed only `CartVoucherProgress.tsx` and
  `pricing.ts`'s own downstream functions consume this array, both already assume ascending order.
- `getVoucherProgress(subtotal, tiers)` — `tiers` parameter is now REQUIRED (was optional with a
  dead default). Confirmed zero external callers rely on the omitted-argument form.
- `POST /api/staff/uploads` — client-facing error message text changes for the
  Cloudinary-not-configured case (was: literal env var names; now: generic Vietnamese message). Any
  client code asserting on the literal previous message text would break — grep confirms no such
  assertion exists in this repo today (only the sibling plan's catch-block message was previously
  changed, and it used a different fixed string already).

## Touchpoints

Summary by domain:
- Checkout/billing: `features/checkout/services/checkout.service.ts` (Item 1)
- Email/security: `features/checkout/services/order-email.service.ts` (Item 3)
- Cart UI: `components/shared/CartLineItem.tsx` (Item 2)
- Cart pricing/voucher: `features/cart/pricing.ts` (Item 4)
- Admin uploads: `app/api/staff/uploads/route.ts` (Item 5)

## Blast Radius

5 files modified, 0 new source files, 0 new dependencies, 0 new routes, 0 schema/migration changes.
2 new test files likely created (`components/shared/CartLineItem.test.tsx` — confirmed does not exist;
`app/api/staff/uploads/route.test.ts` — confirmed does not exist, may already be created by the
sibling plan's EXECUTE by the time this plan runs — check disk state first, do not duplicate).

**Risk class:** Item 1 (oversell/stock check) and Item 2 (cart line price display) touch
**billing/pricing-adjacent surfaces** — named High-Risk Classes per `orchestration.md` (billing/
credits touches Item 1 directly via order-creation stock gating; Item 2 is pricing-display-adjacent,
not a billing-calculation change itself — `CartLineItem` only renders an already-computed
`lineSubtotal`, it does not compute totals — so Item 2's risk is narrower than Item 1's but still
flagged per the task brief's explicit instruction). Item 3 is a **security-class** fix (XSS/HTML
injection in a transactional email sent from the company's domain). Items 4 and 5 are lower risk
(display-correctness bug; info-disclosure in an error message) — both still get Fully-Automated test
gates per this repo's existing convention (no Hybrid/Agent-Probe needed; matches the sibling plan's
precedent that this Vitest-only repo proves everything Fully-Automated).

Modified files:
1. `features/checkout/services/checkout.service.ts` (Item 1)
2. `features/checkout/services/order-email.service.ts` (Item 3)
3. `components/shared/CartLineItem.tsx` (Item 2)
4. `features/cart/pricing.ts` (Item 4)
5. `app/api/staff/uploads/route.ts` (Item 5 — **likely already resolved by concurrent sibling plan's
   EXECUTE; see idempotent-check instruction in Validate Contract below**)

New/extended test files:
- `features/checkout/services/checkout.service.test.ts` (extend — Item 1)
- `features/checkout/services/order-email.service.test.ts` (extend — Item 3)
- `components/shared/CartLineItem.test.tsx` (NEW — Item 2)
- `features/cart/pricing.test.ts` (extend — Item 4)
- `app/api/staff/uploads/route.test.ts` (NEW, or shared-with-sibling-plan if already created — Item 5
  — **confirmed already exists with a covering test case as of VALIDATE time, 19-08-26**)

Not touched (explicitly out of scope): anything listed in the sibling plan's F1-F7 scope (see
Overview's non-overlap note), `features/cart/constants.ts`'s `VOUCHER_TIERS` constant itself (only
its dead-default *usage* in `pricing.ts` is removed — the constant/export stays), `CartDrawer.tsx`
(no change needed, already compliant), `docs/checkout-page-implementation-plan.md`'s planned future
`CartLineItem` caller (not implemented here).

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| checkout.service.test.ts — NaN-stock `stockResult` triggers `getAvailableStock()` fallback, oversell correctly rejected | Fully-Automated | Bug 1 (oversell guard bypass) |
| checkout.service.test.ts — NaN-stock + `getAvailableStock()` throws → error propagates (no regression on existing DB-error path) | Fully-Automated | Bug 1 |
| checkout.service.test.ts — existing valid-numeric-stock happy path unmodified | Fully-Automated | Bug 1 (regression guard) |
| order-email.service.test.ts — `</td></tr><tr><td>` / `<img onerror>` payloads in buyer/address fields render as escaped entities, not raw HTML | Fully-Automated | Bug 3 (XSS) |
| CartLineItem.test.tsx (new) — renders `lineSubtotal` verbatim, not `product.price * quantity`, for a discounted multi-quantity case | Fully-Automated | Bug 2 (price fallback) |
| `npx tsc --noEmit` — compile fails if any caller omits `lineSubtotal` (required-prop contract) | Fully-Automated | Bug 2 (public contract safety) |
| pricing.test.ts — `buildProductVoucherTiers()` returns ascending-`thresholdVnd` order regardless of input variant order | Fully-Automated | Bug 4 (voucher tier ordering) |
| pricing.test.ts — existing ascending-order-assuming progress-bar tests unmodified | Fully-Automated | Bug 4 (regression guard) |
| `npx tsc --noEmit` — `getVoucherProgress`'s `tiers` required-param change compiles cleanly (no caller relies on omitted default) | Fully-Automated | Bug 4 (dead-default cleanup) |
| app/api/staff/uploads/route.test.ts — Cloudinary-not-configured response excludes `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`/`.env` literal strings from client-facing `message` | Fully-Automated | Bug 5 (env var leak) — **already present and green on disk as of VALIDATE time; confirm not (re)apply** |

All 5 bugs are Fully-Automated per this repo's Vitest-only test infra (confirmed via
`process/context/tests/all-tests.md`) — no Hybrid or Agent-Probe tier required. No Known-Gap rows
exist; every developed behavior in this plan has a proving Fully-Automated gate (vacuous-green ban
satisfied).

## Test Infra Improvement Notes

(none identified yet)

## Acceptance Criteria

1. `createOrder()` never treats a NaN/non-finite `stockResult.stock` value as valid — it always falls
   back to `orderRepository.getAvailableStock()` in that case, matching the null-`stockResult`
   behavior (Item 1).
2. `renderOrderConfirmationHtml()`'s customer-supplied string fields (`fullName`, `phone`, `street`,
   `ward`, `province`) never appear unescaped in the rendered HTML output (Item 3).
3. `CartLineItem` never falls back to `product.price * quantity` — `lineSubtotal` is required and
   always used verbatim (Item 2).
4. `buildProductVoucherTiers()`'s returned tier array is always ascending by `thresholdVnd`,
   regardless of the underlying product variants' raw array order (Item 4).
5. `getVoucherProgress`'s dead `VOUCHER_TIERS` default parameter is removed; `tiers` is required
   (Item 4).
6. `app/api/staff/uploads/route.ts`'s `isCloudinaryConfigured` guard clause never includes literal
   env var names (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) or `.env`
   in its client-facing error message (Item 5).
7. No item in this plan touches any file or behavior already covered by the sibling
   `full-codebase-review_PLAN_19-08-26.md`'s F1-F7 scope (non-overlap preserved).

## Phase Completion Rules

- An item is **CODE DONE** when its checklist steps are implemented and its test gate command(s) run
  and exit green.
- An item is **VERIFIED** only after: (a) CODE DONE, AND (b) the item's mapped Verification Evidence
  row is independently re-confirmed during EVL (vc-tester re-running the exact gate commands —
  execute-agent's own internal green claim is not sufficient per orchestration.md's EVL
  confirmation-run rule).
- The whole plan is **VERIFIED** only when all 5 items are VERIFIED and a full regression pass (all 5
  test-gate commands plus `npx tsc --noEmit`) is green in one final run.
- Do not mark any item VERIFIED based on code review alone — a green Vitest/tsc run is required
  evidence for every criterion (all 6 are Fully-Automated, per Verification Evidence above).
- **Item 5 exception:** if the live-file idempotent check (see Validate Contract Execute-Agent
  Instructions) finds the guard clause already fixed and the covering test already green, Item 5 is
  VERIFIED by inspection of the already-passing gate — do not re-run EXECUTE edits on an
  already-fixed file, but DO still include `app/api/staff/uploads/route.test.ts` in the plan's final
  full regression pass to confirm it stays green.

## Risks

- **Item 1 (billing-adjacent)**: the widened fallback condition changes behavior only for the
  previously-broken NaN case — confirm during EXECUTE that the existing valid-numeric happy path
  (majority of real traffic) takes the exact same code path as before (no added DB round-trip for the
  common case), to avoid a latency regression while fixing the correctness bug.
- **Item 2 (billing-adjacent, latent bug)**: the required-prop change is a public API tightening; if
  EXECUTE discovers a second, previously-unfound caller of `CartLineItem` beyond `CartDrawer.tsx`
  (this plan's grep found only one, but grep coverage should be re-confirmed live during EXECUTE,
  since new callers could have been added between PLAN and EXECUTE), that caller must be updated to
  pass `lineSubtotal` explicitly as part of this same item — do not leave a compile error unresolved.
- **Item 3 (security)**: escaping order matters (`&` must be replaced first) — a wrong replacement
  order would double-escape or fail to escape correctly; the test gate's assertion on the exact
  escaped-entity output is the safeguard, not just "no raw `<img`" absence-checking.
- **Item 4 (dead-default removal)**: although the repo-wide grep found zero callers relying on
  `getVoucherProgress`'s omitted-argument default, `npx tsc --noEmit` is the explicit re-confirmation
  gate for this — do not skip it even though the change looks trivially safe.
- **Item 5 (test-file coordination)**: `app/api/staff/uploads/route.test.ts` may already exist on disk
  by the time this plan's EXECUTE runs, if the sibling plan's EXECUTE ran first and created it for its
  own F6 catch-block case. EXECUTE must check disk state before writing and ADD this item's case to
  the existing file rather than overwriting or duplicating it. **Confirmed at VALIDATE time: this has
  already happened — the file exists and already contains a covering case for Item 5's own guard
  clause fix, not just the sibling's catch-block case.**
- **Cross-plan sequencing / duplicate-edit risk (elevated from informational to a CONCERN at VALIDATE
  — see Validate Contract Dimension findings below)**: this plan and the sibling
  `full-codebase-review_PLAN_19-08-26.md` (Gate: PASS) both target `app/api/staff/uploads/route.ts`.
  Confirmed at VALIDATE time (19-08-26) that the sibling plan's concurrently-running `vc-execute-agent`
  has ALREADY applied a fix to Item 5's exact guard-clause call site (in addition to its own F6
  catch-block fix), because that execute-agent was separately instructed to close this same
  guard-clause gap as a natural extension of its own item. EXECUTE for Item 5 in THIS plan MUST NOT
  blindly re-apply the diff — it must re-read the live file first and skip the edit if already
  resolved (idempotent check; see Execute-Agent Instructions).

## Dependencies

- No new npm dependencies (explicitly confirmed: Item 3's escape helper is hand-written inline, not a
  new `sanitize-html`/`escape-html` package — deliberately smaller than the sibling plan's blog-XSS
  fix, which does add `sanitize-html` for a different, heavier allowlist use case).
- No new environment variables.
- No DB migration required.

## Resume and Execution Handoff

1. **Selected plan file path:**
   `process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md`
2. **Last completed phase or step:** VALIDATE — this file (validate-contract below). RESEARCH/INNOVATE
   were pre-completed upstream (two independent code-review passes supplied verified findings with
   file:line locations); PLAN additionally re-confirmed every finding against the live repo, and
   VALIDATE (this pass) re-confirmed all 5 items again live plus discovered the Item 5 cross-plan
   overlap (see Risks and Validate Contract below).
3. **Validate-contract status:** written below — Gate: CONDITIONAL (one accepted concern: Item 5
   cross-plan overlap; mitigation baked into Execute-Agent Instructions).
4. **Supporting context files loaded during PLAN/VALIDATE:** `process/context/all-context.md` (root
   router), `process/context/payment/all-payment.md`, `process/context/tests/all-tests.md`,
   `process/context/email/all-email.md` (group routers referenced, not deep-read line-by-line —
   confirmed Vitest-only + co-located test convention from the root router's Key Patterns section,
   sufficient for this plan's needs); direct source reads of `checkout.service.ts`,
   `CartLineItem.tsx`, `CartDrawer.tsx`, `order-email.service.ts`, `pricing.ts`,
   `CartVoucherProgress.tsx`, `constants.ts` (cart), `app/api/staff/uploads/route.ts`,
   `app/api/staff/uploads/route.test.ts`, `src/errors/app.error.ts` — confirmed exact current code
   shape referenced throughout this plan's checklist items, INCLUDING the already-applied Item 5 fix
   discovered at VALIDATE time; the sibling `full-codebase-review_PLAN_19-08-26.md` was read in full
   for format reference and to confirm the Item 5 non-overlap boundary.
5. **Next step for a fresh agent picking up mid-execution:** confirm which items (1-5) are already
   code-complete by checking `git diff` / running each item's test gate command; resume at the first
   item whose test gate is not yet green. Items are independent — any order is safe, but the
   Execution Order section above gives the recommended severity-first sequence. **Before editing
   `app/api/staff/uploads/route.ts` for Item 5, re-check disk state — as of VALIDATE time (19-08-26)
   it is already fixed and tested; likely no edit needed, just confirmation.**

## Validate Contract

Status: CONDITIONAL
Date: 19-08-26
date: 2026-08-19
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: Score 1/7 (S7 not met — 5 files, just under the 5+ threshold is actually met numerically
but items are mutually independent with zero cross-item coordination needed, and this is a single
COMPLEX plan, not a phase program — S1/S2/S4/S5/S6 not present as fan-out drivers). Five
mutually-independent, non-overlapping single-file items with pre-verified line-level findings do not
need parallel-subagent or workflow orchestration for VALIDATE's own fan-out; the two-layer fan-out
(4 dimension checks + 5 per-item feasibility checks) was executed directly by this single
vc-validate-agent session via live file reads rather than spawning 9 separate agents, since every
touchpoint file was small enough to read directly and cross-reference against the plan's line-level
claims in one pass — this is a reasoned downgrade from the Tier-1 default, not a skipped step. EXECUTE
itself may run sequentially per the plan's own Execution Order, or in parallel across the 5
independent items if the orchestrator prefers (no correctness reason to serialize).

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | `createOrder()` falls back to `getAvailableStock()` for NaN/non-finite stock (Item 1) | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts` | B |
| AC1-regress | Existing valid-numeric-stock happy path unmodified (Item 1) | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts` | A |
| AC2 | Customer-supplied buyer/address fields HTML-escaped in confirmation email (Item 3) | Fully-Automated | `npx vitest run features/checkout/services/order-email.service.test.ts` | B |
| AC3 | `CartLineItem` renders `lineSubtotal` verbatim, never `product.price * quantity` (Item 2) | Fully-Automated | `npx vitest run components/shared/CartLineItem.test.tsx` | B |
| AC3-contract | `lineSubtotal` required-prop compile-time enforcement (Item 2) | Fully-Automated | `npx tsc --noEmit` | B |
| AC4 | `buildProductVoucherTiers()` returns ascending-`thresholdVnd` order regardless of input order (Item 4) | Fully-Automated | `npx vitest run features/cart/pricing.test.ts` | B |
| AC4-regress | Existing ascending-order-assuming progress-bar tests unmodified (Item 4) | Fully-Automated | `npx vitest run features/cart/pricing.test.ts` | A |
| AC5 | `getVoucherProgress`'s dead `VOUCHER_TIERS` default removed, `tiers` required, no caller breaks (Item 4) | Fully-Automated | `npx tsc --noEmit` | B |
| AC6 | Cloudinary-not-configured guard excludes env var names / `.env` from client message (Item 5) | Fully-Automated | `npx vitest run app/api/staff/uploads/route.test.ts` | A — already proven on disk as of VALIDATE time (19-08-26); see Execute-Agent Instructions E1 |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

Legacy line form:
- Item 1 (oversell guard): Fully-automated: `npx vitest run features/checkout/services/checkout.service.test.ts`
- Item 3 (XSS): Fully-automated: `npx vitest run features/checkout/services/order-email.service.test.ts`
- Item 2 (cart price fallback): Fully-automated: `npx tsc --noEmit && npx vitest run components/shared/CartLineItem.test.tsx`
- Item 4 (voucher tier ordering): Fully-automated: `npx vitest run features/cart/pricing.test.ts && npx tsc --noEmit`
- Item 5 (Cloudinary env leak): Fully-automated: `npx vitest run app/api/staff/uploads/route.test.ts` (already green on disk at VALIDATE time — see E1)

Failing stub (AC1 — Item 1, since existing test file/describe block already exists, this stub
illustrates the NEW case to add, not a new file):
```
Failing stub:
test("should fall back to getAvailableStock() when refreshProductCatalogServer resolves NaN stock", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: NaN-stock stockResult triggers fallback, oversell rejected")
})
```

Failing stub (AC2 — Item 3):
```
Failing stub:
test("should escape HTML-unsafe characters in buyer/address fields before interpolation into confirmation email", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: XSS payloads in fullName/street render as escaped entities, not raw HTML")
})
```

Failing stub (AC3 — Item 2, new file `components/shared/CartLineItem.test.tsx`):
```
Failing stub:
test("should render lineSubtotal verbatim, not product.price * quantity, for a bundle-discounted multi-quantity line", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: CartLineItem must use lineSubtotal prop, never derive from price * quantity")
})
```

Failing stub (AC4 — Item 4):
```
Failing stub:
test("should return buildProductVoucherTiers() sorted ascending by thresholdVnd regardless of input variant order", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: voucher tiers must be sorted, not rely on unenforced variant array order")
})
```

Failing stub (AC6 — Item 5): NOT REQUIRED — gap-resolution A, test already exists and is green
(`app/api/staff/uploads/route.test.ts`, 4th `it` block, confirmed live on disk at VALIDATE time).

Dimension findings:
- Infra fit: PASS — no container/infra/runtime surface touched; single-app Next.js repo; all 14
  touchpoint/test files (source + existing tests) confirmed present on disk and line-content matches
  the plan's citations within a few lines (component/function locations, not exact line-for-line, as
  expected after intervening edits).
- Test coverage: PASS — Vitest-only test infra confirmed via `process/context/tests/all-tests.md`
  (no Playwright/e2e in this repo, consistent with the task brief). All 9 Verification Evidence rows
  are Fully-Automated, matching this repo's existing convention (co-located `*.test.ts(x)`,
  `vi.mock`-based mocking, `@vitest-environment node` docblock for server-only files). No Known-Gap
  rows — vacuous-green ban satisfied.
- Breaking changes: CONCERN — Items 2 and 4 intentionally tighten two public function/prop contracts
  (`CartLineItem.lineSubtotal` and `getVoucherProgress`'s `tiers` param, both optional → required).
  Live grep confirms exactly one caller of each (`CartDrawer.tsx` line 199 for `CartLineItem`,
  already passing `lineSubtotal` explicitly; `buildCartSummary` in `pricing.ts` itself for
  `getVoucherProgress`, always passing `resolvedTiers`) — both callers are already compliant, so
  `npx tsc --noEmit` will not break on this plan's own changes. This is accepted as a documented,
  intentional, verified-safe breaking change (see Public Contracts section) — not a blocker, but
  EXECUTE should re-grep both call sites live (per the plan's own Risk notes) before editing, in case
  a new caller was added between VALIDATE and EXECUTE.
- Security surface: CONCERN — Item 3's `escapeHtml` fix is mechanically correct (verified: `&`
  replaced first, preventing double-escaping of subsequently-inserted entities). Item 5's fix target
  (`app/api/staff/uploads/route.ts`'s `isCloudinaryConfigured` guard clause) is confirmed ALREADY
  FIXED on disk by a concurrently-executing sibling-plan `vc-execute-agent` that was separately
  instructed to close this exact gap as an extension of its own F6 catch-block item in the same file.
  Real risk of a duplicate/conflicting edit landing from both plans if this plan's EXECUTE blindly
  re-applies Item 5's diff without first checking live file state. Mitigated via Execute-Agent
  Instruction E1 below (idempotent pre-check, skip-if-already-fixed). This CONCERN is accepted with
  the mitigation as written — see Accepted by.
- Section Item 1 (stock check) feasibility: PASS — mechanical feasibility confirmed (lines 99, 111-113
  of `checkout.service.ts` match plan's citation). No gaps or conflicts found. Highest-risk edit: the
  widened fallback condition must not add a DB round-trip to the common valid-stock path — mitigate by
  confirming the `Number.isFinite` check short-circuits identically to today's truthiness check for
  the non-NaN case (same object reference, same property access, only the guard condition widens).
- Section Item 3 (XSS) feasibility: PASS — mechanical feasibility confirmed (buyer/address
  interpolation at lines 24-25 of `order-email.service.ts` match plan's citation; no existing
  `escapeHtml`/`sanitize*` helper found, confirmed via search). No gaps or conflicts. Highest-risk
  edit: replacement order in the new `escapeHtml` helper (`&` must be first) — the plan already states
  this explicitly and the test gate asserts exact escaped-entity output, not just absence-checking, so
  the risk is adequately mitigated in the plan text itself.
- Section Item 2 (CartLineItem) feasibility: PASS — mechanical feasibility confirmed (`lineSubtotal?:
  number` at line 12, fallback at line 65 of `CartLineItem.tsx`; `CartDrawer.tsx` line 199 is the sole
  caller and already compliant). No gaps or conflicts. Highest-risk edit: the required-prop tightening
  itself — mitigated by the plan's own instruction to re-grep `<CartLineItem` live before editing.
- Section Item 4 (voucher tiers) feasibility: PASS — mechanical feasibility confirmed
  (`buildProductVoucherTiers` at lines 163-175, `getVoucherProgress`'s dead default at line 149 of
  `pricing.ts`; sole caller `buildCartSummary` at line 246 always passes `resolvedTiers` explicitly).
  No gaps or conflicts. Highest-risk edit: the sort must not change any other consumer's behavior —
  `buildTierProgress`/`calculateProgressPercent`/`CartVoucherProgress.tsx` already assume ascending
  order and are unaffected by adding the enforcement, per plan's own note (not touched by this item).
- Section Item 5 (Cloudinary guard) feasibility: CONCERN — mechanical feasibility of the DESCRIBED
  fix is confirmed sound (`InternalServerError(message, details)` two-arg constructor exists at
  `src/errors/app.error.ts:38`), but the target code is ALREADY in the two-arg form on disk (confirmed
  live read, 19-08-26) — applying the plan's literal fix text as written would either be a silent
  no-op (if EXECUTE greps for the old single-arg text and finds nothing to match, correctly skips) or,
  worse, a duplicate/conflicting edit if EXECUTE naively re-writes the block without checking current
  content first. Gap found: the plan itself did not anticipate the concurrent sibling execute run
  landing before this plan's own EXECUTE — now documented in this Validate Contract's Execute-Agent
  Instructions (E1) as an explicit idempotent-check requirement.

Open gaps: none beyond the one CONCERN above (Item 5 cross-plan overlap), which is accepted as
CONDITIONAL with the E1 mitigation below.

What this coverage does NOT prove:
- checkout.service.test.ts gate does not prove correctness of `refreshProductCatalogServer()`'s
  upstream `Number(row.stock)` conversion itself — only that `checkout.service.ts`'s consumption of a
  NaN result correctly falls back (per plan's explicit scoping, the upstream conversion is out of
  scope for this item).
- order-email.service.test.ts gate does not prove the email renders correctly in every real email
  client's HTML sandbox (e.g. Outlook's stripped CSS support) — only that the HTML string itself is
  free of unescaped user input; visual/client-rendering fidelity is not covered (pre-existing gap, not
  introduced by this fix).
- CartLineItem.test.tsx gate does not prove `CartDrawer.tsx`'s own `lineSubtotal` computation is
  correct — only that `CartLineItem` renders whatever value it is given verbatim (the value's
  correctness is `buildCartSummary`'s responsibility, already covered by `pricing.test.ts`).
- pricing.test.ts gate does not prove staff-side product-variant editing UI enforces any ordering
  constraint at write time — only that `buildProductVoucherTiers()` is resilient to unordered input at
  read time, which is the actual fix scope (defense at the read boundary, not the write boundary).
- app/api/staff/uploads/route.test.ts gate does not independently re-verify the sibling plan's F6
  catch-block fix (out of scope for this plan) — it only proves the guard-clause case (Item 5's own
  scope). The gate's current green state was produced by the sibling plan's EXECUTE, not this plan's
  EXECUTE — EVL must still re-run this gate as part of this plan's final regression pass to confirm it
  is (still) green, not skip re-verification just because "someone else already did it."

Execute-Agent Instructions:

| # | Instruction | Trigger condition |
|---|---|---|
| E1 | Before making ANY edit for Item 5, re-read the live content of `app/api/staff/uploads/route.ts`'s `isCloudinaryConfigured` guard clause (lines ~21-28). If it already uses the two-arg `InternalServerError(generic-message, details)` pattern (i.e. the single-arg leaking call described in this plan's "Confirmed current code" block is no longer present), treat Item 5 as ALREADY RESOLVED: make NO edit to `route.ts`, and separately confirm `app/api/staff/uploads/route.test.ts` contains a passing test case asserting the client message excludes `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`/`.env` (run `npx vitest run app/api/staff/uploads/route.test.ts` to confirm green). If both conditions hold, mark Item 5 CODE DONE and VERIFIED by inspection, and note in the phase report that Item 5 was resolved by the concurrent sibling plan's execute run, not by this plan's own edit. Only apply this plan's Item 5 diff if the live guard clause still uses the OLD single-arg leaking pattern. | Item 5 entry, before any write to `app/api/staff/uploads/route.ts` |
| E2 | Before editing `components/shared/CartLineItem.tsx` for Item 2's required-prop change, re-run `grep -rn "<CartLineItem" --include=*.tsx` live and confirm `CartDrawer.tsx` is still the only caller. If a second caller is found, update it to pass `lineSubtotal` explicitly as part of this same item — do not leave a compile error unresolved and do not treat the new caller as a separate follow-up. | Item 2 entry, before editing `CartLineItem.tsx` |
| E3 | Before writing to `app/api/staff/uploads/route.test.ts` for Item 5's test case, check disk state first (the file already exists as of VALIDATE time with a covering case for this exact scenario — the 4th `it` block, `"Cloudinary chưa cấu hình -> message generic, không lộ tên biến môi trường"`). Do not create a duplicate file or duplicate test case; if the existing case already covers this plan's AC6, no new test write is needed for Item 5. | Item 5 entry, before writing/extending `route.test.ts` |
| E4 | For Item 1, confirm during implementation that the widened `Number.isFinite(stockResult.stock)` condition does not add an extra `getAvailableStock()` DB round-trip on the common valid-numeric-stock path — the fast path (finite, non-NaN stock) must still skip the fallback call, identical to today's behavior. | Item 1 entry, after implementing the ternary/condition change |

Backlog Artifacts: none — all 5 items are fully scoped within this plan's blast radius; no follow-up
artifact required.

Net Gate Derivation:

| Layer 1 dimensions | Status |
|---|---|
| Infra fit | PASS |
| Test coverage | PASS |
| Breaking changes | CONCERN (accepted — documented, verified-safe, single caller each) |
| Security surface | CONCERN (accepted — Item 5 cross-plan overlap, mitigated via E1) |

| Layer 2 sections | Status |
|---|---|
| Item 1 — stock check | PASS |
| Item 3 — XSS | PASS |
| Item 2 — CartLineItem | PASS |
| Item 4 — voucher tiers | PASS |
| Item 5 — Cloudinary guard | CONCERN (accepted — already resolved on disk; E1 governs) |

**Totals: 0 FAILs / 3 CONCERNs / 6 PASSes**

**→ Net Gate: CONDITIONAL**

Gate: CONDITIONAL (concerns noted, accepted)
Accepted by: session (single-shot delegated VALIDATE task; resolution pre-specified by the
orchestrator's task instructions) — accepted concerns: (1) Item 2/Item 4 breaking-changes tightening,
accepted as documented+verified-safe; (2) Item 5 cross-plan overlap with the concurrent sibling
`full-codebase-review_PLAN_19-08-26.md` execute-run on `app/api/staff/uploads/route.ts`, accepted with
mitigation E1 (idempotent live-file check before any edit, skip-if-already-resolved) as the explicit
resolution strategy specified by the orchestrator's task brief.

## Autonomous Goal Block

SESSION GOAL: Fix 5 independently-verified priority bugs (oversell NaN-bypass, cart price fallback,
order-email XSS, voucher tier ordering, Cloudinary env-var leak) with Vitest coverage per item.
Charter + umbrella plan: N/A — single plan, not a phase program.
Autonomy: standard /goal autonomous execution rules apply if invoked under /goal — CONDITIONAL
findings proceed with fixes applied per Execute-Agent Instructions; BLOCKED items go to backlog.
Hard stop conditions / safety constraints:
- Item 5: do NOT blindly re-apply the `app/api/staff/uploads/route.ts` guard-clause diff — re-read
  the live file first (E1). If already fixed, make no edit; only confirm the test is green.
- Item 2 / Item 4: do NOT proceed with the required-prop/required-param tightening if a live re-grep
  (E2) finds a second caller that would break compilation — update that caller in the same item
  instead of leaving a compile error.
- Do not touch any file in the sibling `full-codebase-review_PLAN_19-08-26.md`'s F1-F7 scope.
- Do not implement `docs/checkout-page-implementation-plan.md`'s planned future `CartLineItem` caller
  — out of scope for this plan.
Next phase: EXECUTE — `process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md`
Validate contract: inline in plan (see `## Validate Contract` above)
Execute start: Fully-auto commands — `npx vitest run features/checkout/services/checkout.service.test.ts`, `npx vitest run features/checkout/services/order-email.service.test.ts`, `npx tsc --noEmit && npx vitest run components/shared/CartLineItem.test.tsx`, `npx vitest run features/cart/pricing.test.ts && npx tsc --noEmit`, `npx vitest run app/api/staff/uploads/route.test.ts` (Item 5 gate likely already green — confirm via E1 before editing) | e2e spec: N/A (Vitest-only repo, no Playwright/e2e suite) | probe scenario: N/A (no Agent-Probe tier used) | high-risk pack: no (Items 1/2 are billing-adjacent per orchestration.md's High-Risk Classes list, but scope is narrow/display-adjacent — no auth/payments/schema/migration/deploy surface touched; a full 5-artifact risk-evidence-pack is not required, though EXECUTE should still treat Item 1 with the care its billing-adjacency implies)
