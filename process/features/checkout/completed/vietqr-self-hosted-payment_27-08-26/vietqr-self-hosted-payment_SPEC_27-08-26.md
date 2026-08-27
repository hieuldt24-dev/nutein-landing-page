---
name: spec:vietqr-self-hosted-payment
description: "Replace PayOS with a self-hosted, gateway-free VietQR bank-transfer payment method — no webhook, staff manually confirm payment"
date: 27-08-26
feature: checkout
---

# SPEC — Self-Hosted VietQR Bank Transfer (PayOS Replacement)

## Summary

PayOS cannot settle to the merchant's Techcombank business account, so it has to go. Instead of
swapping in another third-party payment gateway (SePay and Casso were both tried and rejected —
neither reliably supports a Techcombank business account today), the checkout will generate a
VietQR payment QR code directly, using the merchant's own bank details and VietQR's free, no-login
image service. The customer scans the QR and transfers the money themselves, outside the app.
Because there is no gateway involved, there is also no automatic "payment received" signal — a
staff member will look at the transfer and mark the order as paid by hand. This trades away
automatic payment confirmation in exchange for removing PayOS entirely and having a payment method
that works with the merchant's actual bank account.

## User Stories / Jobs To Be Done

1. **As a customer checking out**, I want to choose "bank transfer" and see a QR code with the
   right amount and my order reference already filled in, so that I can pay by scanning it in my
   banking app without typing anything by hand.

2. **As a customer who has just paid**, I want to see my order in "awaiting confirmation" status
   right after checkout (not stuck on a broken payment page), so that I know my order was placed
   and I know what to expect next.

3. **As a customer checking my order history**, I want to see my bank-transfer order's payment
   status change from "awaiting confirmation" to "paid" once staff have confirmed my transfer, so
   that I have confidence my payment was received.

4. **As a staff member managing orders**, I want to see which orders are bank-transfer orders still
   waiting for payment confirmation, so that I can check the bank account and know which ones to
   look for.

5. **As a staff member who has confirmed a transfer landed in the bank account**, I want to mark
   that specific order as "payment received" with one action, so that the customer's order history
   and the order's fulfillment status reflect reality.

6. **As the business owner**, I want checkout to keep working for customers with zero dependency on
   any third-party payment gateway, so that a gateway's business-account restrictions can never
   block a sale again.

## What The User Wants (Behavioral Outcomes)

- At checkout, "bank transfer" remains an available payment method alongside COD (cash on
  delivery). Selecting it no longer redirects to or depends on an external payment gateway page.
- After placing a bank-transfer order, the customer is shown a QR code (generated for the
  merchant's own bank account) that already encodes the exact order amount and a reference the
  merchant can match back to the order. The customer transfers manually using their own banking
  app.
- The order is created immediately, the same as today — nothing about *when* an order is created
  or how stock is reserved changes.
- Immediately after placing the order, the customer sees a confirmation view telling them the order
  is placed and payment is awaiting confirmation — not a spinner or live status poll waiting on a
  webhook that will never arrive.
- Order-confirmation email still sends immediately on order creation, unchanged, regardless of
  payment status (this already happens for every order today).
- Staff get a way to see which bank-transfer orders have not yet had their payment confirmed, and a
  one-action way to mark a specific order's payment as received. Once marked, the change is visible
  both in the admin order view and in the customer's own order history.
- An unconfirmed bank-transfer order stays UNPAID indefinitely — there is no automatic expiry or
  cancellation. This matches how the app already behaves today (no order in this system has ever
  auto-expired); an order only leaves UNPAID when a customer places a new order attempt or a staff
  member manually cancels/confirms it.
- Nothing about this changes how COD orders behave.

## Flow / State Diagram

### Customer checkout flow (happy path)

```
Cart → Checkout form → Select payment method
                              │
              ┌───────────────┴───────────────┐
              │                                │
             COD                        Bank Transfer (VietQR)
              │                                │
      Order created (UNPAID)          Order created (UNPAID,
              │                     payment_method = BANK_TRANSFER)
     Confirmation screen:            Confirmation screen:
     "Pay on delivery"              QR code shown (amount +
              │                      order ref pre-filled)
              │                                │
              │                     Customer scans QR in their
              │                     own banking app, transfers
              │                     manually (outside this app)
              │                                │
              └───────────────┬────────────────┘
                               │
                     Order-confirmation email sent (always, on order creation)
```

### Payment-status state machine (bank transfer)

```
                 order created
                       │
                       ▼
              ┌─────────────────┐
              │      UNPAID      │  ◄── customer sees "awaiting confirmation"
              │ (awaiting staff  │       staff sees this order in a
              │  confirmation)   │       "needs confirmation" list
              │                  │
              │  No TTL / no     │  ◄── LOCKED DECISION: stays UNPAID
              │  auto-expiry —   │       indefinitely if never confirmed,
              │  sits here until │       same as today's behavior. No new
              │  a human acts    │       expiry/cron logic is added.
              └─────────────────┘
                       │
       staff manually checks bank account,
       sees the transfer landed, clicks
       "confirm payment received" on this
       order in the admin order view
                       │
                       ▼
              ┌─────────────────┐
              │       PAID       │  ◄── customer's /account order history
              │                  │       now shows this order as paid
              └─────────────────┘

  (No automatic transition. Nothing moves UNPAID → PAID except the staff action above.
   Compare to today's COD flow, where PAID is set automatically as a side effect of
   marking an order "delivered" — that automatic linkage does not exist for bank
   transfer, and this SPEC does not add one.)
```

## Acceptance Criteria (Testable Outcomes)

1. **A customer selecting "bank transfer" at checkout sees a QR code for the merchant's own bank
   account, with the correct order amount and a matching order reference, with no dependency on
   any third-party payment gateway.**
   proven by: route-handler/component test asserting the QR image URL/props are built from the
   merchant's configured bank details (read from environment variables) + the created order's
   amount and reference, with no call to any PayOS/gateway module.
   strategy: Fully-Automated

2. **Placing a bank-transfer order still creates the order and reserves stock exactly as it does
   today (unaffected by this change).**
   proven by: existing order-creation / stock-reservation service tests continue to pass
   unmodified for the bank-transfer path.
   strategy: Fully-Automated

3. **After placing a bank-transfer order, the customer is shown an "order placed, payment awaiting
   confirmation" confirmation view — not a spinner, error, or broken page from removed
   webhook/polling logic.**
   proven by: component/integration test on the post-checkout confirmation view for the
   bank-transfer path, plus one Agent-Probe manual walkthrough of the live checkout screen.
   strategy: Hybrid

4. **A bank-transfer order's payment status starts as UNPAID/awaiting-confirmation and never
   transitions to PAID automatically — only an explicit staff action changes it, and it never
   auto-expires or auto-cancels.**
   proven by: service-level test that creating and even progressing a bank-transfer order through
   non-payment status changes never flips `payment_status` to PAID without the new staff
   confirmation action being called, and that no cron/expiry job exists that touches
   bank-transfer orders.
   strategy: Fully-Automated

5. **Staff can see, in the admin order view, which bank-transfer orders are still awaiting payment
   confirmation.**
   proven by: route-handler/repository test confirming the admin order list/detail surfaces
   `payment_status` for bank-transfer orders; one Agent-Probe manual walkthrough of the admin
   orders screen.
   strategy: Hybrid

6. **Staff can mark a specific bank-transfer order's payment as received with one action, and that
   action is the only thing that sets `payment_status = PAID` for that order.**
   proven by: route-handler test for the new "confirm payment received" endpoint — asserts it
   updates only the targeted order, only when the order's current payment method is
   `BANK_TRANSFER`, and rejects the action for orders that are already PAID or are COD orders.
   strategy: Fully-Automated

7. **Once staff confirm payment, the customer's own order-history view (`/account`) reflects the
   updated PAID status without staff needing to touch anything else.**
   proven by: existing account-order-history service/component tests extended to cover the new
   payment method reading `payment_status` the same way as COD/PayOS today; one Agent-Probe manual
   walkthrough of `/account`.
   strategy: Hybrid

8. **COD checkout behavior is completely unchanged by this work.**
   proven by: existing COD-path tests (checkout, admin-orders `updateStatus`, account order
   history) continue to pass unmodified.
   strategy: Fully-Automated

9. **No PayOS code path (webhook, status, retry, live-poll hook) is reachable from the checkout or
   account flows after this change ships.**
   proven by: grep-based/static check in the test suite (or a route test asserting the PayOS
   webhook/status/retry routes are removed or return 404) confirming no live PayOS surface remains
   wired into checkout.
   strategy: Fully-Automated

## Out Of Scope

- Any third-party payment gateway integration (PayOS, SePay, Casso, or any other) — this SPEC is
  gateway-free by design; do not re-introduce a gateway dependency.
- Automatic payment-status detection of any kind (bank SMS parsing, email parsing, screen-scraping
  a banking app, etc.) — confirmation is manual/staff-driven only, by explicit decision.
- Any auto-cancel, auto-expiry, or TTL logic for unconfirmed bank-transfer orders — explicitly
  decided against; unconfirmed orders stay UNPAID indefinitely, same as today.
- The exact file-by-file removal of PayOS code, the DB migration SQL (including the mechanics of
  wiring up the `BANK_TRANSFER` enum value), and other implementation mechanics — those belong to
  PLAN, not this requirements document.
- Making the bank-account display details (BIN/account number/account name) admin-configurable via
  a database/settings UI — explicitly decided against; these live in environment variables.
- Refunds or partial-payment handling for bank-transfer orders — not addressed here.
- Any change to how or when stock is reserved, or to the order-confirmation email trigger — both
  are explicitly unchanged by this work.
- Any change to COD behavior.

## Constraints

- The merchant's bank account for VietQR generation is a Techcombank account — the same account
  PayOS could not settle to. VietQR generation itself does not depend on PayOS support for this
  bank, since it only needs the account's BIN/number/name, not gateway settlement.
- The QR generation method must not require any paid subscription, gateway account, or
  authentication — it must remain a "no third-party dependency" solution consistent with the
  explicit decision to drop gateways entirely.
- The new payment method is stored at the database level using the `BANK_TRANSFER` enum value
  (already reserved in the schema comment, never wired up) — not `PAYOS` and not a new value.
- The merchant's bank-account display details (BIN / account number / account name / QR template)
  are configured via environment variables, following this repo's existing per-integration
  `.env.example` block convention (comment header + doc URL, same shape as the `PAYOS_*` /
  `CLOUDINARY_*` blocks) — not stored in the database and not admin-configurable through a UI.
- Unconfirmed bank-transfer orders have no TTL, expiry, or auto-cancel policy — they remain UNPAID
  indefinitely until a human (customer retry or staff action) changes that, matching current system
  behavior. No new expiry/cron logic is introduced by this work.
- This is a billing/payment surface change (high-risk class). It requires explicit user review of
  this SPEC before INNOVATE/PLAN proceeds, and a manual-first evidence handoff before the resulting
  implementation is treated as production-ready (per this repo's orchestration protocol for
  high-risk changes).
- No E2E/browser test suite exists in this repo today (Vitest only, see test context). Acceptance
  criteria that require actually seeing the checkout/admin UI render correctly rely on Agent-Probe
  manual walkthroughs, not automated browser tests, until an E2E suite exists.
- Order-confirmation email behavior (fires unconditionally on order creation) must remain
  unaffected — it is explicitly out of scope for this change.

## Open Questions

None. All 3 items raised during SPEC drafting have been resolved by the user and are recorded as
locked decisions below (also reflected in `## Constraints`, `## Out Of Scope`, and the state
diagram above):

1. **Auto-cancel / TTL policy for unconfirmed bank-transfer orders — RESOLVED: No TTL.** Keep
   current behavior — orders stay UNPAID indefinitely unless a customer retries or staff manually
   cancels. No new expiry/cron logic is added.
2. **DB enum value for the new payment method — RESOLVED: `BANK_TRANSFER`.** Use the
   already-reserved-but-unused `BANK_TRANSFER` enum value from the migration comment, not `PAYOS`.
3. **Where bank-account display details live — RESOLVED: environment variables.** BIN / account
   number / account name follow this repo's existing convention (`PAYOS_*`, `CLOUDINARY_*` pattern
   in `.env.example`), not database-configurable.

## Background / Research Findings

- **Root cause for dropping PayOS:** PayOS does not support the merchant's Techcombank business
  account for settlement.
- **Alternatives tried and rejected:** SePay (has a Node SDK and webhook docs, but the user
  live-checked the SePay dashboard with the "Doanh nghiệp"/business account-type filter +
  "Techcombank" search and got 0 results — marketing claims did not hold up) and Casso (its
  Techcombank integration marketing page explicitly says "Link đang cập nhật" / not finished). Both
  rejected as unreliable/unconfirmed for a Techcombank business account.
- **Final direction:** no third-party payment gateway at all. Generate VietQR QR codes directly
  using the merchant's own Techcombank account details via VietQR's free, no-auth Quick Link image
  API (`img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=...&addInfo=...&accountName=...`).
  No SDK needed. This means no webhook and no automatic payment-status callback — payment
  confirmation becomes a manual/staff-driven process.
- **PayOS surface being removed (24 files, confirmed by RESEARCH):** `lib/payos.ts`,
  `features/checkout/services/payos.service.ts` (+test), `features/checkout/schemas/payos.schema.ts`
  (+test), `app/api/checkout/payos/{webhook,status,retry}/route.ts`,
  `features/checkout/services/checkout.service.ts`, `features/checkout/services/order.repository.ts`,
  `app/checkout/success/page.tsx` + `components/checkout/CheckoutSuccessView.tsx` (+
  `usePayosLiveStatus` polling hook), `features/account/services/account-order.service.ts`,
  `features/account/types/index.ts`, `components/account/AccountOrderList.tsx`,
  `features/admin-orders/services/admin-orders.repository.ts` (+test),
  `features/checkout/constants.ts`, `features/checkout/types/index.ts`, and migration
  `supabase/migrations/20260722010000_payos_bank_transfer.sql`.
- **The webhook + client poll are today's ONLY source of automatic PAID status** for non-COD
  orders (`handleWebhook` and `reconcileByPayosOrderCode`). Both disappear entirely with a static QR
  image — there is no callback or status-check capability of any kind in the VietQR Quick Link
  approach.
- **Stock reservation is already decoupled from payment status** — it happens at order-creation
  time (`order_items` insert, migration `20260724000000_reserve_stock_on_order_create.sql`).
  Removing PayOS does not affect stock timing.
- **No TTL/expiry/auto-cancel logic exists anywhere today.** Pre-existing gap. User has explicitly
  decided not to add one for this SPEC — see locked decision 1 above.
- **Key gap: staff currently have no way to manually mark any order's `payment_status` as PAID**
  independent of an order-status transition. The only existing precedent is COD's `updateStatus()`
  in `admin-orders.repository.ts`, which auto-sets PAID as a side effect ONLY when
  `payment_method === "COD"` AND status transitions to `delivered` — hardcoded, will not fire for
  the new method. `adminOrderStatusUpdateSchema` today only accepts an order-status enum, no
  payment-status field. This SPEC requires a new staff-facing "confirm payment received" capability
  (see User Story 5, Acceptance Criterion 6) since none exists today.
- **Order-confirmation email already fires on order creation** (unconditional, both COD and PayOS
  today), independent of payment status — unaffected by this change.
- **`payment_method` mapping today is binary:** checkout `"cod" | "bank_transfer"` → DB enum
  `"COD" | "PAYOS"`. The DB enum comment notes `BANK_TRANSFER` was reserved for "manual transfer"
  but never wired up. User has decided to use it — see locked decision 2 above.
- **VietQR Quick Link mechanics:** free, no-auth GET image URL built from bank BIN + account number
  + template + amount + description query params. No SDK needed. This repo's env-var convention
  (see `.env.example`) is one block per integration with a comment header + doc URL — a
  `VIETQR_BANK_ID` / `VIETQR_ACCOUNT_NO` / `VIETQR_ACCOUNT_NAME` / `VIETQR_TEMPLATE` block was
  informally sketched with the user and is now the confirmed direction — see locked decision 3
  above.
- **Test infra reality:** no E2E/Playwright suite exists in this repo — Vitest (unit +
  integration-style with a mocked Supabase client) is the only automated runner. Acceptance
  criteria above rely on Fully-Automated Vitest coverage for logic/data paths and Agent-Probe
  manual walkthroughs for the parts that require actually seeing the rendered UI, consistent with
  the existing route-handler test pattern (`app/api/staff/uploads/route.test.ts`) and the prior
  precedent of deferring UI walkthroughs to Agent-Probe (see the coupon-checkout-integration
  feature's backlog note for the same pattern).
