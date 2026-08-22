---
name: context:all-email
description: "Two independent email mechanisms -- Resend for transactional order emails, Supabase Auth's own signup-confirmation email -- the email group entrypoint/router"
keywords: email, resend, transactional, order confirmation, notification, supabase auth email, signup confirmation, mailer, sender, template
related: [context:all-payment, context:all-auth]
date: 19-08-26
---

# Email Context

This file is the canonical email context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs to send or modify a customer-facing email.

---

## Scope

This group covers:

- Resend as the transactional/order email provider
- The order-confirmation email flow fired from checkout
- Supabase Auth's own built-in signup-confirmation email (a separate mechanism)
- Auth-related email status checking

It does not cover:

- Supabase Auth's OAuth/session mechanics beyond the email template itself — see `auth/` group
- PayOS webhook/payment logic that triggers the order email — see `payment/` group

## Read When

Read this entrypoint when:

- adding or modifying the order-confirmation email or any future order/shipping status email
- touching `lib/resend.ts` or `features/checkout/services/order-email.service.ts`
- changing the Supabase signup-confirmation email template
- debugging why a customer did not receive an expected email (check both mechanisms — they are independent)

## Quick Routing

- There is a dedicated project skill, `order-confirmation-email`, covering the order-confirmation flow in more depth than this entrypoint (invoke it via the Skill tool by name — it is listed in the skill catalog). Use it when actively implementing or extending the order-confirmation email, not just when reading about it.

No other deeper docs yet — beyond the named skill above, this entrypoint is the full content for now.

## Source Paths

- `lib/resend.ts` — server-only Resend client, plus `ORDER_EMAIL_FROM` default sender
- `features/checkout/services/order-email.service.ts` (+ test) — builds and sends the order-confirmation email; fired best-effort via Next's `after()` so it is non-blocking (the checkout response does not wait on email send)
- `features/auth/services/auth-email.server.ts` — auth-related email logic
- `app/api/auth/email-status/route.ts` — checks email verification status
- `supabase/email-templates/confirm-signup.html` — Supabase Auth's own signup-confirmation template (rendered/sent by Supabase itself, not by Resend)
- `.claude/skills/order-confirmation-email/` — the named project skill covering the order-confirmation flow (if present; confirm via the skill catalog)

## Update Triggers

Update this group when:

- a new transactional email type is added (shipping update, cancellation, etc.)
- the Resend sender, template structure, or firing mechanism (e.g. moving off `after()`) changes
- the `RESEND_API_KEY` / `ORDER_EMAIL_FROM` env contract changes
- the Supabase signup-confirmation template changes

## Canonical Notes

- **Two separate email mechanisms — do not conflate them:**
  1. Resend, for transactional/order emails (`lib/resend.ts` + `order-email.service.ts`).
  2. Supabase Auth's own built-in email (signup confirmation) via `supabase/email-templates/confirm-signup.html` — this is Supabase's own delivery pipeline, independent of Resend.
- The order-confirmation email is fired best-effort via Next.js `after()`, meaning it runs after the response is sent — checkout does not block on email delivery, and email failures do not fail the checkout request.
- `RESEND_API_KEY` is optional: if unset, email sending is silently skipped with a warn log and does NOT block checkout. Do not assume email delivery is guaranteed in dev/preview environments without this key set.
- `ORDER_EMAIL_FROM` sets the default sender address for order emails.
- A dedicated skill (`order-confirmation-email`) already exists for this flow — prefer invoking it over re-deriving the flow from scratch when the task is actively about extending order emails.
- **HTML-escaping added 19-08-26 (XSS fix):** `renderOrderConfirmationHtml` in
  `order-email.service.ts` now runs every customer-supplied string field (`buyer.fullName`,
  `buyer.phone`, `address.street`, `address.ward`, `address.province`) through a local `escapeHtml()`
  helper (`&` replaced first, then `<`, `>`, `"`, `'` — order matters, prevents double-escaping)
  before interpolation. Previously these fields were interpolated raw, allowing a customer-controlled
  name/address (e.g. containing `<img onerror=...>` or `</td></tr><tr><td>`) to inject HTML into the
  order-confirmation email. Server-generated fields (`orderCode`, `formatCurrencyVnd(...)` output,
  `paymentLabel`/`shippingLabel`) are NOT escaped (not user input). This is a hand-written 5-character
  escaper, not the heavier `sanitize-html` allowlist package used for blog content — do not conflate
  the two; this group's fix does not add any new dependency.
