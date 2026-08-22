---
name: context:all-database
description: "Supabase Postgres schema, migrations, client setup, and the repository pattern -- the database group entrypoint/router"
keywords: database, supabase, postgres, migration, schema, sql, repository, supabaseAdmin, service-role, RLS, row level security, prisma, orm, query, table, seed
related: [context:all-auth, context:all-payment]
date: 19-08-26
---

# Database Context

This file is the canonical database context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs schema, migration, or query-layer changes.

---

## Scope

This group covers:

- Supabase Postgres as the real database (raw SQL migrations, not an ORM-managed schema)
- Migration file location, naming convention, and history
- Supabase client setup (`lib/supabase*.ts`) — which client to use in which runtime context
- The repository pattern used across `features/*/services/*.repository.ts`
- The dead/unused Prisma dependencies (flagged so agents don't chase a ghost ORM)

It does not cover:

- Auth-specific flows, session cookies, JWT issuance (see `auth/` group) — even though auth tables live in the same migrations
- Payment/order-specific business logic (see `payment/` group) — even though PayOS-related tables live in the same migrations directory
- Email sending mechanics (see `email/` group)

## Read When

Read this entrypoint when:

- adding, modifying, or reading a Supabase table or column
- writing or reviewing a new file under `supabase/migrations/`
- deciding which Supabase client (`supabaseAdmin` vs `getSupabaseClient()` vs SSR client) to use in a given file
- adding or modifying a `features/*/services/*.repository.ts` file
- investigating whether Prisma is actually wired into the project (it is not)

## Quick Routing

No deeper docs yet — this entrypoint is the full content for now. Deeper docs (e.g. a dedicated migration-workflow doc or a schema-map doc) will be added later if the migration count or repository count grows enough to justify a split.

## Source Paths

- `supabase/migrations/*.sql` — schema-of-record, 13 files as of this scan (chronological, timestamp-prefixed filenames)
- `lib/supabase.ts` — exports `supabaseAdmin` (service-role client, server-only, bypasses RLS, null if env missing) and `getSupabaseClient()` (anon-key, lazy singleton)
- `lib/supabase-server.ts` — `@supabase/ssr` server client; must be created fresh per request via `next/headers` cookies (RSC / route handlers)
- `lib/supabase-browser.ts` — `createBrowserClient`; used client-side, and also server-side at the OAuth callback to read PKCE session cookies
- `features/*/services/*.repository.ts` — 15 repository files as of this scan, one per table/domain: `account/address.repository.ts`, `account/profile.repository.ts`, `admin-audit/admin-audit.repository.ts`, `admin-audit/audit-log.repository.ts`, `admin-blog/admin-blog.repository.ts`, `admin-contact/admin-contact.repository.ts`, `admin-content/admin-content.repository.ts`, `admin-coupons/admin-coupons.repository.ts`, `admin-orders/admin-orders.repository.ts`, `admin-products/admin-products.repository.ts`, `admin-users/admin-users.repository.ts`, `auth/auth.repository.ts`, `cart/cart.repository.ts`, `checkout/order.repository.ts`, `contact/contact.repository.ts`

## Update Triggers

Update this group when:

- a new `supabase/migrations/*.sql` file is added or the migration count changes meaningfully
- a new repository file is added under `features/*/services/`
- `lib/supabase*.ts` client setup changes (new client, changed singleton behavior, changed env-guard logic)
- the Prisma dependencies are either removed from `package.json` or actually wired up (schema.prisma appears) — either way this doc's "dead dependency" note becomes stale

## Canonical Notes

- **Correction to flag prominently:** `@prisma/client`, `@prisma/adapter-pg`, and `prisma` are listed in `package.json` (`^7.8.0`) but are DEAD/unused dependencies. Verified: no `schema.prisma` file exists anywhere in the repo, and there are zero `PrismaClient` usages in source. Do not treat Prisma as the real ORM or propose Prisma-based changes — the real data layer is raw SQL migrations + hand-written repositories against the Supabase client.
- The real database is Supabase Postgres. Schema-of-record lives in `supabase/migrations/{timestamp}_{description}.sql`, applied in filename order. Confirmed migrations (13, dated 2026-07-18 through 2026-08-18): init_schema, refresh tokens, audit log auth events extension, VN address alignment, seed product/order-code/cart-variant, cart multiline variant, cart session, PayOS bank transfer, reserve stock on order create, admin content extra columns, drop legacy audit triggers, refresh product gallery media, update Nutein bundle offers.
- `supabaseAdmin` (service-role client in `lib/supabase.ts`) is sensitive: it bypasses Row Level Security. Only use it in server-only code paths, never expose it or its result set directly to untrusted client input without additional authorization checks.
- The repository pattern is the project convention: business logic in `features/{name}/services/{name}.service.ts` calls into `features/{name}/services/{name}.repository.ts` for the actual Supabase queries, with typed row interfaces (e.g. `OrderInsertRow`) defined alongside. Follow this pattern for new tables rather than inlining Supabase calls into services or route handlers.
