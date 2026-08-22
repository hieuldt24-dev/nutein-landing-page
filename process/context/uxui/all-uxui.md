---
name: context:all-uxui
description: "shadcn/ui component conventions, Tailwind v4 CSS-first styling, and the centralized components/ tree -- the uxui group entrypoint/router"
keywords: uxui, ui, ux, component, shadcn, tailwind, css, styling, design system, radix, lucide, chart, visx, layout, responsive, theme, admin dashboard
related: []
date: 19-08-26
---

# Uxui Context

This file is the canonical UI/UX context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs component, styling, or design-system changes.

---

## Scope

This group covers:

- shadcn/ui configuration (`components.json`) and conventions
- The centralized `components/` tree organization (~105 files) and its admin sub-nesting
- The separate `src/components/charts/` chart subtree (visx-based)
- Tailwind CSS v4 CSS-first styling conventions (no `tailwind.config.*` file)
- The project's component-vs-feature-logic split convention

It does not cover:

- Feature business logic (schemas/services/hooks) — that lives in `process/features/{name}/` and each feature's own `features/{name}/` source folder, not here
- Backend/data-layer patterns — see `database/` group

## Read When

Read this entrypoint when:

- adding or modifying a UI component (page, section, admin screen, chart)
- deciding where a new component should live (`components/` vs `src/components/charts/`)
- working with shadcn primitives, Tailwind theme tokens, or brand CSS variables
- working on the admin dashboard and its chart widgets
- checking whether an import alias like `@/hooks` actually resolves to something

## Quick Routing

No deeper docs yet — this entrypoint is the full content for now. Deeper docs (e.g. a dedicated design-tokens doc or component-inventory doc) will be added later if the component tree grows enough to justify a split.

## Source Paths

- `components.json` — shadcn/ui config: style `radix-nova`, baseColor `neutral`, `rsc: false`, Tailwind CSS-variables mode, icon lib `lucide`
- `components/` (~105 files) — `about/`, `account/`, `admin/` (+ 8 nested: `audit/`, `blog/`, `contact/`, `content/`, `coupons/`, `dashboard/`, `orders/`, `products/`, `shell/`, `ui/`, `users/`), `blog/`, `checkout/`, `contact/`, `layout/`, `policies/`, `product/`, `providers/`, `shared/`, `ui/` (shadcn primitives)
- `src/components/charts/` — a SEPARATE chart component subtree (visx-based, ~70 files), used by the admin dashboard. This lives under `src/`, not `components/` — a deliberate but easy-to-miss split location
- `app/globals.css` — Tailwind CSS v4 `@theme` block defining brand tokens (e.g. `--color-primary`, `--color-ink`); also imports `@import "shadcn/tailwind.css"` from the `shadcn` npm package (registry-based shadcn, not just copy-pasted components)

## Update Triggers

Update this group when:

- `components.json` style, baseColor, or alias config changes
- the `components/` vs `src/components/charts/` split is consolidated or changed
- Tailwind config approach changes (e.g. a `tailwind.config.*` file is (re)introduced)
- the feature-logic-vs-central-components convention is broken or changes (e.g. a `features/*/components/` subfolder starts appearing)

## Canonical Notes

- shadcn/ui via `components.json`: style `radix-nova`, baseColor `neutral`, `rsc: false`, Tailwind CSS-variables mode, icon lib `lucide`, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`. **Note:** `@/hooks` has no matching tsconfig path or top-level `hooks/` directory found in this scan — treat it as likely unused/aspirational until verified otherwise for a specific task.
- **Flag this split explicitly:** `src/components/charts/` is a SEPARATE chart component subtree (visx-based, ~70 files) used by the admin dashboard, located under `src/` rather than the main `components/` tree. Don't assume all UI lives under one root.
- Project convention: features (`features/*/`) hold logic only (schemas/services/hooks); presentational components live centrally under `components/`, NOT per-feature. Confirmed zero hits for `features/*/components/` in this scan — do not introduce per-feature component folders without discussing the convention change first.
- Styling: Tailwind CSS v4, CSS-first config via an `@theme` block in `app/globals.css` (brand tokens like `--color-primary`, `--color-ink`) — there is no `tailwind.config.*` file to edit. The project also imports `@import "shadcn/tailwind.css"` directly from the `shadcn` npm package (registry-based shadcn, not just copy-pasted component files), and uses the consolidated `radix-ui` package plus `@base-ui/react`.
