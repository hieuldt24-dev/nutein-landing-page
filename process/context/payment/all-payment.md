---
name: context:all-payment
description: "PayOS gateway integration, checkout/order orchestration, webhook and stock-reservation flow -- the payment group entrypoint/router"
keywords: payment, payos, checkout, order, webhook, gateway, bank transfer, stock reservation, retry, order code, transaction, refund, coupon, discount, voucher
related: [context:all-database, context:all-email]
date: 20-08-26
---

# Payment Context

This file is the canonical payment context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs checkout, order, coupon/discount, or payment-gateway changes.

---

## Scope

This group covers:

- PayOS (`@payos/node`) as the payment provider — a Vietnamese payment gateway
- Payment client setup and env-guarded null-safety pattern
- Checkout/order orchestration: stock checks, payment resolution, order-code generation
- PayOS webhook, status, and retry routes
- Stock reservation on order create
- Admin-managed coupon redemption at checkout (customer-entered code, server-side re-validation,
  additive stacking with the automatic voucher-tier discount) — see "Coupon checkout integration"
  below

It does not cover:

- General Supabase repository patterns (see `database/` group) even though `order.repository.ts` lives in `features/checkout/services/`
- Order-confirmation email sending (see `email/` group) even though the checkout service is what fires it

## Read When

Read this entrypoint when:

- adding or modifying PayOS webhook, status, or retry handling
- changing checkout orchestration (`checkout.service.ts`) — stock checks, payment resolution, order-code generation
- working on stock reservation logic tied to order creation
- debugging a payment stuck in an unexpected state, or a webhook not updating an order
- adding or modifying coupon-redemption logic at checkout, or the relationship between coupon
  discounts and the automatic voucher-tier discount

## Quick Routing

No deeper docs yet — this entrypoint is the full content for now. Deeper docs (e.g. a dedicated PayOS-webhook-contract doc) will be added later if the payment surface grows enough to justify a split.

## Source Paths

- `lib/payos.ts` — server-only client init; exports a nullable `payos` client (null if `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` unset) plus `appBaseUrl` for return/cancel URLs
- `features/checkout/services/payos.service.ts` (+ test) — domain service wrapping the PayOS client
- `features/checkout/schemas/payos.schema.ts` (+ test) — payload validation
- `app/api/checkout/payos/webhook/route.ts` — payment confirmation webhook
- `app/api/checkout/payos/status/route.ts` — payment status check
- `app/api/checkout/payos/retry/route.ts` — payment retry
- `features/checkout/services/order.repository.ts` — order persistence
- `features/checkout/services/checkout.service.ts` — orchestrates stock checks, payment resolution, order-code generation, and fires the order-confirmation email
- `supabase/migrations/20260722010000_payos_bank_transfer.sql` — PayOS bank-transfer schema
- `supabase/migrations/20260724000000_reserve_stock_on_order_create.sql` — stock reservation on order create
- `app/checkout/success/page.tsx` — post-payment success page
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

- the payment provider changes or a second gateway is added
- webhook payload shape, signature verification, or retry logic changes
- stock reservation timing or rules change (e.g. reservation TTL, release-on-cancel logic)
- required PayOS env vars change
- coupon-redemption rules, the coupon/voucher-tier stacking relationship, or the preview-endpoint
  contract change

## Canonical Notes

- Provider: PayOS (`@payos/node`), a Vietnamese payment gateway — confirmed across 16 files in this scan.
- `lib/payos.ts` follows the same env-guarded null-safety pattern as other integration clients in this codebase (compare `lib/supabase.ts`, `lib/resend.ts`): the `payos` client is `null` if `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` are unset, so callers must null-check before use rather than assuming the client always exists.
- `checkout.service.ts` is the orchestration hub: it runs stock checks, resolves payment, generates the order code, persists via `order.repository.ts`, and fires the order-confirmation email (best-effort, non-blocking — see `email/` group for the email mechanism).
- Stock reservation on order create (migration `20260724000000_reserve_stock_on_order_create.sql`) is coupled to the checkout flow — changes to checkout timing or order-cancellation logic should account for reservation release.

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
