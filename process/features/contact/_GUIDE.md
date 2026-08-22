# contact

<!-- Part of nutein-landing-page -->

## Scope

Public contact form submission. Customers submit inquiries via a public contact form. Currently
untested (zero test files). Distinct from the `admin-contact` feature, which covers the staff
inbox side.

## Key Source Files

- `features/contact/schemas/contact.schema.ts` -- contact form validation schema
- `features/contact/services/{contact.repository,contact.service}.ts` -- contact submission data access/business logic
- `app/(marketing)/contact` -- public contact page route
- `app/api/contact` -- public contact API

## Related Context

<!-- STUDY: Link to relevant context group entrypoints. -->

(pending -- populated during STUDY phase)

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/contact/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
