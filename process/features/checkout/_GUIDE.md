# checkout

<!-- Part of nutein-landing-page -->

## Scope

Checkout flow and PayOS payment integration — order creation, payment webhook handling,
retry/status checks, order-confirmation email, and stock reservation.

## Key Source Files

- `features/checkout/services/{checkout,payos,order,order-email}.service.ts` -- checkout/payment/order/email business logic
- `features/checkout/services/*.repository.ts` -- checkout/order data access
- `features/checkout/schemas/` -- checkout validation schemas
- `app/checkout/*` -- checkout pages
- `app/api/checkout/*` -- checkout API incl. `payos/{retry,status,webhook}`

## Related Context

- `process/context/payment/all-payment.md` -- payment integration conventions
- `order-confirmation-email` skill -- transactional email sent after order creation

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/checkout/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
