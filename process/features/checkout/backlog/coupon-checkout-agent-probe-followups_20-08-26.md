---
name: plan:coupon-checkout-agent-probe-followups-20-08-26
description: "Two outstanding Agent-Probe manual walkthroughs for the coupon-checkout-integration feature, deferred by explicit user decision at closeout — not run yet, not lost"
date: 20-08-26
feature: checkout
---

# Backlog — Coupon Checkout: Outstanding Agent-Probe Walkthroughs (20-08-26)

Source: `coupon-checkout-integration_20-08-26` (plan archived to
`process/features/checkout/completed/coupon-checkout-integration_20-08-26/`). All 19 implementation
checklist items shipped; all 13 Fully-Automated verification rows are green (independent EVL
confirmation by vc-tester, not just execute-agent's own claim). Two Agent-Probe rows from the
plan's Verification Evidence table were never walked through in a real browser session.

**Why this is backlog, not a defect:** the user was explicitly asked whether to (a) test these
themselves, (b) have an automated browser agent probe them, or (c) accept CODE DONE as sufficient
and skip the risk-evidence-pack/manual-probe step. **The user chose (c)** in the UPDATE PROCESS
session on 20-08-26. This is a deliberate, informed scope trade-off — not a process gap or an
oversight. The two items below stay **CODE DONE, NOT VERIFIED** until someone actually runs them.

## 1. Checkout page — live coupon flow walkthrough

**Priority:** Medium — user-facing checkout flow, financial-calculation-adjacent, but backed by 9
Fully-Automated tests covering the same logic at the service/schema layer (only the UI wiring and
visual rendering are unproven).

**Scope:** Open `/checkout` in a real browser with items in the cart.
1. Enter a valid, active coupon code in `CheckoutCouponField` and click "Áp dụng".
2. Confirm the applied chip appears, `CheckoutOrderSummary` shows **two separate discount lines**
   (the existing "Giảm giá (x%)" voucher-tier line AND the new "Mã giảm giá: {CODE}" line), and the
   total reflects both discounts summed.
3. Submit the order and confirm the flow reaches the success page with the correct final total.
4. Also try an invalid/expired/exhausted/below-minimum code and confirm the rejected state shows
   the server's Vietnamese `reason` message inline (no crash, no silent failure).
5. Confirm the "×" remove control on the applied chip clears the coupon and reverts the total.

**Files/routes involved:** `app/checkout/page.tsx`, `components/checkout/CheckoutForm.tsx`,
`components/checkout/CheckoutCouponField.tsx` (new), `components/checkout/CheckoutOrderSummary.tsx`,
`lib/useCheckoutCoupon.ts` (new), `POST /api/checkout/coupon/validate`
(`app/api/checkout/coupon/validate/route.ts`, new).

**Proves:** SPEC AC1, AC3–AC7 (UX surface only — the underlying rejection logic is already
Fully-Automated proven in `coupon-validation.service.test.ts`).

## 2. `/account` order history — coupon display walkthrough

**Priority:** Low — read-only display of already-persisted data; the persistence/mapping logic is
covered by `account-order.service.ts`'s existing test coverage pattern (though no new automated
test was added specifically for this render path — see note below).

**Scope:** Place (or locate) an order that had a coupon applied, then open `/account` and confirm
the compact order card in `AccountOrderList.tsx` shows the coupon code and discount amount
alongside the order's other summary details.

**Files/routes involved:** `app/(account)/account/**` (order history page),
`components/account/AccountOrderList.tsx`, `features/account/services/account-order.service.ts`
(`toAccountOrder()` reads `shipping_address.couponCode` / `couponDiscountAmount`),
`features/account/types/index.ts` (`AccountOrder` coupon fields).

**Proves:** SPEC AC5 (user-story framing) / the plan's open question 5 resolution (two-discount
breakdown surviving to order history via the `shipping_address` JSONB snapshot, not a new column).

## Also accepted as out-of-scope for this feature (not a follow-up item, documented for completeness)

- **No risk-evidence-pack was produced** for this billing-adjacent change (5-artifact schema per
  `process/development-protocols/orchestration.md` §High-Risk Execution Handoff) — same explicit
  user trade-off as above, not a silently-dropped requirement.
- **AC10** (DB-trigger race-condition guarantee under real concurrent connections) remains
  Agent-Probe/pre-existing-code scope by the plan's own design — `validate_and_apply_coupon()` was
  never modified by this feature and its `FOR UPDATE` row-lock behavior predates this work; no test
  in this plan (or any plan) re-proves DB-level race-safety under real concurrency.

## Status

Tracked here, not silently dropped. Does not block archival of the source plan — archival already
happened as CODE DONE with these two items and the risk-evidence-pack explicitly named as accepted
gaps, not oversights.
