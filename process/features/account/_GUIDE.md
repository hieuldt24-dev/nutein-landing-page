# account

<!-- Part of nutein-landing-page -->

## Scope

Customer profile and saved-address management. Covers viewing/editing the logged-in customer's
profile and CRUD for their saved shipping addresses, used during checkout address selection.

## Key Source Files

- `features/account/services/*.repository.ts` -- profile and address data access
- `features/account/schemas/` -- validation schemas for profile/address forms
- `app/(account)/account/` -- account page route
- `app/api/account/*` -- profile, addresses, and orders API routes

## Related Context

<!-- STUDY: Link to relevant context group entrypoints. -->

(pending -- populated during STUDY phase)

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/account/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
