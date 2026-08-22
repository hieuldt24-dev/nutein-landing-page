---
name: spec:coupon-checkout-integration
description: "Requirements for wiring admin-managed coupons into checkout order creation — customer-entered code, server-side validation, additive stacking with existing voucher-tier discount"
date: 20-08-26
feature: checkout
---

# SPEC — Coupon Checkout Integration

## Summary

Today, staff can create and manage discount coupons in the admin panel, and the database already
has everything wired up to enforce them safely (a dormant trigger that checks a coupon is real,
active, not expired, and not over its usage limit, then counts the redemption) — but a customer can
never actually use one. There is no place on the site to type a coupon code, and the order-creation
code never tells the database which coupon to apply. This work closes that gap: a customer types a
coupon code at checkout, sees the discount reflected in their total before they pay, and the order
is only created if that coupon is genuinely valid at that moment. The coupon discount adds on top of
the existing automatic bundle/voucher-tier discount — it does not replace it.

## User Stories / Jobs To Be Done

1. **As a customer checking out**, I want to enter a coupon code and see my order total drop by the
   right amount, so that I know the discount will actually be honored before I pay.

2. **As a customer entering an invalid, expired, inactive, or fully-redeemed coupon code**, I want
   to see a clear message explaining why the code did not work, so that I'm not confused about why
   my total didn't change and I can decide whether to remove it, retry, or pay full price.

3. **As a customer whose order doesn't meet a coupon's minimum order value**, I want to be told the
   minimum required, so that I understand what I'd need to add to qualify.

4. **As a customer who already qualifies for the automatic bundle/voucher-tier discount**, I want my
   coupon to add further savings on top of that, so that stacking naturally rewards larger orders —
   without needing to choose one discount over the other.

5. **As a customer reviewing my order confirmation email or order history**, I want to see that a
   coupon was applied to my order (and roughly how much it saved me), so that my receipt matches
   what I paid.

6. **As a store operator**, I want the database's existing safety checks (real code, active, not
   expired, under usage limit) to be the final word on whether a coupon is honored — even if the
   checkout page's client-side check said it was fine — so that a customer can never race their way
   into an unauthorized discount or double-spend a single-use code.

## What The User Wants (Behavioral Outcomes)

- A coupon code entry field is visible on the checkout page, positioned right before the customer
  confirms and pays — not in the cart drawer.
- Entering a valid code updates the visible order total (and the visible discount breakdown) before
  the customer submits the order — this is a convenience preview, not the final word.
- The coupon discount is additive: it is added to whatever automatic bundle/voucher-tier discount
  already applies to the cart. The customer never has to pick one discount over the other, and the
  existing automatic discount behavior does not change.
- Only one coupon code can be attached to a single order (matches the one-coupon-per-order shape
  already built into the order record).
- If the code the customer entered turns out to be invalid at the exact moment the order is placed
  (someone else just used the last redemption, it expired seconds ago, staff deactivated it, etc.),
  the order is **not** silently created without the discount — the customer sees a clear rejection
  and the order is not placed until they remove the bad code or accept paying without a discount.
  Nothing about the checkout process is allowed to "fail silently" and quietly charge full price
  while the customer believed a discount applied.
- Every acceptance/rejection message the customer sees explains *why* (bad code, expired, inactive,
  used up, order too small) — not a generic "something went wrong."
- Once an order is placed with a coupon, the applied coupon and its discount amount are visible on
  the order confirmation email and wherever the customer can review that order afterward (order
  history / order detail).
- A staff member managing coupons in the admin panel sees no change to their existing
  create/edit/list workflow — this work only adds the customer-facing "spend" side.

## Flow / State Diagram

```
CHECKOUT PAGE
  │
  ▼
[Customer fills shipping/payment info]
  │
  ▼
[Coupon code field — optional]
  │
  ├─ No code entered ─────────────────────────────────────────► existing flow, unchanged
  │
  └─ Code entered
        │
        ▼
   [Client-side preview check] ── convenience only, never the final gate
        │
        ├─ Looks valid ──► total updates to show voucher-tier + coupon discount, both summed
        │
        └─ Looks invalid ──► inline message shown; customer can edit/remove code
        │
        ▼
   [Customer clicks "Place order"]
        │
        ▼
   SERVER: checkout order-creation
        │
        ▼
   [Server re-validates coupon against live DB state]
        │
        ├─ VALID (active, not expired, under usage limit, order ≥ min_order_value)
        │     │
        │     ▼
        │  order created with coupon_id set
        │     │
        │     ▼
        │  DB trigger locks the coupon row, re-checks the same conditions,
        │  increments used_count atomically — race-safe even if two customers
        │  submit the last redemption of a limited coupon at the same instant
        │     │
        │     ▼
        │  order total = subtotal − (voucher-tier discount + coupon discount) + shipping
        │     │
        │     ▼
        │  confirmation email + order history show the applied coupon
        │
        └─ INVALID (bad code / expired / inactive / usage exhausted / below min_order_value
             / lost the race to another customer)
                  │
                  ▼
             order is NOT created.
             Customer sees a specific rejection reason.
             Customer may remove the code and resubmit, or fix the order to qualify.
```

## Acceptance Criteria (Testable Outcomes)

1. **A customer who enters a valid, active coupon code at checkout sees the order total reduced by
   the coupon's discount amount before submitting payment.**
   proven by: new checkout order-creation service test asserting `discount_amount` includes the
   coupon's discount when a valid `couponCode`/`couponId` is supplied.
   strategy: Fully-Automated

2. **An order is only created with a coupon applied if the coupon is validated against the database
   at the moment of order creation — not merely trusted from an earlier client-side check.**
   proven by: checkout order-creation service test that simulates a coupon that was valid at
   page-load time but has since become invalid (deactivated/expired/exhausted) and asserts order
   creation fails, no order row is written, and no discount is silently dropped in.
   strategy: Fully-Automated

3. **An invalid or nonexistent coupon code is rejected with a clear reason, and no order is created
   using that code.**
   proven by: checkout order-creation service test for an unknown `couponCode` — asserts a
   descriptive error is thrown/returned and `orderRepository.create` is never called with that
   code attached.
   strategy: Fully-Automated

4. **An expired coupon is rejected with a message indicating it has expired.**
   proven by: checkout order-creation service test using a coupon row with `expires_at` in the
   past.
   strategy: Fully-Automated

5. **A deactivated (`is_active = false`) coupon is rejected.**
   proven by: checkout order-creation service test using a coupon row with `is_active = false`.
   strategy: Fully-Automated

6. **A coupon that has already reached its `usage_limit` is rejected on the next attempted use.**
   proven by: checkout order-creation service test using a coupon row where `used_count >=
   usage_limit`.
   strategy: Fully-Automated

7. **An order that does not meet a coupon's `min_order_value` is rejected with a message stating
   the minimum required.**
   proven by: checkout order-creation service test where cart subtotal is below the coupon's
   `min_order_value`.
   strategy: Fully-Automated

8. **When both the automatic bundle/voucher-tier discount and a coupon apply to the same order,
   both discounts are summed into the order's total discount — neither one is dropped or
   overridden by the other.**
   proven by: checkout order-creation service test with a cart that qualifies for a non-zero
   `cartSummary.discountAmount` (voucher-tier) AND a valid coupon, asserting
   `order.discount_amount = voucherTierDiscount + couponDiscount` and `final_price` matches the
   existing `CHECK` formula.
   strategy: Fully-Automated

9. **Only one coupon can be attached to a single order — the checkout request shape has no way to
   submit more than one coupon code.**
   proven by: checkout request schema test asserting the coupon field is a single optional string
   (or single optional coupon identifier), not an array/list.
   strategy: Fully-Automated

10. **Two customers racing to redeem the last remaining use of a limited coupon cannot both
    succeed — only one order is created with that coupon attached; the second is rejected.**
    proven by: this relies on the existing `validate_and_apply_coupon()` trigger's row-level lock
    (`FOR UPDATE`), which is not being modified by this work. Automated coverage is limited to
    confirming the application layer surfaces the trigger's rejection error correctly (see AC2/AC3
    style test); the underlying concurrency guarantee itself is an existing, already-shipped DB
    mechanism outside this feature's blast radius and is not practical to re-prove with a live
    concurrent-connections test in this suite.
    strategy: Agent-Probe (verifies the app layer surfaces a `FOR UPDATE`-triggered rejection
    correctly; the DB-level race guarantee itself is pre-existing and out of this feature's scope
    to re-verify)

11. **The order confirmation email shows that a coupon was applied and the resulting discount
    amount when a coupon was used on that order.**
    proven by: `order-email.service.test.ts` addition asserting the rendered HTML includes a
    coupon-specific line/indicator when `order.summary` carries coupon data, absent when it does
    not.
    strategy: Fully-Automated

12. **A staff member's existing coupon create/edit/list workflow in the admin panel is unaffected
    by this change.**
    proven by: existing `admin-coupons.repository.test.ts` / `admin-coupons.service` test suite
    continuing to pass unmodified (regression gate, not new coverage).
    strategy: Fully-Automated

## Out Of Scope

- Modifying `features/cart/pricing.ts` or the `VOUCHER_TIERS` mechanism in any way. That system
  stays exactly as it is; coupons are purely additive to it.
- Supporting more than one coupon per order (multi-coupon stacking, coupon combos).
- Any redesign of the existing admin coupon management UI (`components/admin/coupons/**`) —
  it already exists and works; this SPEC only adds the customer-facing redemption path.
- Retroactively applying a coupon to an order that has already been placed.
- Any coupon auto-suggestion, recommendation, or "you qualify for X" upsell messaging.
- Adding a coupon-code entry point anywhere other than the checkout page (no cart-drawer entry,
  no product-page entry).
- Changing the underlying `validate_and_apply_coupon()` database trigger's validation logic or
  locking behavior — this work is about reaching that trigger, not modifying it.
- The concurrent percentage-discount upper-bound (`.max(100)` cap on admin coupon `discount` for
  `PERCENTAGE` type) — that is owned by a separate, concurrently-run fix track and is not part of
  this SPEC's deliverable, though this SPEC's acceptance criteria may rely on that cap already
  existing.

## Constraints

- **Additive stacking only** (user-locked decision): coupon discount and voucher-tier discount both
  apply and sum; they are never mutually exclusive, and neither can be configured to override the
  other as part of this work.
- **One coupon per order** (user-locked decision): matches the existing single-FK `orders.coupon_id`
  column — no new migration or junction table is needed or in scope for this constraint.
- **UI placement: checkout page only** (user-locked decision): the coupon code input lives on
  `app/checkout/**`, right before order submission — not the cart drawer.
- **Server-side validation is authoritative.** Any client-side coupon check is UX-only (a preview).
  The real enforcement point is order creation in `checkout.service.ts`'s `createOrder()`, backed by
  the existing `validate_and_apply_coupon()` trigger. The trigger is not to be modified.
- **No silent degrade.** If a coupon becomes invalid between the time the customer saw the preview
  discount and the time the order is submitted, order creation must fail with a clear reason — it
  must never silently proceed and create the order without the discount while implying to the
  customer that it applied.
- **No new migration required for the coupon-application flow itself** — `orders.coupon_id`,
  `orders.discount_amount`, and the validating trigger already exist and are unmodified by this
  constraint set.
- Must follow the existing repository/service split pattern
  (`features/{name}/services/{name}.repository.ts` + `{name}.service.ts`) and the existing
  Zod-schema-first validation convention used throughout `features/checkout/schemas/`.
- Vietnamese-language customer-facing messaging, consistent with all existing checkout/coupon
  strings (e.g. the trigger's own error text: "Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa",
  "Mã giảm giá đã hết hạn", "Mã giảm giá đã hết lượt sử dụng").

## Open Questions

The following are UX/behavioral-detail questions, not core intent ambiguity — none of them change
which user story or acceptance criterion above is true, only how a resolved detail is presented.
Per explicit instruction accompanying this SPEC request, they are recorded here as non-blocking and
handed to INNOVATE to resolve alongside the "how" of implementation, rather than being silently
decided in this document.

1. **Exact customer-facing rejection wording for each failure case at checkout** (invalid code,
   expired, inactive, usage exhausted, below `min_order_value`). The DB trigger already has
   Vietnamese error text for three of these; whether checkout re-uses that text verbatim or crafts
   more UI-appropriate copy is undecided. Owner: INNOVATE.

2. **Whether `min_order_value` is checked against the cart subtotal before or after the
   voucher-tier discount is applied.** This affects edge cases where a customer is just above the
   minimum on subtotal but would fall below it after the automatic discount. Owner: INNOVATE.

3. **How the customer visually sees two discounts (voucher-tier + coupon) that sum server-side** —
   as two separate line items ("Giảm giá theo mức mua" + "Mã giảm giá") or one combined "Giảm giá"
   line — in the checkout summary, order confirmation email, and order history/order detail. Owner:
   INNOVATE.

4. **Whether the checkout page needs a "remove coupon" affordance** once a code has been
   successfully applied, or whether editing/clearing the input field is sufficient. Owner: INNOVATE.

5. **Where order history/order detail (customer account area) currently renders order money
   summaries, and whether that surface needs a new field or can reuse the existing discount
   display** — this SPEC assumes such a surface exists (per user story 5) but its exact current
   shape was not traced in RESEARCH. Owner: INNOVATE (confirm and design against the actual
   component).

## Background / Research Findings

Key facts from the completed RESEARCH pass that shaped the requirements above:

- **The schema was built for this from day one.** `coupons` (with `discount_type`, `discount`,
  `min_order_value`, `usage_limit`, `used_count`, `is_active`, `expires_at`) and `orders.coupon_id`
  / `orders.discount_amount` (with a `CHECK (final_price = total_price + shipping_fee -
  discount_amount)` constraint) already exist
  (`supabase/migrations/20260718000000_init_schema.sql:209-220, 236-257`).
- **A real, race-safe enforcement trigger already exists and is dormant, not missing.**
  `validate_and_apply_coupon()` (same migration, lines 599-632) runs `BEFORE INSERT ON orders`,
  locks the referenced coupon row (`FOR UPDATE`), rejects not-found/inactive/expired/
  usage-exhausted coupons, and atomically increments `used_count`. It has simply never been
  reached because no application code sets `coupon_id` on insert.
- **Coupons and the voucher-tier system are confirmed separate mechanisms.**
  `features/cart/pricing.ts`'s `VOUCHER_TIERS`/`VoucherProgress` is hardcoded, DB-less, and applies
  automatically with no customer-entered code — it must not be modified or conflated with coupons.
- **The gap is entirely on the application side.** `features/admin-coupons/**` is pure CRUD (no
  `applyCoupon`/`validateCode`/`redeemCoupon` method, no "apply to order" Zod schema).
  `checkout.service.ts`'s `createOrder()` computes `discount_amount` solely from
  `cartSummary.discountAmount` and has no `couponId`/`couponCode` field anywhere in
  `CreateOrderRequest` or `CreateOrderResult`. No coupon-code input UI exists anywhere on the public
  site (confirmed via grep).
- **Email already has a discount line, but it's generic.** `order-email.service.ts` renders one
  "Giảm giá" line from `order.summary.discountAmount` — no coupon-specific breakdown exists yet.
- **A concurrent, separately-owned fix track** is adding a `.max(100)` cap to
  `admin-coupons.schema.ts`'s `discount` field for `PERCENTAGE` type — not part of this SPEC's
  deliverable, but this SPEC's acceptance criteria may rely on that cap already being in place.
- **Test infrastructure:** this repo has Vitest only — no Playwright/e2e suite exists
  (`process/context/tests/all-tests.md`). All "Fully-Automated" acceptance-criteria strategies above
  map to new/extended Vitest service-layer tests, matching the existing pattern of mocking the
  Supabase client at the module boundary. The one criterion needing true concurrent-DB-connection
  proof (AC10, the race condition) is marked Agent-Probe because that would require live concurrent
  connections outside what this repo's mocked-Supabase-client Vitest suite can exercise — and the
  underlying DB guarantee itself is pre-existing, unmodified code.
- **User-locked scope decisions** (already confirmed, not re-litigated in this SPEC): additive
  stacking, one coupon per order, checkout-page UI placement — see `## Constraints` above.
