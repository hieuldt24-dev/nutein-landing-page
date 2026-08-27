---
name: context:all-payment
description: "Self-hosted VietQR bank-transfer payment (no gateway), staff manual payment confirmation, checkout/order orchestration and stock-reservation flow -- the payment group entrypoint/router"
keywords: payment, vietqr, bank transfer, checkout, order, gateway, confirm payment, stock reservation, order code, transaction, refund, coupon, discount, voucher, payos, legacy
related: [context:all-database, context:all-email]
date: 27-08-26
---

# Payment Context

This file is the canonical payment context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs checkout, order, coupon/discount, or payment-method changes.

---

## Scope

This group covers:

- **Current (since 27-08-26): self-hosted VietQR bank-transfer payment.** No payment gateway, no
  webhook, no SDK. The checkout generates a static VietQR Quick Link QR-code image URL
  (`img.vietqr.io`) server-side from the merchant's own bank details + order amount + order
  reference; the customer transfers manually in their own banking app; a staff member marks the
  order paid by hand via a new "confirm payment received" action.
- Payment client setup and env-guarded null-safety pattern (`lib/vietqr.ts`)
- Checkout/order orchestration: stock checks, payment resolution, order-code generation
- Staff manual payment-confirmation endpoint (`POST /api/staff/orders/[id]/confirm-payment`)
- Stock reservation on order create
- Admin-managed coupon redemption at checkout (customer-entered code, server-side re-validation,
  additive stacking with the automatic voucher-tier discount) — see "Coupon checkout integration"
  below
- **Legacy (removed 27-08-26): PayOS.** PayOS could not settle to the merchant's Techcombank
  business account, so it was removed entirely — no gateway was substituted (SePay and Casso were
  both evaluated and rejected as not supporting a Techcombank business account). See "VietQR
  self-hosted payment migration" below for what changed and what intentionally stayed dormant.

It does not cover:

- General Supabase repository patterns (see `database/` group) even though `order.repository.ts` lives in `features/checkout/services/`
- Order-confirmation email sending (see `email/` group) even though the checkout service is what fires it

## Read When

Read this entrypoint when:

- adding or modifying VietQR QR generation or the staff confirm-payment flow
- changing checkout orchestration (`checkout.service.ts`) — stock checks, payment resolution, order-code generation
- working on stock reservation logic tied to order creation
- debugging a bank-transfer order stuck UNPAID, or the confirm-payment action not updating an order
- adding or modifying coupon-redemption logic at checkout, or the relationship between coupon
  discounts and the automatic voucher-tier discount
- encountering a `PAYOS` string somewhere and needing to know whether it's live or legacy-dormant
  (see "VietQR self-hosted payment migration" below)

## Quick Routing

No deeper docs yet — this entrypoint is the full content for now. Deeper docs (e.g. a dedicated PayOS-webhook-contract doc) will be added later if the payment surface grows enough to justify a split.

## Source Paths

- `lib/vietqr.ts` — server-only, `buildVietQrImageUrl()` + `getVietQrBankAccount()`; pure string-building (no network call, no SDK), nullable-return pattern (returns `null` if `VIETQR_BANK_ID`/`VIETQR_ACCOUNT_NO` unset) matching `lib/resend.ts`/`lib/supabase.ts`
- `app/api/staff/orders/[id]/confirm-payment/route.ts` — STAFF-only manual payment-confirmation endpoint (new, 27-08-26)
- `features/admin-orders/services/admin-orders.repository.ts` (`confirmPayment()`) — sets `payment_status = 'PAID'` only, atomic `WHERE payment_status = 'UNPAID'` guard against double-confirm race; never touches order `status`
- `features/checkout/services/order.repository.ts` — order persistence; `mapPaymentMethod()` writes the `BANK_TRANSFER` DB enum for the bank-transfer path (not `PAYOS`)
- `features/checkout/services/checkout.service.ts` — orchestrates stock checks, payment resolution (synchronous, no external call), order-code generation, and fires the order-confirmation email
- `supabase/migrations/20260722010000_payos_bank_transfer.sql` — legacy migration; ADDs `PAYOS` to the `PaymentMethod` enum plus `payos_order_code`/`payos_payment_link_id` columns. **Left in place, dormant, by design** — no migration was written to remove it (see "VietQR self-hosted payment migration" below)
- `supabase/migrations/20260724000000_reserve_stock_on_order_create.sql` — stock reservation on order create
- `app/checkout/success/page.tsx` + `components/checkout/CheckoutSuccessView.tsx` — post-order success page; renders the QR image + static "awaiting manual confirmation" copy (no live-status polling)
- `components/admin/orders/AdminOrderDetail.tsx` — staff "Xác nhận đã nhận thanh toán" confirm-payment button
- `components/admin/orders/AdminOrdersList.tsx` — "Chờ xác nhận CK" badge on unpaid bank-transfer rows
- `components/account/AccountOrderList.tsx` — customer-facing payment-status badge (PAID/UNPAID) in `/account` order history
- `features/checkout/services/coupon-validation.service.ts` — single source of truth for coupon
  discount computation and rejection rules (not found / inactive / expired / usage-exhausted /
  below `min_order_value`), called from both the preview route and `checkout.service.ts`
- `app/api/checkout/coupon/validate/route.ts` — UX-only preview endpoint (auth + rate-limited via
  `couponPreviewLimiter`); its response is never trusted or persisted directly
- `features/admin-coupons/services/admin-coupons.repository.ts` (`findByCode()`) — read-only
  coupon lookup, reused from checkout (no admin-coupons methods were modified for this)
- `components/checkout/CheckoutCouponField.tsx` + `lib/useCheckoutCoupon.ts` — checkout-page
  coupon input UI + client hook
- `supabase/migrations/20260718000000_init_schema.sql` lines 209-220 (coupons table), 236-263
  (orders table + `coupon_id` FK), 603-632 (`validate_and_apply_coupon()` trigger — the race-safe
  final authority at insert time, `FOR UPDATE` row lock; never modified by the app-layer wiring)

## Update Triggers

Update this group when:

- the payment method changes again, or a payment gateway is (re-)introduced
- VietQR param shape, bank details, or the confirm-payment flow changes
- stock reservation timing or rules change (e.g. reservation TTL, release-on-cancel logic)
- required `VIETQR_*` env vars change
- coupon-redemption rules, the coupon/voucher-tier stacking relationship, or the preview-endpoint
  contract change

## Canonical Notes

- **Payment method (since 27-08-26): self-hosted VietQR bank transfer.** No gateway, no SDK, no
  webhook. `lib/vietqr.ts` builds a static `img.vietqr.io` QR-code image URL server-side from
  env-configured merchant bank details + the order's amount/reference — follows the same
  env-guarded null-safety pattern as other integration clients in this codebase (compare
  `lib/supabase.ts`, `lib/resend.ts`): returns `null` if `VIETQR_BANK_ID`/`VIETQR_ACCOUNT_NO` are
  unset, so callers must null-check.
- **Payment confirmation is manual/staff-driven, not automatic.** There is no webhook and no
  live-status poll. A bank-transfer order stays `payment_status = UNPAID` indefinitely (no TTL/
  auto-expiry, by explicit design decision) until a staff member clicks "Xác nhận đã nhận thanh
  toán" on the order detail page, which calls `confirmPayment()` — an atomic, race-guarded UPDATE
  scoped to `payment_status` only (never touches order `status`).
- `checkout.service.ts` is the orchestration hub: it runs stock checks, resolves payment (now pure/
  synchronous — no `await`, no network call), generates the order code, persists via
  `order.repository.ts`, and fires the order-confirmation email (best-effort, non-blocking, fires
  regardless of payment status — see `email/` group for the email mechanism).
- Stock reservation on order create (migration `20260724000000_reserve_stock_on_order_create.sql`) is coupled to the checkout flow — changes to checkout timing or order-cancellation logic should account for reservation release.

### VietQR self-hosted payment migration (landed 27-08-26)

- **Why:** PayOS could not settle to the merchant's Techcombank business account. SePay and Casso
  were both evaluated and rejected (neither reliably supports a Techcombank business account).
  Decision: drop gateways entirely, generate VietQR QR codes directly against the merchant's own
  bank account, and make payment confirmation a manual staff action.
- **What changed:** `lib/payos.ts`, `payos.service.ts` (+test), `payos.schema.ts` (+test), and the
  3 PayOS API routes (`webhook`/`status`/`retry`) were all deleted. `order.repository.ts`'s
  `mapPaymentMethod()` now writes the `BANK_TRANSFER` DB enum for the bank-transfer path (was
  `PAYOS`). The `@payos/node` npm dependency was removed from `package.json`.
- **What was intentionally left dormant, NOT cleaned up:** the `PAYOS` value in the `PaymentMethod`
  DB enum, and the `orders.payos_order_code`/`orders.payos_payment_link_id` columns (migration
  `20260722010000_payos_bank_transfer.sql`) — no new migration was written to drop them, so
  historical pre-migration orders with `payment_method = 'PAYOS'` still read correctly. 3 files
  deliberately still contain the string `"PAYOS"` in a **read-only** type union / display-label
  map, each with an explicit code comment marking the read/write asymmetry — do not "clean up"
  these, they are correct as-is:
  - `features/checkout/services/order.repository.ts` (`DbPaymentMethod` read-only union)
  - `features/account/services/account-order.service.ts` (`OrderListRow` read-only union)
  - `features/admin-orders/services/admin-orders.repository.ts` (`PAYMENT_METHOD_LABEL` display map)
- **Env vars:** `VIETQR_BANK_ID`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `VIETQR_TEMPLATE`
  (server-only, no `NEXT_PUBLIC_` prefix) replace the `PAYOS_*` block in `.env.example`.
- **AC7 gap found via manual (not agent) walkthrough:** the backend correctly computed
  `order.paymentStatus` (unit-tested, passing) but no UI component actually rendered it in
  `/account` — `AccountOrderList.tsx` never displayed the field. A narrow service-level automated
  test passed while the user-visible behavior the acceptance criterion actually cares about was
  broken. Fixed via the QUICK FIX lane: added a payment-status badge to `AccountOrderList.tsx`
  (PAID → "Đã thanh toán", UNPAID → "Chưa thanh toán"), matching the existing
  `AccountOrderStatusBadge` visual pattern. No dedicated test file exists for this component — see
  `process/context/tests/all-tests.md` Known Gaps.
- **Why an agent couldn't run the 3 mandatory Agent-Probe walkthroughs itself:** see "OAuth-only
  auth blocks browser automation" in `process/context/tests/all-tests.md` — this repo has no test
  credentials or dev-login bypass, so no browser-automation session could authenticate. The user
  performed all 3 walkthroughs manually instead, and found the AC7 gap above in the process —
  exactly the kind of gap Agent-Probe walkthroughs exist to catch.
- Source plan (archived): `process/features/checkout/completed/vietqr-self-hosted-payment_27-08-26/`.

### Fixes landed 19-08-26 (production-readiness review)

- **Orphaned PayOS link cancellation:** `createOrder()` in `checkout.service.ts` now wraps
  `orderRepository.create()` in try/catch. If order-row creation fails AFTER a non-COD PayOS payment
  link was already created (`payosOrderCode` defined), it calls
  `payosService.cancelPaymentLink(payosOrderCode, "order_create_failed")` inside its OWN inner
  try/catch (log-only on cancel failure — never masks or replaces the original error), then rethrows
  the original `create()` error. COD path (`payosOrderCode` undefined) is completely unaffected.
- **Oversell guard NaN-bypass fixed:** the `availableStock` selection in `createOrder()` now checks
  `stockResult && Number.isFinite(stockResult.stock)` instead of a truthiness-only ternary. Previously
  a NaN/non-finite `stock` value from `refreshProductCatalogServer()` (e.g. a null DB column converted
  via `Number(row.stock)`) was truthy-but-invalid, and `requestedUnits > NaN` was always `false` —
  silently defeating the oversell check. It now falls back to `orderRepository.getAvailableStock()`,
  same as the null-`stockResult` case, with no added DB round-trip on the common valid-stock path.
- **Internal error detail no longer leaks to clients:** `payos.service.ts`'s `requirePayosClient()`
  and `app/api/staff/uploads/route.ts`'s upload-failure and `isCloudinaryConfigured` guard-clause
  errors now use `InternalServerError`'s two-arg form (`message, details`) — a generic client-facing
  message plus the real diagnostic string moved into `details` (server-log-only, not in the response
  body). `src/middlewares/error-handler.middleware.ts`'s `AppError` branch now logs `error.details`
  too, so the diagnostic detail isn't silently dropped from server logs by this change.
- See `process/general-plans/backlog/infra-followups-19-08-26.md` for the non-blocking Redis
  production-provisioning follow-up tied to rate limiting on checkout-adjacent auth routes.

### Coupon checkout integration (landed 20-08-26)

- **`orders.coupon_id` is now actually set on insert.** Before this change, staff could create
  coupons in the admin panel but no application code ever wrote `coupon_id` on order creation, so
  the DB trigger `validate_and_apply_coupon()` (see Source Paths above) was dormant. It is now the
  race-safe final authority every time a customer redeems a coupon: it locks the coupon row
  `FOR UPDATE`, re-checks active/expiry/usage, and atomically increments `used_count`. It was
  **never modified** by this feature — the app layer only pre-validates for UX before ever
  reaching the insert.
- **Two-layer validation, by design.** The app layer (`coupon-validation.service.ts`) checks
  `is_active`, `expires_at`, `usage_limit` vs `used_count`, and `min_order_value` against the
  **pre-discount** cart subtotal (`cartSummary.subtotal`, not `.total`). The DB trigger does NOT
  check `min_order_value` — that check is app-layer-only. `checkoutService.createOrder()` always
  re-resolves and re-validates the coupon fresh from the DB immediately before order creation; the
  preview endpoint's result is UX-only and is never trusted or persisted as pre-validated input.
- **Preview endpoint is an enumeration-oracle risk if unthrottled.** `POST
  /api/checkout/coupon/validate` requires `authenticate(req)` AND a rate limiter
  (`couponPreviewLimiter`, 20/15min/IP — sized like `emailStatusLimiter`) as the first guard
  clause, in that order. Do not reuse `globalLimiter` for this endpoint (too loose — 1000/15min).
- **Additive stacking with the voucher-tier discount, always.** `features/cart/pricing.ts` /
  `VOUCHER_TIERS` (the automatic bundle discount) is completely untouched and out of scope for
  coupons. `checkoutService.createOrder()` computes
  `discount_amount = cartSummary.discountAmount (voucher-tier) + couponDiscountAmount` — the two
  discounts always sum, never override each other. The coupon discount itself is defensively
  clamped `Math.min(rawDiscount, subtotal)` for both `FIXED` and `PERCENTAGE` coupon types,
  independent of whether `admin-coupons.schema.ts`'s `.max(100)` PERCENTAGE cap (a separate,
  concurrently-landed hardening track) is in place.
- **No new migration.** The two-discount-line breakdown needed for order-confirmation emails and
  `/account` order history is stored in the existing `orders.shipping_address` JSONB snapshot
  column (`couponCode`, `couponDiscountAmount` — additions to the already-existing
  `OrderShippingAddressSnapshot` shape), not a new column. `orders.discount_amount` remains the
  single combined total; only the JSONB snapshot carries the coupon-specific breakdown.
- **One coupon per order.** `createOrderRequestSchema`'s `couponCode` is a single optional string
  — structurally cannot carry more than one code.
- Source plan (archived): `process/features/checkout/completed/coupon-checkout-integration_20-08-26/`.
  Two Agent-Probe UI walkthroughs (checkout-page live flow, `/account` order-history coupon
  display) were explicitly deferred by user decision at closeout — see
  `process/features/checkout/backlog/coupon-checkout-agent-probe-followups_20-08-26.md`.
