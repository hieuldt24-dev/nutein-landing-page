# nutein-landing-page - All Context

Last updated: 2026-08-19

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## Project Overview

Nutein is a Vietnamese nutrition-supplement brand's website: a marketing landing page plus an
e-commerce shop with checkout (self-hosted VietQR bank-transfer payment, staff-confirmed — see
`process/context/payment/all-payment.md`), plus internal admin/staff back-office
panels covering products, orders, blog content, coupons, the contact inbox, general site content,
users, and an audit log.

Built and maintained by a solo developer — there are no formal team conventions yet (no CODEOWNERS,
no shared style guide beyond what is inferred from existing code, no CI-enforced review process).

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**The pattern:**

```
process/context/
  all-context.md                      <-- THIS FILE: root router
  planning/
    all-planning.md                   <-- group router for planning
    example-simple-prd.md             <-- deep doc within the group
    example-complex-prd.md            <-- deep doc within the group
  tests/
    all-tests.md                      <-- group router for tests
    debugging-and-pitfalls.md         <-- deep doc within the group
    e2e-tests.md                      <-- deep doc within the group
  database/
    all-database.md                   <-- group router for database
    schema-guide.md                   <-- deep doc within the group
    migration-procedures.md           <-- deep doc within the group
```

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

<!-- The two tables below (Root Entry Points + Context Groups) are GENERATED from each
     context doc's frontmatter by `discover-context.mjs --emit-routing`. Do NOT hand-edit
     between the GENERATED markers — your edits will be overwritten on the next rebuild.
     To change a row, edit the owning doc's frontmatter (description / keywords) and re-emit.
     `--check-routing` fails lint if this block drifts from the frontmatter on disk. -->

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/auth/all-auth.md` | Two-layer auth model (Supabase Auth identity + custom app JWT/roles) and proxy.ts role-gating -- the auth group entrypoint/router |
| `process/context/database/all-database.md` | Supabase Postgres schema, migrations, client setup, and the repository pattern -- the database group entrypoint/router |
| `process/context/email/all-email.md` | Two independent email mechanisms -- Resend for transactional order emails, Supabase Auth's own signup-confirmation email -- the email group entrypoint/router |
| `process/context/payment/all-payment.md` | Self-hosted VietQR bank-transfer payment (no gateway), staff manual payment confirmation, checkout/order orchestration and stock-reservation flow -- the payment group entrypoint/router |
| `process/context/planning/all-planning.md` | Plan-shape calibration, planning conventions, and implementation-plan examples -- the planning group entrypoint/router |
| `process/context/tests/all-tests.md` | Vitest runner, commands, mocking approach, and known test-coverage gaps -- the tests group entrypoint/router |
| `process/context/uxui/all-uxui.md` | shadcn/ui component conventions, Tailwind v4 CSS-first styling, and the centralized components/ tree -- the uxui group entrypoint/router |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `auth/` | `process/context/auth/all-auth.md` | Two-layer auth model (Supabase Auth identity + custom app JWT/roles) and proxy.ts role-gating -- the auth group entrypoint/router |
| `database/` | `process/context/database/all-database.md` | Supabase Postgres schema, migrations, client setup, and the repository pattern -- the database group entrypoint/router |
| `email/` | `process/context/email/all-email.md` | Two independent email mechanisms -- Resend for transactional order emails, Supabase Auth's own signup-confirmation email -- the email group entrypoint/router |
| `payment/` | `process/context/payment/all-payment.md` | Self-hosted VietQR bank-transfer payment (no gateway), staff manual payment confirmation, checkout/order orchestration and stock-reservation flow -- the payment group entrypoint/router |
| `planning/` | `process/context/planning/all-planning.md` | Plan-shape calibration, planning conventions, and implementation-plan examples -- the planning group entrypoint/router |
| `tests/` | `process/context/tests/all-tests.md` | Vitest runner, commands, mocking approach, and known test-coverage gaps -- the tests group entrypoint/router |
| `uxui/` | `process/context/uxui/all-uxui.md` | shadcn/ui component conventions, Tailwind v4 CSS-first styling, and the centralized components/ tree -- the uxui group entrypoint/router |
<!-- /GENERATED:routing -->

## Task Routing Table

| If the task involves... | Start with |
|---|---|
| architecture or stack questions | this file |
| testing or verification | `process/context/tests/all-tests.md` |
| creating a new plan | `process/context/planning/all-planning.md` |
| database/schema work | `process/context/database/all-database.md` |
| auth or session work | `process/context/auth/all-auth.md` |
| UI/component work | `process/context/uxui/all-uxui.md` |
| payment/VietQR/checkout work | `process/context/payment/all-payment.md` |
| email/notification work | `process/context/email/all-email.md` |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:

- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

```
nutein-landing-page/
  app/                    -- Next.js 16 App Router. Route groups: (account), (admin), (marketing) [about/blog/contact/policies/product], (staff); plus app/auth/, app/checkout/, app/api/ (34 route.ts handlers)
  components/             -- Presentational React components, mirrors features/: about, account, admin/*, blog, checkout, contact, layout, policies, product, providers, shared, ui (shadcn primitives)
  features/               -- Domain/business layer, 18 folders (schemas/ + services/ + types/ pattern): about, account, admin-audit, admin-blog, admin-contact, admin-content, admin-coupons, admin-dashboard, admin-orders, admin-products, admin-users, auth, blog, cart, checkout, contact, policies, product
  lib/                    -- Client/browser-facing utilities: Supabase clients (3 variants), VietQR/Resend clients, SWR-based state hooks (useAuthStore, useCartStore, useAddresses), api-client.ts, env.ts, cloudinary.ts
  src/                    -- Server-side infra layer (distinct from lib/): api/ (request-context, response envelope), cache/redis.ts (ioredis, optional), components/charts/ (~70-file visx chart library), errors/app.error.ts (AppError hierarchy), logging/logger.ts (pino), middlewares/*.middleware.ts (auth, audit-log, cache, cors, error-handler, rate-limit, validate)
  types/                  -- Single shared types/index.ts
  supabase/               -- migrations/ (14 timestamped SQL files, schema-of-record), email-templates/
  proxy.ts                -- Next.js 16's renamed middleware.ts entry point (role-gates /staff/** and /admin/**, refreshes Supabase session cookie)
  process/                -- this context/plan system (RIPER-5 harness)
```

## Technology Stack

- **Framework:** Next.js 16.2.10 (App Router)
- **Language:** TypeScript ^5, React 19.2.4
- **Runtime:** Node (unpinned -- no `engines` field or `.nvmrc`; `@types/node` ^20 is a dev-only hint, not an enforced runtime version)
- **Database:** Supabase Postgres via raw SQL migrations (`supabase/migrations/*.sql`, 14 files) -- NOT Prisma despite `@prisma/client`/`@prisma/adapter-pg`/`prisma` being listed as dependencies (dormant/unused: no `schema.prisma` exists anywhere, zero `PrismaClient` usage). The `pg` dependency is also unused directly.
- **Auth:** hybrid -- Supabase Auth (OAuth/session, via `@supabase/ssr`) + a custom app-level JWT layer (`jsonwebtoken`, cookie `nutein_access_token`), role-gated STAFF/ADMIN via `proxy.ts` + `src/middlewares/authenticate.middlware.ts` (note: repo-wide typo "middlware" is intentionally preserved for consistency with existing code)
- **Payment:** self-hosted VietQR bank transfer (no gateway, no SDK) -- `lib/vietqr.ts` builds a
  static `img.vietqr.io` QR-code image URL from env-configured merchant bank details; payment is
  confirmed manually by staff (`POST /api/staff/orders/[id]/confirm-payment`), not automatically.
  Replaced PayOS (removed 27-08-26; `@payos/node` dependency removed) because PayOS could not
  settle to the merchant's Techcombank business account. See `process/context/payment/all-payment.md`.
- **Email:** Resend (`lib/resend.ts`) for transactional/order emails; Supabase Auth's own template handles signup confirmation (`supabase/email-templates/confirm-signup.html`)
- **Validation:** Zod ^4 (env schema + per-feature request/response schemas). Note: `yup` ^1.7.1 is also a dependency but not confirmed used anywhere -- possible dead dependency.
**Content sanitization (added 19-08-26):** `sanitize-html` (+ `@types/sanitize-html`) is used ONLY for
blog HTML content (`lib/sanitize-blog-html.ts`, one shared allowlist config, wired at both write-time
in `admin-blog.repository.ts` and read-time in `blog.service.ts`). This is a different, heavier
allowlist-based sanitizer than the hand-written `escapeHtml()` helper used for order-confirmation
email fields (see `process/context/email/all-email.md`) -- do not conflate the two.
- **State management:** NOT Zustand despite `useAuthStore`/`useCartStore` naming -- the actual pattern is "SWR-as-store" (hooks built on `swr`, documented in `docs/state-management.md`). `@tanstack/react-query` is a dependency but has zero imports anywhere -- dormant.
- **Caching:** ioredis (optional, gated on an undocumented `REDIS_URL` env var), used for caching and rate limiting
- **UI:** Tailwind CSS v4 (CSS-first config via `@theme` in `app/globals.css`, no `tailwind.config.*` file) + shadcn/ui (`components.json`, style `radix-nova`) + `radix-ui` + `@base-ui/react`. Charts via `@visx/*` (custom library at `src/components/charts/`).
- **Logging:** pino / pino-pretty
- **Test runner:** Vitest (see `process/context/tests/all-tests.md` for detail)
- **Package manager:** npm (`package-lock.json` present)
- **No CI/CD pipeline** exists (no `.github/workflows/`), **no Docker**, **no monorepo tooling** -- this is a single Next.js app.

## Key Patterns and Conventions

**Error handling:** throw-based via a central `AppError` hierarchy (`src/errors/app.error.ts`:
`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `InternalServerError`,
`BadRequestError`, `ConflictError`). Every `app/api/**/route.ts` wraps its handler in
`withErrorHandler` (`src/middlewares/error-handler.middleware.ts`), which catches `ZodError` -> 400,
`AppError` -> its own `statusCode`/`code`, else -> 500.

**API route pattern:** thin handlers -- `authenticate(req)` -> Zod-parse body -> delegate to the
feature service -> wrap in the response helper (`src/api/response.ts`).

**Service layer:** consistent repository + service split per feature
(`features/{name}/services/{name}.repository.ts` for raw Supabase queries,
`{name}.service.ts` for business orchestration).

**Import aliases** (from `tsconfig.json` paths): `@/*` -> `./*`, `@/components/*` -> `./components/*`,
`@/features/*` -> `./features/*`, `@/lib/*` -> `./lib/*`, `@/src/*` -> `./src/*`,
`@/types/*` -> `./types/*`. Note: `components.json` (shadcn) also references `@/hooks`, but no
top-level `hooks/` directory exists -- likely an unused/aspirational alias.

**"server-only" guard:** consistently imported at the top of server-exclusive modules (`env.ts`,
`vietqr.ts`, `resend.ts`, `supabase-server.ts`, `checkout.service.ts`, repositories) to hard-fail if
accidentally bundled client-side.

**Nullable-client defensive pattern:** third-party clients (vietqr, resend, supabaseAdmin, redis)
instantiate/resolve as `null` when their env vars are missing rather than throwing at import time;
callers guard explicitly. This is a deliberate repo-wide convention (comments in the code say
"Mirror lib/supabase.ts").

**Naming:** kebab-case files (`order-email.service.ts`), camelCase hooks (`useAuthStore.ts`),
PascalCase components (`CartDrawer`). One known inconsistency: the `authenticate.middlware.ts`
typo is propagated consistently, so treat it as the correct filename, not a bug to silently fix.

**Testing:** co-located `*.test.ts(x)` files next to source (not a separate `__tests__/` tree).

**Docs cross-referencing:** source comments point to `docs/*.md` (e.g. `docs/state-management.md`)
as the source of truth for specific subsystems -- check there before assuming a pattern from code
alone.

## Environment and Configuration

**Config files:** `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `components.json` (shadcn),
`.env` (git-ignored), `.env.example` (documents most vars).

**Gap to flag:** `lib/env.ts`'s Zod schema only validates 4 vars (`NEXT_PUBLIC_APP_URL`,
`NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL` [dead/unused]). Most real integration credentials bypass
it and are read directly via `process.env.X` in their own files, each with its own nullable
fallback handling (see the Nullable-client defensive pattern above).

**Env var groups (names only, never values):**
- App: `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `LOG_LEVEL`
- Auth (Supabase): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auth (custom JWT): `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `EXPIRE_ACCESS_TOKEN`, `EXPIRE_REFRESH_TOKEN`
- Media: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Payment: `VIETQR_BANK_ID`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `VIETQR_TEMPLATE` (legacy/dormant: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` — no longer read by any code path, safe to remove from `.env` when convenient)
- Email: `RESEND_API_KEY`, `ORDER_EMAIL_FROM`
- Cache (undocumented in `.env.example`): `REDIS_URL`
- Dead/unused: `DATABASE_URL` (Prisma is unused)

## Open Questions

None outstanding — this file was fully populated by the vc-setup STUDY phase scan below.

## Scan Metadata

- Generated: 2026-08-19T08:20:44Z
- Repo HEAD (`git rev-parse HEAD`): 0a0068acffdc5fcbc07cd7f88240429eaf339014
- Mode: Fresh (vc-setup Flow A, new project)
- Package manager: npm
