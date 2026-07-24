---
name: order-confirmation-email
description: Send (or extend) the transactional email that fires after a Nutein order is successfully created — use whenever the task involves emailing customers about checkout/order events (confirmation, future shipping/status emails), touches lib/resend.ts, or touches features/checkout/services/order-email.service.ts.
---

# Order confirmation email

Nutein sends a best-effort transactional email right after `checkoutService.createOrder()`
persists an order (COD or `bank_transfer`/payOS). This skill documents how that pipeline is
wired so it can be maintained or extended (e.g. adding a "shipped" or "payment received" email)
without re-deriving the architecture from scratch.

## Where everything lives

- `lib/resend.ts` — server-only Resend client singleton. Mirrors `lib/payos.ts`: exports `null`
  when `RESEND_API_KEY` is unset, so the app never crashes on boot in environments without email
  configured. Also exports `ORDER_EMAIL_FROM` (defaults to `Nutein <onboarding@resend.dev>`, a
  Resend sandbox sender that works with no domain verification — fine for demo/dev).
- `features/checkout/services/order-email.service.ts` — `orderEmailService.sendOrderConfirmation(order: CreateOrderResult)`.
  Renders a self-contained inline-styled HTML string (table-based, email-client-safe) and calls
  `resend.emails.send(...)`. **Never throws** — every failure path (missing API key, Resend API
  error) is caught and logged via `logger.child({ service: "orderEmailService" })`, then
  swallowed. This is deliberate: a failed email must never fail an already-successful order.
- `features/checkout/services/checkout.service.ts` — calls
  `await orderEmailService.sendOrderConfirmation(result)` as the last step of `createOrder()`,
  right before `return result`. It's `await`ed (not fire-and-forget `void`) because Next.js route
  handlers can freeze background work after the response is sent — awaiting guarantees the send
  attempt completes (or fails silently) before the HTTP response goes out.
- `.env.example` — `RESEND_API_KEY` and `ORDER_EMAIL_FROM` placeholders with setup notes.

## Design decisions worth preserving

1. **Best-effort, not blocking.** Order creation already committed to the DB by the time the email
   step runs. Never let an email provider outage turn a successful checkout into a 500 for the
   customer. Any new order-related email must follow the same try/catch-and-log pattern.
2. **`null`-if-unconfigured client, mirroring `lib/payos.ts`.** Don't add `.env` validation that
   crashes the app; follow the existing `lib/supabase.ts` / `lib/payos.ts` convention of a
   nullable singleton checked at the call site.
3. **Data source is `CreateOrderResult`**, the same object already returned to the client and
   used by `components/checkout/CheckoutSuccessView.tsx` — no extra DB round-trip needed to build
   the email. Reuses `PAYMENT_OPTIONS`/`SHIPPING_OPTIONS` labels from `features/checkout/constants.ts`
   so email copy stays in sync with the UI.
4. **Single-SKU aggregate summary**, not a line-by-line breakdown — matches what the success page
   already shows (`order.summary.quantity/subtotal/shippingFee/discountAmount/total`), since the
   project's product model is single-SKU with pack variants (see `features/product/types`).

## How to extend (e.g. add a "payment received" or "shipped" email)

1. Add a new render function + send method to `order-email.service.ts` (or a new
   `*-email.service.ts` file if the trigger point lives outside `features/checkout`, e.g. a
   future `features/admin-orders` shipping-status email).
2. Call it from wherever that event is authoritative — e.g. `payosService.handleWebhook()` for
   "payment received", or `adminOrdersRepository.updateStatus()` for "shipped"/"delivered". Keep
   the same best-effort contract (never throw into the caller).
3. Reuse `resend` / `ORDER_EMAIL_FROM` from `lib/resend.ts` — don't create a second client.
4. Write tests mirroring `order-email.service.test.ts`: mock `@/lib/resend` with a
   `vi.hoisted` + getter so you can flip `resend` between a fake client and `null` per test
   (see that file for the exact pattern — it's needed because `resend` is evaluated once at
   module load in the real file).

## Local setup to actually see an email

1. Get a free API key at https://resend.com/api-keys.
2. Set `RESEND_API_KEY` in `.env` (or `.env.local`). Leave `ORDER_EMAIL_FROM` unset to use the
   Resend sandbox sender — it delivers to any address without domain verification, good enough
   for manual testing.
3. Place a COD order through `/checkout` — `orderEmailService.sendOrderConfirmation` fires
   automatically; check the Resend dashboard's "Emails" log or the recipient inbox.
4. Without an API key configured, nothing breaks — you'll see a `logger.warn` line
   (`"Thiếu RESEND_API_KEY — bỏ qua gửi email xác nhận đơn"`) instead of a send attempt.

## Verifying changes

Run the checkout test slice, which covers this pipeline end to end (unit-level, mocked Resend):

```bash
npx vitest run features/checkout
```

Key specs: `order-email.service.test.ts` (render/send/failure isolation) and
`checkout.service.test.ts` (`createOrder` calls `sendOrderConfirmation` with the right payload).
