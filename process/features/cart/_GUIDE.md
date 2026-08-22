# cart

<!-- Part of nutein-landing-page -->

## Scope

Shopping cart state and pricing logic. No dedicated page — this is a cross-cutting feature used
in the Navbar, checkout, and marketing pages via `CartDrawer`/`useCartStore`.

## Key Source Files

- `features/cart/services/pricing.ts` -- cart pricing/calculation logic
- `features/cart/services/cart.repository.ts` -- cart data access
- `lib/useCartStore.ts` -- cart state store
- `lib/useCartDrawer.ts` -- cart drawer UI state
- `components/shared/CartDrawer` -- cart drawer component (if present)

## Related Context

<!-- STUDY: Link to relevant context group entrypoints. -->

(pending -- populated during STUDY phase)

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/cart/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
