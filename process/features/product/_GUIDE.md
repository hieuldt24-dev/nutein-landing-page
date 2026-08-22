# product

<!-- Part of nutein-landing-page -->

## Scope

Public product catalog — product listing/detail pages and catalog data fetching for the
storefront. Distinct from the `admin-products` feature, which covers the staff CMS side.

## Key Source Files

- `features/product/services/product.service.ts` -- product business logic
- `features/product/services/product-catalog.client.ts` -- client-side catalog fetching
- `features/product/services/product-catalog.server.ts` -- server-side catalog fetching
- `app/(marketing)/product` -- public product page route
- `app/api/product/catalog` -- product catalog API

## Related Context

<!-- STUDY: Link to relevant context group entrypoints. -->

(pending -- populated during STUDY phase)

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/product/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
