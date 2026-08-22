# admin-orders

<!-- Part of nutein-landing-page -->

## Scope

Staff order management and fulfillment — view, update status, and process customer orders. The
service layer is currently untested (only the repository and schema layers have tests).

## Key Source Files

- `features/admin-orders/services/*.repository.ts` -- order data access (tested)
- `features/admin-orders/services/admin-orders.service.ts` -- order management business logic (untested)
- `app/(staff)/staff/orders` -- staff order management route
- `app/api/staff/orders` -- staff order API

## Related Context

<!-- STUDY: Link to relevant context group entrypoints. -->

(pending -- populated during STUDY phase)

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/admin-orders/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
