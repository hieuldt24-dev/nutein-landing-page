---
name: plan:coupon-checkout-integration
description: "Wire admin-managed coupons into checkout order creation — customer-entered code, server-side re-validation at insert time, additive stacking with the existing voucher-tier discount"
date: 20-08-26
feature: checkout
---

# PLAN — Coupon Checkout Integration

**Date**: 20-08-26
**Status**: CODE DONE — closed out 20-08-26 (see `## UPDATE PROCESS Closeout` below)
**Complexity**: COMPLEX (single plan, not a phase program — one cohesive feature slice, financial
correctness risk, 18 files across schema/API/service/UI/email layers, no independent phase
boundaries).

## Overview

Wires the already-shipped, already-race-safe `validate_and_apply_coupon()` DB trigger and
`coupons`/`orders.coupon_id` schema up to an actual customer-facing redemption path. Today staff
can create coupons in the admin panel but no application code ever sets `coupon_id` on order
insert, so the trigger is dormant. This plan closes that gap: a customer types a code on the
checkout page, sees a live (UX-only) preview of the discount, and the order is only created with
the coupon attached if the coupon is genuinely valid against live DB state at submission time. The
coupon discount is additive on top of the existing, unmodified automatic voucher-tier discount.

Context loaded per `process/context/all-context.md` routing table: `process/context/tests/all-tests.md`
(Vitest-only, mocked-Supabase-client pattern, no Playwright/e2e suite) and the `payment`/`database`
context groups were consulted for the checkout/order-creation and schema conventions this plan
follows.

Source docs:
- SPEC: `process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_SPEC_20-08-26.md`
- INNOVATE decision summary: embedded in the PLAN task prompt (chosen approach below is its exact restatement)

---

## Chosen Approach (from INNOVATE — restated for EXECUTE)

App layer pre-validates the coupon using an already-fetched coupon row (`is_active`, `expires_at`,
`usage_limit` vs `used_count`, `min_order_value` vs **pre-discount** subtotal). The existing DB
trigger `validate_and_apply_coupon()` (`supabase/migrations/20260718000000_init_schema.sql:603-632`)
is **never modified** and stays the race-safe final authority at insert time (it locks the coupon
row `FOR UPDATE`, re-checks active/expiry/usage, and atomically increments `used_count`). A new
preview endpoint powers the checkout page's "Apply" button; it is UX-only and is never trusted as
the charged amount.

**Locked constraints (do not deviate):**
- `features/cart/pricing.ts` / `VOUCHER_TIERS` is OUT OF SCOPE.
- One coupon per order — `orders.coupon_id` already exists as a single FK, no migration.
- `min_order_value` checked against **pre-discount** subtotal (`cartSummary.subtotal`, before the
  voucher-tier discount).
- Additive stacking only — coupon discount + voucher-tier discount always sum; coupon never
  replaces/overrides the voucher-tier discount.
- No modification to `validate_and_apply_coupon()` or to `features/cart/pricing.ts`.
- No modification to the concurrent `.max(100)` PERCENTAGE-cap track on
  `features/admin-coupons/schemas/admin-coupons.schema.ts` — confirmed **not yet landed**
  (current schema at read time has `discount: z.number().min(0, ...)` with no `.max(100)`).
  The coupon-validation service's defensive clamp (Mitigation 2 below) is independent of whether
  that track ships before or after this work.

---

## PLAN-level Design Decision Not Explicit in SPEC/INNOVATE (documented here, consistent with locked constraints)

**How the two-discount-line breakdown survives to order history (AC11-adjacent, open question 5).**
`orders` has only one `discount_amount` column (combined total) and a `coupon_id` FK — there is no
column to store the coupon's discount amount *separately* from the voucher-tier amount, and adding
one would require a migration (explicitly out of scope: "No new migration required for the
coupon-application flow itself").

Resolution: extend the **existing** `shipping_address` JSONB snapshot column (already used for
non-relational order-time snapshot data — see `OrderShippingAddressSnapshot.lines`) with two new
optional fields: `couponCode?: string` and `couponDiscountAmount?: number`. This is not a schema
migration (JSONB column already exists, already mutable, already a snapshot-of-record pattern) — it
satisfies the "no new migration" constraint while giving order-history reads (which query
`orders.shipping_address`, not the live `coupons` table) everything needed to render "Mã giảm giá:
{CODE} − {amount}" after the fact, independent of the email path (which renders directly from the
in-memory `CreateOrderResult`, no persistence read needed).

This is a plan-level engineering decision, not a re-litigation of INNOVATE's decisions — it resolves
the one open question SPEC explicitly deferred without touching any locked constraint.

---

## Touchpoints

| # | File | Change type |
|---|---|---|
| 1 | `features/admin-coupons/services/admin-coupons.repository.ts` | Add `findByCode(code: string)` read method |
| 2 | `features/checkout/services/coupon-validation.service.ts` (NEW) | New service — computes discount + validates rules |
| 3 | `features/checkout/schemas/coupon-preview.schema.ts` (NEW) | Zod request/response schema for the preview endpoint |
| 4 | `app/api/checkout/coupon/validate/route.ts` (NEW) | New preview API route — auth + rate-limited |
| 5 | `features/checkout/schemas/checkout.schema.ts` | Add optional `couponCode` field to `createOrderRequestSchema` |
| 6 | `features/checkout/services/checkout.service.ts` | Wire coupon validation into `createOrder()`, fresh re-validation, additive sum, insert-failure error mapping |
| 7 | `features/checkout/services/order.repository.ts` | `create()` accepts `couponId` + coupon snapshot fields; sets `coupon_id` on insert; maps trigger rejection to `BadRequestError` |
| 8 | `features/checkout/types/index.ts` | `OrderMoneySummary` gains `couponCode?`, `couponDiscountAmount?`; `CreateOrderRequest` re-export unaffected (schema-derived) |
| 9 | `features/checkout/services/order-email.service.ts` | Add coupon discount line to confirmation email HTML |
| 10 | `features/checkout/constants.ts` | Add shared Vietnamese coupon rejection-message constants |
| 11 | `components/checkout/CheckoutOrderSummary.tsx` | Render second "Mã giảm giá: {CODE}" line when a coupon is applied |
| 12 | `components/checkout/CheckoutCouponField.tsx` (NEW) | Coupon code input + Apply button + applied chip + remove control |
| 13 | `components/checkout/CheckoutForm.tsx` | Wire coupon state (code, applied discount, couponId) through to submit payload + pass props to `CheckoutOrderSummary` |
| 14 | `lib/useCheckoutCoupon.ts` (NEW, or colocated hook in the field component — EXECUTE's call per existing hook-file conventions) | Client hook: calls preview endpoint, holds applied/rejected state |
| 15 | `features/account/types/index.ts` | `AccountOrder` gains `couponCode?: string`, `couponDiscountAmount?: number` |
| 16 | `features/account/services/account-order.service.ts` | `listOrders()` selects `shipping_address` fields already selected (no new SELECT columns needed — JSONB already fetched); `toAccountOrder()` reads the two new snapshot fields |
| 17 | `components/account/AccountOrderList.tsx` | Render coupon code + discount on the existing compact order card when present |
| 18 | `src/middlewares/rate-limit.middleware.ts` | Add a new `couponPreviewLimiter` export (or reuse `sessionLimiter` — EXECUTE decides per Mitigation 1 below; must NOT reuse `globalLimiter` — too loose for an enumeration-oracle-shaped endpoint) |

**Read-only reference files (inspect, do not modify):**
- `supabase/migrations/20260718000000_init_schema.sql` lines 209-220 (coupons table), 236-263
  (orders table + `coupon_id` FK + `CHECK` constraint), 603-632 (`validate_and_apply_coupon()`
  trigger — confirmed: raises plain `RAISE EXCEPTION '<Vietnamese text>'` with no custom SQLSTATE,
  so the Postgres error surfaces the exact trigger text in `error.message`; the trigger does
  **not** check `min_order_value` — only the app layer does)
- `features/cart/pricing.ts` (`buildCartSummary`, `CartSummary` shape) — OUT OF SCOPE, read for
  field names only (`subtotal`, `total`, `discountAmount`, `discountPercent`)
- `features/admin-coupons/schemas/admin-coupons.schema.ts` — confirm `.max(100)` cap status before
  EXECUTE starts (may have landed on the concurrent track by execution time; re-check, don't assume
  either state)
- `app/api/checkout/route.ts` — existing auth pattern to mirror in the new route
  (`authenticate(req)` → Zod parse → service call → response wrapper)

---

## Public Contracts

1. **`POST /api/checkout/coupon/validate`** (NEW)
   - Auth: required, same `authenticate(req)` middleware as `POST /api/checkout` (401 on
     missing/invalid session — no anonymous coupon-code probing).
   - Rate limit: required, see Mitigation 1.
   - Request body: `{ couponCode: string, subtotal: number }` (subtotal = the client's current
     pre-discount cart subtotal, so the preview can apply the min-order-value check against the
     same pre-discount basis the server will re-check at submit time).
   - Response (200): `{ valid: true, couponId: string, code: string, discountAmount: number }` or
     `{ valid: false, reason: string }` — never throws a generic 500 for a normal
     invalid/expired/exhausted/below-minimum coupon; those are all `valid: false` with a specific
     Vietnamese `reason`.
   - **UX-only contract**: nothing this endpoint returns is trusted or persisted directly by
     `createOrder()`. It exists solely so the checkout page can show a live total before submit.

2. **`createOrderRequestSchema`** (`features/checkout/schemas/checkout.schema.ts`)
   - New field: `couponCode: z.string().trim().min(1).max(50).optional()`. Single optional string —
     structurally cannot carry more than one coupon code (locks AC9 at the schema level, testable
     directly without hitting the service).

3. **`checkoutService.createOrder()`** (`features/checkout/services/checkout.service.ts`)
   - New behavior: when `input.couponCode` is present, the coupon is **always** re-resolved fresh
     from `adminCouponsRepository.findByCode()` and re-validated inside `createOrder()` — the
     preview endpoint's result is never passed through or trusted (Mitigation 3). On any validation
     failure, `createOrder()` throws `BadRequestError` with the specific Vietnamese reason and
     `orderRepository.create` is never called with that coupon attached (no order row is written).
   - `discount_amount` written to the order = `cartSummary.discountAmount` (voucher-tier) +
     `couponDiscountAmount` (coupon), always the sum — never one replacing the other.

4. **`orderRepository.create()`** (`features/checkout/services/order.repository.ts`)
   - New optional coupon params: `{ couponId?: string; couponCode?: string; couponDiscountAmount?: number }`.
   - Sets `coupon_id` on the insert payload when present. If the `BEFORE INSERT` trigger rejects
     (race lost, or state changed between preview and app-layer re-check and the insert instant),
     the Postgres error is mapped to a `BadRequestError` carrying the trigger's own Vietnamese text
     verbatim (mirrors the existing `23514`-stock-exhausted special-case pattern already in this
     file) instead of the generic `Không tạo được đơn hàng: ...` wrapper.
   - When the insert fails after a payOS payment link was already created, `checkoutService`'s
     existing catch block (cancel the orphaned payOS link) already wraps every `orderRepository.create`
     call generically — **no new catch-block code needed**, this is automatic reuse, confirm with a
     test that the reuse path fires correctly for a coupon-triggered insert failure too.

---

## Blast Radius

- **Risk class:** financial calculation correctness (discount/total amount) + a new
  authenticated-but-unthrottled-by-default endpoint shape (coupon-code enumeration oracle risk) —
  treat as high-risk per `vc-security` mitigation requirements below, even though this is not a
  payment-gateway or auth-identity change.
- **Files touched:** 18 (see Touchpoints table) — 1 new schema, 1 new service, 1 new API route, 1
  new UI component, 1 new hook, 13 modified existing files.
- **Packages/domains touched:** `features/checkout/**`, `features/admin-coupons/**` (read-only
  addition, no existing method changed), `features/account/**`, `components/checkout/**`,
  `components/account/**`, `app/api/checkout/**`, `src/middlewares/rate-limit.middleware.ts`.
- **Explicitly NOT touched:** `features/cart/pricing.ts`, `VOUCHER_TIERS`, the
  `validate_and_apply_coupon()` trigger, any migration file, `components/admin/coupons/**` (admin
  UI unaffected — AC12 is a regression gate, not new coverage), the concurrent `.max(100)` cap
  track on `admin-coupons.schema.ts`.

---

## 3 Mandatory vc-predict Mitigations (each a separately-verifiable checklist item + test gate)

1. **Preview endpoint auth + rate limit.** `POST /api/checkout/coupon/validate` MUST call
   `authenticate(req)` before doing anything else (matches `POST /api/checkout`'s existing pattern)
   AND MUST be wired into `src/middlewares/rate-limit.middleware.ts`. Because this endpoint is
   queryable with an arbitrary code string and returns a boolean-ish validity signal, it is
   structurally a coupon-code enumeration oracle if unthrottled — same failure class as the
   documented `emailStatusLimiter` fix for `/api/auth/email-status`. Do not reuse `globalLimiter`
   (max 1000/15min — too loose for this shape); reuse `sessionLimiter` (max 200/15min) or add a
   new limiter sized similarly to `emailStatusLimiter`. EXECUTE decides the exact limiter but MUST
   NOT ship with no rate limit or with `globalLimiter`.
2. **Defensive discount clamp.** In `coupon-validation.service.ts`, the computed discount amount
   MUST be `Math.min(rawDiscount, subtotal)` (or equivalent) regardless of `discount_type`
   (`FIXED` or `PERCENTAGE`), independent of whether the concurrent `.max(100)` PERCENTAGE-cap
   fix has landed on `admin-coupons.schema.ts` by execution time (confirmed NOT landed as of
   RESEARCH — re-check current state at EXECUTE start, don't assume either way). This prevents a
   coupon computing a negative order total.
3. **Fresh re-validation at submit, never trust preview.** `checkoutService.createOrder()` MUST
   independently call the coupon-validation service against live DB state — it must NEVER accept
   a `couponId`/`discountAmount` pair computed by the preview endpoint as pre-validated input from
   the client. The preview endpoint's response shape is UX-only and is not part of
   `createOrderRequestSchema`'s trusted input (only `couponCode` — a bare string — crosses that
   boundary; the discount number is always server-computed inside `createOrder()`).

---

## Rejection Message Copy (shared constants — locked per INNOVATE open-question-1 resolution)

Add to `features/checkout/constants.ts` (or a new `features/checkout/coupon-messages.ts` if
`constants.ts` would exceed a reasonable single-file size — EXECUTE's call):

| Case | Message (Vietnamese) | Source |
|---|---|---|
| Code not found | `"Mã giảm giá không tồn tại"` | New — trigger doesn't cover this case (app-layer-only check, code lookup miss) |
| Inactive / invalid | `"Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa"` | Verbatim from trigger text — reused so preview-time and insert-time-fallback text never drift |
| Expired | `"Mã giảm giá đã hết hạn"` | Verbatim from trigger text |
| Usage exhausted | `"Mã giảm giá đã hết lượt sử dụng"` | Verbatim from trigger text |
| Below minimum order value | `` `Đơn hàng cần tối thiểu ${formatCurrencyVnd(minOrderValue)} để dùng mã này` `` | New — trigger doesn't check `min_order_value`, app-layer-only |

Both the preview endpoint's coupon-validation service call AND `checkoutService.createOrder()`'s
coupon-validation service call MUST import these from the same shared constants module — this is
the mechanism that prevents preview-time and submit-time copy from drifting (INNOVATE open
question 1, locked).

---

## Implementation Checklist

### A. Backend — coupon lookup + validation service

1. `features/admin-coupons/services/admin-coupons.repository.ts`: add `findByCode(code: string): Promise<AdminCoupon | null>` — `select(COUPON_SELECT).eq("code", code).maybeSingle()`, reuse `toAdminCoupon` mapper. No RLS concern (service uses `supabaseAdmin`, same as existing methods).
2. Add shared rejection-message constants (table above) to `features/checkout/constants.ts`.
3. Create `features/checkout/services/coupon-validation.service.ts` exporting `validateAndComputeDiscount({ code, subtotal }): Promise<{ couponId: string; code: string; discountAmount: number }>` — throws `BadRequestError` with the appropriate message from step 2 for: not found, `is_active === false`, `expires_at` in the past, `usage_limit !== null && used_count >= usage_limit`, `min_order_value !== null && subtotal < min_order_value`. Discount computation: `FIXED` → `discount`; `PERCENTAGE` → `subtotal * (discount / 100)`; both clamped via `Math.min(rawDiscount, subtotal)` (Mitigation 2). This function is the single source of truth for the discount number, called from both the preview route and `checkoutService.createOrder()`.

### B. Backend — preview endpoint

4. Create `features/checkout/schemas/coupon-preview.schema.ts`: request schema `{ couponCode: z.string().trim().min(1).max(50), subtotal: z.number().min(0) }`.
5. Add rate limiter (Mitigation 1) — new export in `src/middlewares/rate-limit.middleware.ts` or reuse `sessionLimiter`; document the choice inline.
6. Create `app/api/checkout/coupon/validate/route.ts`: call the rate limiter chosen in step 5 as the FIRST guard clause inside the handler — `const limited = await <limiter>(req); if (limited) return limited;` — mirroring the exact early-return pattern already used in `app/api/contact/route.ts` (`sessionLimiter`) and `app/api/auth/email-status/route.ts` (`emailStatusLimiter`), confirmed at VALIDATE (2026-08-20); then `authenticate(req)`, then Zod-parse, then call `couponValidationService.validateAndComputeDiscount`; catch `BadRequestError` and return `{ valid: false, reason: error.message }` (200, not an error status — this is a normal UX outcome, not a server error); on success return `{ valid: true, couponId, code, discountAmount }`.

### C. Backend — order creation wiring

7. `features/checkout/schemas/checkout.schema.ts`: add `couponCode: z.string().trim().min(1).max(50).optional()` to `createOrderRequestSchema`.
8. `features/checkout/services/order.repository.ts`: extend `create()`'s `money` or a new 4th param to accept `couponId?: string`, `couponCode?: string`, `couponDiscountAmount?: number`; set `coupon_id: couponId ?? null` on the orders insert; extend `OrderShippingAddressSnapshot` with `couponCode?: string; couponDiscountAmount?: number` and populate on the snapshot object (PLAN-level design decision above); on `orderError`, before the generic wrap, check whether `orderError.message` matches one of the 3 known trigger texts and if so `throw new BadRequestError(orderError.message)` verbatim instead of the generic wrapper (mirrors the existing `23514` stock-exhausted special case in this same function).
9. `features/checkout/services/checkout.service.ts` `createOrder()`: after `buildCartSummary` and before `resolvePayment`, if `input.couponCode` present call `couponValidationService.validateAndComputeDiscount({ code: input.couponCode, subtotal: cartSummary.subtotal })` (Mitigation 3 — always fresh, never trust any client-passed discount number). Combine: `const combinedDiscount = cartSummary.discountAmount + (couponResult?.discountAmount ?? 0)`; `merchandiseTotal = cartSummary.total - (couponResult?.discountAmount ?? 0)`; `total = merchandiseTotal + shippingFee`; pass `discountAmount: combinedDiscount` and the coupon fields through to `orderRepository.create`; add `couponCode`/`couponDiscountAmount` to the `summary` object in `CreateOrderResult`. The existing `try { row = await orderRepository.create(...) } catch (createError) { cancel payOS link if present; throw }` block needs no structural change — a coupon-triggered insert failure is just another `createError` through the same path (confirm via test, per Public Contracts §4).
10. `features/checkout/types/index.ts`: add `couponCode?: string; couponDiscountAmount?: number` to `OrderMoneySummary`.

### D. Email + order history

11. `features/checkout/services/order-email.service.ts`: in `renderOrderConfirmationHtml`, add a coupon line to the "Chi tiết đơn hàng" table conditionally rendered when `order.summary.couponCode` is present — format: `Mã giảm giá: {code} · −{formatCurrencyVnd(couponDiscountAmount)}` — keep the existing generic "Giảm giá" (total) line unchanged, add the coupon line as an additional row, both `escapeHtml`'d where the value is not already a controlled internal string (the coupon code IS user-entered — MUST go through `escapeHtml`, same as `buyer.fullName`/`address.street` already do).
12. `features/account/types/index.ts`: add `couponCode?: string; couponDiscountAmount?: number` to `AccountOrder`.
13. `features/account/services/account-order.service.ts`: `toAccountOrder()` reads `row.shipping_address.couponCode` / `row.shipping_address.couponDiscountAmount` (both optional, already inside the existing `shipping_address` JSONB select — no new SELECT column needed) and maps them onto the returned `AccountOrder`.
14. `components/account/AccountOrderList.tsx`: on the existing compact order `<li>` card, conditionally render `order.couponCode` + `order.couponDiscountAmount` (small line under `variantLabel`, matching existing text-style conventions) — do NOT build a new order-detail page/route (locked, open question 5).

### E. Checkout page UI

15. `components/checkout/CheckoutOrderSummary.tsx`: accept new optional props `couponCode?: string` and `couponDiscountAmount?: number`; render a second discount line "Mã giảm giá: {CODE}" below the existing "Giảm giá ({percent}%)" line when `couponDiscountAmount > 0` (both lines visible simultaneously when both discounts apply — locked, open question 3); update the "Tổng"/total display to reflect the combined discount already baked into the passed-in totals (component receives final numbers, does not recompute).
16. Create `components/checkout/CheckoutCouponField.tsx`: text input + "Áp dụng" button; on click, calls the preview endpoint (via a new client hook, item 17); three states — idle/empty, applied (shows code as a removable chip + the discount it unlocked, dedicated "×" remove control per locked open-question-4 answer — not just clearing the input), rejected (inline error message using the endpoint's `reason` text). Position: on `/checkout` page, in the form column, immediately before `CheckoutSubmitBlock` (matches SPEC's "right before order submission" placement, NOT in `CheckoutOrderSummary`/cart drawer).
17. Create client hook (`lib/useCheckoutCoupon.ts` or colocated in the field component — EXECUTE's call matching existing hook-file conventions like `useCheckoutSubmit.ts`): wraps `apiRequest` call to `/api/checkout/coupon/validate`, holds `{ status: "idle" | "checking" | "applied" | "rejected"; code?: string; discountAmount?: number; couponId?: string; reason?: string }`, exposes `apply(code)` and `remove()`.
18. `components/checkout/CheckoutForm.tsx`: wire the coupon hook's applied state into: (a) the `submitOrder` payload — pass `couponCode: appliedCode` only when status is `"applied"` (never pass a rejected/stale code), (b) `CheckoutOrderSummary`'s new props (recompute a client-preview total = `summary.total - (appliedDiscountAmount ?? 0)`, purely additive display, server remains authoritative), (c) render `CheckoutCouponField` in the form column before `CheckoutSubmitBlock`. If cart contents change after a coupon was applied (subtotal shifts), the applied state is NOT auto-revalidated client-side in this PLAN's scope — the server-side fresh re-validation at submit (item 9) is the safety net; a stale-preview edge case (cart changes after apply, before submit) is documented as an accepted UX gap, not a correctness gap (see Test Infra Improvement Notes).

### F. Regression confirmation

19. Run the existing `admin-coupons.repository.test.ts` / related admin-coupons suite unmodified — confirm zero changes needed (AC12 regression gate).

---

## Acceptance Criteria

Pulled directly from the SPEC (`## Acceptance Criteria (Testable Outcomes)`), verbatim — see
`coupon-checkout-integration_SPEC_20-08-26.md` for the full "proven by" / "strategy" text per
criterion, and the `## Verification Evidence` section below for the plan-side test-gate mapping.

1. A customer who enters a valid, active coupon code at checkout sees the order total reduced by the coupon's discount amount before submitting payment.
2. An order is only created with a coupon applied if the coupon is validated against the database at the moment of order creation — not merely trusted from an earlier client-side check.
3. An invalid or nonexistent coupon code is rejected with a clear reason, and no order is created using that code.
4. An expired coupon is rejected with a message indicating it has expired.
5. A deactivated (`is_active = false`) coupon is rejected.
6. A coupon that has already reached its `usage_limit` is rejected on the next attempted use.
7. An order that does not meet a coupon's `min_order_value` is rejected with a message stating the minimum required.
8. When both the automatic bundle/voucher-tier discount and a coupon apply to the same order, both discounts are summed into the order's total discount — neither one is dropped or overridden by the other.
9. Only one coupon can be attached to a single order — the checkout request shape has no way to submit more than one coupon code.
10. Two customers racing to redeem the last remaining use of a limited coupon cannot both succeed — only one order is created with that coupon attached; the second is rejected.
11. The order confirmation email shows that a coupon was applied and the resulting discount amount when a coupon was used on that order.
12. A staff member's existing coupon create/edit/list workflow in the admin panel is unaffected by this change.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `checkout.service.test.ts` (new/extended): valid active coupon → `discount_amount` includes coupon discount, total reduced accordingly | Fully-Automated | AC1 |
| `checkout.service.test.ts`: coupon valid at "preview time" (mocked `findByCode` returns valid row) but service is called with fresh mock returning `is_active: false` at submit — assert `createOrder` throws, `orderRepository.create` never called | Fully-Automated | AC2 |
| `checkout.service.test.ts` / `coupon-validation.service.test.ts`: unknown `couponCode` → `findByCode` resolves `null` → descriptive `BadRequestError` thrown, `orderRepository.create` never invoked with a coupon | Fully-Automated | AC3 |
| `coupon-validation.service.test.ts`: coupon row with `expires_at` in the past → rejected with "Mã giảm giá đã hết hạn" | Fully-Automated | AC4 |
| `coupon-validation.service.test.ts`: coupon row with `is_active: false` → rejected with trigger-matching text | Fully-Automated | AC5 |
| `coupon-validation.service.test.ts`: coupon row `used_count >= usage_limit` → rejected with "Mã giảm giá đã hết lượt sử dụng" | Fully-Automated | AC6 |
| `coupon-validation.service.test.ts`: cart subtotal below `min_order_value` → rejected with minimum-required message | Fully-Automated | AC7 |
| `checkout.service.test.ts`: cart with non-zero `cartSummary.discountAmount` (voucher-tier) AND a valid coupon → `order.discount_amount = voucherTierDiscount + couponDiscount`, `final_price` matches the `CHECK` formula | Fully-Automated | AC8 |
| `checkout.schema.test.ts` (new or extended): `couponCode` field is `z.string().optional()`, schema rejects an array/multiple-value input for that field | Fully-Automated | AC9 |
| `order.repository.test.ts` (new/extended): simulated trigger-rejection Postgres error on insert → mapped to `BadRequestError` carrying the trigger's Vietnamese text; confirms the app layer surfaces a `FOR UPDATE`-triggered rejection correctly (race-guarantee itself is pre-existing DB code, out of this feature's scope to re-prove) | Agent-Probe | AC10 |
| `order-email.service.test.ts` (extended): rendered HTML includes the coupon line + escaped code when `order.summary.couponCode` present; absent when not present | Fully-Automated | AC11 |
| Existing `admin-coupons.repository.test.ts` / admin-coupons service suite — run unmodified, must stay green | Fully-Automated (regression) | AC12 |
| `Math.min(rawDiscount, subtotal)` clamp unit-covered inside `coupon-validation.service.test.ts` (FIXED discount exceeding subtotal; PERCENTAGE discount with no `.max(100)` cap present) | Fully-Automated | Mitigation 2 (not a numbered AC — vc-predict finding) |
| `app/api/checkout/coupon/validate/route.test.ts` (new): unauthenticated request → 401; request under rate-limit threshold → normal response; confirms limiter is wired (mock `redis`/rate-limit module per existing route test conventions) | Fully-Automated | Mitigation 1 (not a numbered AC — vc-predict finding) |
| Manual/Agent-Probe: checkout page — enter valid code, see two discount lines, submit, land on success page with correct total | Agent-Probe | AC1, AC4-AC7 (UX surface), AC3 |
| Manual/Agent-Probe: `/account` order history card shows applied coupon code + amount for a coupon-paid order | Agent-Probe | AC5 (user story), open question 5 resolution |

**Known-gap note (per vacuous-green ban):** the UI-layer test rows above are Agent-Probe, not
Known-Gap — they are proving strategies, not a residual. No behavior in this plan is assigned
Known-Gap; the repo's zero-Playwright-suite constraint (documented in `process/context/tests/all-tests.md`)
means UI-surface proof is Agent-Probe by necessity, which is the correct tier per the waterfall,
not an excuse to skip coverage.

**Test runner / commands:** all Fully-Automated gates run via `npm test` (`vitest run`) per
`process/context/tests/all-tests.md`; server-only test files (repository/service tests importing
`import "server-only"` chains) need the `// @vitest-environment node` docblock per that file's
documented pitfall. `npm run check` (`format:check && lint && type-check && test`) is the full
local pre-push gate and should be green before this plan is considered EXECUTE-complete.

---

## Test Infra Improvement Notes

- No new test infrastructure gap identified at PLAN time — this feature's Fully-Automated tier
  fully reuses the existing Vitest-with-mocked-Supabase-client pattern (34/44 existing test files
  already use this approach); no new mocking primitive is required.
- One accepted UX gap (not a test-infra gap): client-side coupon-applied state does not
  auto-revalidate if the cart subtotal changes after "Apply" but before "Place order" — the
  fresh server-side re-validation at submit (Mitigation 3) is the correctness backstop, so this is
  a UX-polish item, not a coverage gap, and is out of this plan's checklist. If a future SPEC wants
  live revalidation, it is a new, separate follow-up.

---

## Phase Completion Rules

This is a SIMPLE-shaped single plan (COMPLEX-classified for depth, but not a phase program) — there
are no independent phases with their own gates. Completion is measured against the Implementation
Checklist groups A-F and the Verification Evidence table:

- **CODE DONE**: all 19 checklist items (groups A-F) implemented, `npm run check` green.
- **VERIFIED**: CODE DONE, plus every Fully-Automated row in Verification Evidence passes, the two
  Agent-Probe manual scenarios have been walked through and confirmed, and AC12's regression suite
  is green unmodified. Do not mark this plan `✅ VERIFIED` without explicit user confirmation of the
  Agent-Probe rows (checkout UI walkthrough + account order history walkthrough) — automated-green
  alone is CODE DONE, not VERIFIED, per this repo's phase-status honesty convention.

**Final status at closeout (20-08-26): CODE DONE, not VERIFIED.** See `## UPDATE PROCESS Closeout`
below for the explicit, user-confirmed reason this plan is archived at CODE DONE rather than held
open pending the two Agent-Probe walkthroughs.

---

## UPDATE PROCESS Closeout (20-08-26)

**Independent EVL confirmation** (vc-tester, separate spawn from execute-agent — re-ran every gate
directly rather than trusting the execute report):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS, clean |
| Scoped `vitest` (7 files) | PASS, 86/86 |
| Full `npx vitest run` | PASS, 435/435 across 61/62 files (1 pre-existing unrelated `lib/useAddresses.test.tsx` collection failure — see `process/context/tests/all-tests.md` Known Gaps — confirmed no new regression) |
| `npm run lint` | No new errors (537 pre-existing repo-wide; confirmed via git-stash-relint that `CheckoutForm.tsx`'s 2 errors pre-date this diff) |

Source-level spot checks confirmed independently (not just re-reading the execute report):
`min_order_value` is checked against the pre-discount subtotal; the discount clamp
(`Math.min(rawDiscount, subtotal)`) applies to both `FIXED` and `PERCENTAGE`; the preview endpoint
runs the rate limiter before `authenticate()`; `checkout.service.ts` sums the coupon discount
additively onto the existing voucher-tier discount and reuses the existing payOS-cancel-on-error
catch block with no duplicate error path; the concurrent `.max(100)` PERCENTAGE-cap track landed
independently and this plan's own clamp is confirmed independent of it either way;
`features/cart/pricing.ts` and the `validate_and_apply_coupon()` DB trigger are confirmed
untouched (zero git diff on both).

**Explicit user decision (this session — recorded verbatim, not to be re-asked):** the user was
asked whether to (a) manually test the 2 pending browser-only Agent-Probe items themselves, (b)
have an automated browser agent probe them, or (c) skip the risk-evidence-pack/manual-probe
requirement and accept CODE DONE as sufficient for closeout. **The user chose (c).**

- The 2 Agent-Probe UI rows in the Verification Evidence table above (checkout page live flow;
  `/account` order-history coupon display) remain **CODE DONE, NOT VERIFIED** — not faked, not
  silently dropped. Tracked in
  `process/features/checkout/backlog/coupon-checkout-agent-probe-followups_20-08-26.md`.
- **No high-risk evidence pack** (5-artifact schema per `orchestration.md` §High-Risk Execution
  Handoff) was produced for this billing-adjacent change. This is the same explicit, informed
  user trade-off — not an oversight.
- **AC10** (DB-trigger race-condition guarantee) stays Agent-Probe/pre-existing-code scope per the
  plan's own design — the trigger itself was never modified and predates this feature; untested
  from app code by design, documented as acceptable.

**4 minor EXECUTE deviations reconciled** (from the EXECUTE report's own self-review — all
confirmed within blast radius, no scope creep):
1. Test-ordering: Group A tests were written immediately after (not strictly before) their
   implementation — process deviation only, every AC still has a real proving test.
2. `route.ts` used `error instanceof AppError && error.statusCode === 400` instead of
   `error instanceof BadRequestError` — required because the literal class check failed under
   Vitest's mocked-module resolution; same runtime semantics, still test-provable.
3. Added a new `couponPreviewLimiter` (20/15min) rather than reusing `sessionLimiter` — the plan
   explicitly delegated this choice to EXECUTE; `globalLimiter` was correctly avoided either way.
4. `CheckoutOrderSummary.tsx`'s pre-existing `shippingFee === null` branch was collapsed to always
   show `orderTotal` (equal to the merchandise total when `shippingFee` is null) so the coupon
   reduction renders correctly in both branches — no behavior change when no coupon is applied.

**Closeout classification:** Ready for UPDATE PROCESS archival — CODE DONE, all Fully-Automated
gates independently re-confirmed green, deviations are within blast radius, and the two Agent-Probe
gaps plus the skipped risk-evidence-pack are explicit user-accepted trade-offs (not open unknowns).

**Archival:** task folder moved from `process/features/checkout/active/coupon-checkout-integration_20-08-26/`
to `process/features/checkout/completed/coupon-checkout-integration_20-08-26/`.

---

## Resume and Execution Handoff

1. **Selected plan file path:** `process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_PLAN_20-08-26.md` (this file).
2. **Last completed phase or step:** PLAN — checklist authored, not yet validated or executed.
3. **Validate-contract status:** pending — see placeholder section below; `vc-validate-agent` must run before EXECUTE.
4. **Supporting context files loaded during PLAN:**
   - `process/context/all-context.md`, `process/context/tests/all-tests.md`
   - `process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_SPEC_20-08-26.md`
   - `features/checkout/services/checkout.service.ts`, `order.repository.ts`, `order-email.service.ts`
   - `features/checkout/schemas/checkout.schema.ts`, `features/checkout/types/index.ts`, `features/checkout/constants.ts`
   - `features/admin-coupons/services/admin-coupons.repository.ts`, `features/admin-coupons/schemas/admin-coupons.schema.ts`
   - `src/middlewares/rate-limit.middleware.ts`
   - `app/api/checkout/route.ts`, `app/checkout/page.tsx`
   - `components/checkout/CheckoutForm.tsx`, `CheckoutOrderSummary.tsx`
   - `features/account/types/index.ts`, `features/account/services/account-order.service.ts`, `components/account/AccountOrderList.tsx`
   - `supabase/migrations/20260718000000_init_schema.sql` (lines 205-263, 598-632 — coupons/orders tables + trigger, read-only)
5. **Next step for a fresh agent picking up mid-execution:** if `## Validate Contract` below is
   still the placeholder, run `ENTER VALIDATE MODE` against this plan file before any EXECUTE work.
   If EXECUTE has started, check the Implementation Checklist letter-groups (A-F) for the last
   ticked item and resume from the next unticked item in the same group before moving to the next
   group — groups are ordered by dependency (backend service → API route → order-creation wiring →
   email/history → UI).

Next step for RIPER-5: say **ENTER VALIDATE MODE** to proceed to plan validation (required before
implementation).

---

## Validate Contract

Status: PASS
Date: 20-08-26
date: 2026-08-20
generated-by: outer-pvl

Parallel strategy: sequential (single-agent structured fan-out)
Rationale: 7-signal score = 4/7 (S2 API/schema surface, S5 user-requested depth, S6 high-risk billing-adjacent class, S7 18-file blast radius) -- nominally HIGH tier (parallel-subagents/workflow recommended). However this VALIDATE session (vc-validate-agent) had no Agent-tool spawn capability available in its tool grant, so the two-layer fan-out (4 Layer-1 dimension checks + 6 Layer-2 section checks A-F) was executed as a single-agent structured sequential pass instead, each dimension/section evaluated independently against direct file/schema reads before synthesis -- the analytical separation was preserved even though execution was not literally parallel. Flagging this transparently rather than silently claiming true parallel execution.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | Valid active coupon reduces order total by discount amount before payment | Fully-Automated | checkout.service.test.ts -- valid coupon reduces discount_amount | A |
| AC2 | Order only created if coupon re-validated against live DB at insert moment | Fully-Automated | checkout.service.test.ts -- coupon valid at preview, invalid at fresh submit-time check throws | A |
| AC3 | Invalid/nonexistent coupon code rejected, no order created | Fully-Automated | checkout.service.test.ts / coupon-validation.service.test.ts -- unknown code rejected | A |
| AC4 | Expired coupon rejected with expiry message | Fully-Automated | coupon-validation.service.test.ts -- expires_at in past | A |
| AC5 | Deactivated coupon rejected | Fully-Automated | coupon-validation.service.test.ts -- is_active false | A |
| AC6 | Usage-exhausted coupon rejected | Fully-Automated | coupon-validation.service.test.ts -- used_count >= usage_limit | A |
| AC7 | Order below min_order_value rejected, states minimum required | Fully-Automated | coupon-validation.service.test.ts -- subtotal below min_order_value | A |
| AC8 | Voucher-tier + coupon discounts summed, neither dropped/overridden | Fully-Automated | checkout.service.test.ts -- combined discount matches CHECK formula | A |
| AC9 | Only one coupon per order -- request shape cannot carry more than one code | Fully-Automated | checkout.schema.test.ts -- couponCode single optional string | A |
| AC10 | Concurrent redemption race on last-use coupon | Agent-Probe | order.repository.test.ts -- simulated trigger-rejection mapped to BadRequestError (app-layer only) | A |
| AC11 | Order confirmation email shows applied coupon + discount amount | Fully-Automated | order-email.service.test.ts -- escaped coupon line rendered when present | A |
| AC12 | Admin coupon workflow unaffected (regression) | Fully-Automated | Existing admin-coupons.repository.test.ts suite runs unmodified | A |
| Mitigation-2 | Discount defensively clamped to subtotal, independent of .max(100) cap status | Fully-Automated | coupon-validation.service.test.ts -- Math.min(rawDiscount, subtotal) covered | A |
| Mitigation-1 | Preview endpoint requires auth AND is rate-limited (enumeration-oracle guard) | Fully-Automated | app/api/checkout/coupon/validate/route.test.ts -- 401 unauthenticated; limiter wired as first guard clause | A |
| AC1,AC3-7 (UX) | Checkout page: two discount lines, correct total, rejection messages | Agent-Probe | Manual walkthrough -- enter valid/invalid codes, submit, land on success page | A |
| AC5 (user story) / OQ5 | Account order history shows applied coupon code + amount | Agent-Probe | Manual walkthrough -- /account order card for coupon-paid order | A |

gap-resolution legend:
- A -- proven now (gate passes in this cycle)
- B -- fixed in this plan (gate added by this plan's checklist)
- C -- deferred to a named later phase/plan
- D -- backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: the strategy column carries ONLY the 3 proving strategies (Fully-Automated / Hybrid / Agent-Probe). No Known-Gap rows exist -- confirmed consistent with the plan's own "Known-gap note (per vacuous-green ban)" statement.

Legacy line form (retained for existing consumers):
- coupon-validation.service: Fully-automated: npx vitest run features/checkout/services/coupon-validation.service.test.ts
- checkout.service (coupon wiring): Fully-automated: npx vitest run features/checkout/services/checkout.service.test.ts
- checkout.schema (couponCode field): Fully-automated: npx vitest run features/checkout/schemas/checkout.schema.test.ts
- order.repository (trigger-rejection mapping): Agent-probe: manual review of order.repository.test.ts simulated-error assertions against real trigger text
- order-email.service (coupon line): Fully-automated: npx vitest run features/checkout/services/order-email.service.test.ts
- coupon preview route (auth + rate limit): Fully-automated: npx vitest run app/api/checkout/coupon/validate/route.test.ts
- admin-coupons regression: Fully-automated: npx vitest run features/admin-coupons/services/admin-coupons.repository.test.ts
- full pre-push gate: Fully-automated: npm run check
- Checkout UI walkthrough: Agent-probe: manual browser session, two-discount-line + rejection-message verification
- Account order history walkthrough: Agent-probe: manual browser session, /account coupon display verification

Failing stubs (Fully-Automated rows only):

Failing stub (AC1):
```
test("should reduce order total by coupon discount amount when a valid active coupon is applied", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: valid active coupon reduces discount_amount/total")
})
```

Failing stub (AC2):
```
test("should reject order creation when coupon was valid at preview but invalid at fresh submit-time re-check", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: fresh re-validation catches now-invalid coupon, orderRepository.create never called")
})
```

Failing stub (AC3):
```
test("should reject an unknown coupon code with a descriptive error and never call orderRepository.create with that code", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: unknown coupon code rejected")
})
```

Failing stub (AC4):
```
test("should reject an expired coupon with the expiry message", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: expired coupon rejected")
})
```

Failing stub (AC5):
```
test("should reject a deactivated coupon", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: is_active=false coupon rejected")
})
```

Failing stub (AC6):
```
test("should reject a coupon that has reached its usage_limit", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: used_count >= usage_limit rejected")
})
```

Failing stub (AC7):
```
test("should reject an order below the coupon's min_order_value and state the minimum required", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: pre-discount subtotal below min_order_value rejected")
})
```

Failing stub (AC8):
```
test("should sum voucher-tier discount and coupon discount into order.discount_amount without dropping either", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: combined discount = voucherTierDiscount + couponDiscount")
})
```

Failing stub (AC9):
```
test("should accept couponCode only as a single optional string, rejecting array/multi-value input", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: createOrderRequestSchema couponCode single-value shape")
})
```

Failing stub (AC11):
```
test("should render an escaped coupon line in confirmation email HTML when order.summary.couponCode is present, and omit it when absent", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: order-email coupon line rendering")
})
```

Failing stub (AC12 -- regression):
```
test("should keep existing admin-coupons repository/service suite green unmodified", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: admin-coupons regression suite unaffected")
})
```

Failing stub (Mitigation-2):
```
test("should clamp computed discount to Math.min(rawDiscount, subtotal) for both FIXED and uncapped PERCENTAGE coupons", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: defensive discount clamp, independent of .max(100) cap landing status")
})
```

Failing stub (Mitigation-1):
```
test("should reject unauthenticated coupon-preview requests with 401 and enforce a rate limit before authenticate/parse", () => {
  throw new Error("NOT IMPLEMENTED -- TDD stub: preview endpoint auth + rate-limit guard clause wired")
})
```

Dimension findings:
- Infra fit: PASS -- new files follow existing repository/service split and route-handler conventions (authenticate(req) then Zod parse then service then response wrapper, mirrored from app/api/checkout/route.ts); new rate-limiter export matches the emailStatusLimiter/sessionLimiter naming/shape convention in src/middlewares/rate-limit.middleware.ts.
- Test coverage: PASS -- Vitest-only stack correctly targeted throughout (no Playwright suite exists, confirmed via process/context/tests/all-tests.md); 13 Fully-Automated + 1 Agent-Probe (AC10, app-layer-only) + 2 Agent-Probe (UI/account walkthroughs) is the correct waterfall tier assignment; plan's own vacuous-green-ban note (no Known-Gap rows) verified accurate.
- Breaking changes: PASS -- couponCode added as z.string().optional() to a non-strict Zod object (safe); CreateOrderRequest/CreateOrderResult/OrderMoneySummary/AccountOrder optional-field additions checked against checkout.service.test.ts -- no toStrictEqual usage found anywhere in that file, so no existing test breaks.
- Security surface: PASS (was CONCERN, resolved in-plan at VALIDATE) -- Mitigation 1's checklist step 6 was under-specified (named the requirement but not the concrete call-site wiring); supplemented directly in the plan file with the exact "const limited = await limiter(req); if (limited) return limited;" guard-clause pattern, confirmed by direct read of app/api/contact/route.ts (sessionLimiter) and app/api/auth/email-status/route.ts (emailStatusLimiter) as the two live precedents for this exact wiring shape. Coupon-code enumeration-oracle risk was correctly identified by PLAN; globalLimiter correctly excluded per plan's own constraint.
- PLAN-level design decision -- shipping_address JSONB reuse: PASS -- direct read of supabase/migrations/20260718000000_init_schema.sql (orders table DDL, lines 236-257) confirms exactly one JSONB column exists on orders (shipping_address); scanned all 13 migration files for "ALTER TABLE orders" and confirmed no other JSONB/metadata/summary column was ever added (only order_code TEXT, payos_order_code BIGINT, payos_payment_link_id TEXT). The existing OrderShippingAddressSnapshot TypeScript interface (order.repository.ts) already stores non-address snapshot fields (variantId, variantLabel, lines), and the migration's own SQL comment labels the column a general "snapshot JSONB," not address-only -- so extending it with couponCode/couponDiscountAmount is consistent reuse of an established precedent, not a novel semantic overload introduced by this plan. Column naming remains mildly confusing but that is pre-existing, not new risk. Verdict: correct engineering call given the "no new migration" constraint; no better existing column exists.
- Section A -- coupon lookup + validation service (items 1-3): PASS -- findByCode() mechanically matches existing admin-coupons.repository.ts method shapes; Math.min(rawDiscount, subtotal) clamp explicit at checklist level; re-confirmed at VALIDATE (2026-08-20) that features/admin-coupons/schemas/admin-coupons.schema.ts still has discount: z.number().min(0, ...) with no .max(100) -- the concurrent hardening-batch track (process/general-plans/active/admin-hardening-batch_20-08-26/) is still status "PLANNED, awaiting ENTER EXECUTE MODE" with zero git changes to that file -- plan's "not yet landed" claim is current and accurate, and Mitigation 2's clamp is correctly independent of it either way.
- Section B -- preview endpoint (items 4-6): PASS (post-supplement) -- see Security surface finding above.
- Section C -- order creation wiring (items 7-10): PASS -- payOS-cancel-on-insert-failure reuse claim verified directly against checkout.service.ts lines 151-184: the existing generic try { orderRepository.create(...) } catch (createError) { cancel payOS link if payosOrderCode set; rethrow } block requires zero structural changes for a coupon-triggered trigger rejection -- it is just another createError through the same path. No parallel/duplicate error-handling path is introduced. min_order_value timing verified at the code level (not just prose): features/cart/pricing.ts confirms cartSummary.subtotal = pre-discount sum of raw line totals (distinct from total = post-voucher-discount bundleTotal); checklist step 9 passes cartSummary.subtotal (not .total) into validateAndComputeDiscount, correctly matching the locked INNOVATE decision at the implementation level.
- Section D -- email + order history (items 11-14): PASS -- escapeHtml() already used for other user-entered fields (buyer.fullName, address.street) in order-email.service.ts; plan correctly extends the same treatment to the user-entered coupon code. shipping_address JSONB already fully selected in account-order.service.ts's existing query -- no new SELECT column needed, confirmed no gap.
- Section E -- checkout page UI (items 15-18): PASS -- additive component/hook changes, scoped; stale-preview-after-cart-change edge case is explicitly and correctly documented as an accepted UX gap (not a coverage gap) with the server-side fresh re-validation named as the correctness backstop.
- Section F -- regression confirmation (item 19): PASS -- trivial, unmodified-suite confirmation.

Open gaps: none unresolved -- the one Layer-1/Layer-2 CONCERN identified (Mitigation 1 checklist under-specification) was supplemented directly into the plan file's Implementation Checklist step 6 during this VALIDATE pass, prior to writing this contract.

What this coverage does NOT prove:
- All Fully-Automated service/schema tests run against a MOCKED Supabase client (per repo-wide Vitest convention) -- they prove application logic correctness but do NOT prove the real Postgres trigger (validate_and_apply_coupon()) produces byte-identical error text/shape at runtime; AC10's Agent-Probe row only partially bridges this (app-layer error-mapping only, not a live trigger invocation).
- No Playwright/e2e suite exists in this repo -- the two UI Agent-Probe rows (checkout walkthrough, account order history) are manual-judgment checks, not machine-enforced regression gates; a future code change could silently break the UI coupon flow between manual walkthroughs with no automated catch.
- The rate-limit route test mocks Redis -- it does not prove production Redis behaves identically under real IP-header spoofing, nor does it change the repo's existing fail-open-when-Redis-unavailable behavior (pre-existing pattern, out of this plan's scope; if REDIS_URL is ever unset in production, this endpoint is unthrottled exactly like every other rate-limited route in the repo today).
- AC10's underlying concurrency guarantee (FOR UPDATE row lock) is pre-existing, unmodified DB code -- no test in this plan (or any plan) re-proves the DB-level race-safety itself under real concurrent connections; this is an explicit, SPEC-documented, accepted scope boundary, not a coverage gap introduced by this plan.
- The stale-preview-after-cart-change UX edge case (cart subtotal changes after "Apply" but before "Place order") has zero test coverage by design -- it is an accepted UX gap with the server-side fresh re-validation (Mitigation 3) as the correctness backstop, documented in the plan's Test Infra Improvement Notes.

Gate: PASS (no FAILs; one CONCERN found and resolved in-plan before this contract was written)
Accepted by: N/A -- Gate is PASS; no unresolved concerns require acceptance.

## Autonomous Goal Block

SESSION GOAL: Wire admin-managed coupons into checkout order creation -- customer-entered code, server-side re-validation at insert time, additive stacking with the existing voucher-tier discount.
Charter + umbrella plan: N/A -- single plan (not a phase program).
Autonomy: Standard RIPER-5 gating. VALIDATE gate = PASS on this pass; EXECUTE requires explicit "ENTER EXECUTE MODE" per orchestration.md (no standing autonomy granted in this session).
Hard stop conditions / safety constraints:
- Never modify `validate_and_apply_coupon()` (the DB trigger) or `features/cart/pricing.ts` / `VOUCHER_TIERS` -- both are explicitly out of scope and locked by INNOVATE.
- The coupon-preview endpoint (`POST /api/checkout/coupon/validate`) must never be shipped without both `authenticate(req)` and a rate limiter wired as the first guard clause -- it is a coupon-code enumeration oracle if unthrottled. Must not reuse `globalLimiter` (too loose).
- `checkoutService.createOrder()` must always re-resolve and re-validate the coupon fresh from the DB at submit time -- the preview endpoint's discount number must never be trusted or persisted directly from client input.
- Computed discount must always be `Math.min(rawDiscount, subtotal)` clamped, regardless of whether the concurrent `.max(100)` PERCENTAGE-cap track (admin-hardening-batch plan) has landed by EXECUTE time -- re-check current state of `admin-coupons.schema.ts` at EXECUTE start, do not assume either way.
- No new DB migration -- the two-discount-line breakdown is stored in the existing `shipping_address` JSONB snapshot column only (`couponCode`, `couponDiscountAmount` fields), per the locked PLAN-level design decision.
Next phase: EXECUTE: process/features/checkout/active/coupon-checkout-integration_20-08-26/coupon-checkout-integration_PLAN_20-08-26.md
Validate contract: inline in plan (see `## Validate Contract` section above, Gate: PASS, generated-by: outer-pvl, dated 2026-08-20).
Execute start: fully-automated gates: `npm test` (targeted: coupon-validation.service, checkout.service, checkout.schema, order.repository, order-email.service, coupon/validate route) then full `npm run check`; agent-probe: checkout-page two-discount-line walkthrough + `/account` order-history coupon display walkthrough (both require explicit user confirmation before the plan can be marked VERIFIED, per Phase Completion Rules); high-risk evidence pack: yes (billing-adjacent financial calc + new authenticated endpoint) -- see `vc-risk-evidence-pack` before finalize.
