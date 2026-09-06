---
name: context:all-database
description: "Supabase Postgres schema, migrations, client setup, and the repository pattern -- the database group entrypoint/router"
keywords: database, supabase, postgres, migration, schema, sql, repository, supabaseAdmin, service-role, RLS, row level security, prisma, orm, query, table, seed, rpc, atomic, invoker rights, search_path, grant, revoke, trigger, policy
related: [context:all-auth, context:all-payment]
date: 06-09-26
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
- The real database is Supabase Postgres. Schema-of-record lives in `supabase/migrations/{timestamp}_{description}.sql`, applied in filename order. Confirmed migrations (14, dated 2026-07-18 through 2026-09-06): init_schema, refresh tokens, audit log auth events extension, VN address alignment, seed product/order-code/cart-variant, cart multiline variant, cart session, PayOS bank transfer, reserve stock on order create, admin content extra columns, drop legacy audit triggers, refresh product gallery media, update Nutein bundle offers, checkout abuse protection (see "Checkout abuse-protection migration" below).
- `supabaseAdmin` (service-role client in `lib/supabase.ts`) is sensitive: it bypasses Row Level Security. Only use it in server-only code paths, never expose it or its result set directly to untrusted client input without additional authorization checks.
- The repository pattern is the project convention: business logic in `features/{name}/services/{name}.service.ts` calls into `features/{name}/services/{name}.repository.ts` for the actual Supabase queries, with typed row interfaces (e.g. `OrderInsertRow`) defined alongside. Follow this pattern for new tables rather than inlining Supabase calls into services or route handlers.

### Checkout abuse-protection migration (in progress, 06-09-26) — first RPC-based write path in the repo

Source: `supabase/migrations/20260906000000_checkout_abuse_protection.sql`. Plan (still
`active/`, not archived):
`process/features/checkout/active/unpaid-order-abuse-protection_06-09-26/`. See
`process/context/payment/all-payment.md` for the business-level summary (lifecycle states,
what problem this solves). This entry covers the schema/ACL/migration-mechanics facts only.

- **New `orders` columns:** `protection_version`, `payment_expires_at`, `payment_review_state`,
  `review_due_at`, `state_version` (optimistic-lock version, checked via `expected_version` on
  every transition RPC call), `cancellation_reason`, `released_at`.
- **New tables:** `checkout_requests` (idempotency: `user_id` + `idempotency_key` unique,
  request hash + version, FK to the created order), `order_resource_reservations` (one ledger row
  per order — `stock_state`/`coupon_state`, replaces trigger-based stock/coupon bookkeeping for
  orders created through the new path), `order_payment_events` (append-only audit; a
  block-all-DELETE trigger enforces append-only — this also means `orders` can no longer be hard-
  deleted at all, since the only pre-existing `orders.delete()` caller in the repo was just removed
  in the same change), `checkout_daily_quota` (per-user-per-UTC-day atomic create counter).
- **3 dropped triggers + 2 dropped RLS policies — this closes a real, previously-confirmed bypass.**
  Two Supabase RLS policies (`"Users create own orders"` on `orders`, and a second one found during
  this work, `"Users insert own order items"` on `order_items`,
  `supabase/migrations/20260721000000_..._cart_variant.sql:69`) let ANY logged-in customer insert
  orders/items straight through the Supabase REST API with their own OAuth session — completely
  bypassing the app JWT layer, the rate limiter, the account cap, and idempotency. The migration
  drops both policies and `REVOKE`s INSERT/UPDATE/DELETE from `anon`/`authenticated` on
  `orders`/`order_items`/the new ledger tables (this repo's first use of `GRANT`/`REVOKE` anywhere —
  all 13 prior migrations had zero grant/revoke statements). `EXECUTE` on the new RPCs is also
  `REVOKE`d from `PUBLIC`.
- **New RPCs**: `checkout_create_order_atomic`, `checkout_transition_order_state`,
  `checkout_release_reservation` — invoker-rights (not `SECURITY DEFINER`) where the app's existing
  privileges suffice, with `search_path = ''` pinned and all names schema-qualified as a defense-in-
  depth convention for any future SECURITY DEFINER RPC in this repo.
- **KNOWN, CURRENTLY-UNRESOLVED FILE/PRODUCTION PARITY RISK.** RFC-5 found and fixed 2 real bugs in
  this migration file AFTER the owner had already applied an earlier version of it to production
  (see `all-payment.md` "unpaid-order abuse protection" for the mismatch-window fact): (1) a
  `pg_catalog.current_user` bug in `guard_sensitive_order_columns()` — `current_user` is a SQL
  keyword, not a schema object, and referencing it via `pg_catalog.` made the guard trigger ABORT
  on any database containing a CANCELLED order (RFC-2's own tests didn't catch it because they ran
  against an empty database); (2) a missing `DROP POLICY IF EXISTS`, which made the migration file
  non-re-runnable. Owner-verified (per `results.tsv` cycle 9) that the version actually applied to
  production does NOT have the `current_user` bug — but if you are diffing this migration file
  against what's live on production, verify which fix-state is actually deployed before assuming
  the file on disk matches. This is a real, open parity question, not resolved by this note.
- **Cutover-rehearsal test fixtures are hand-reconstructed, not the real deployed schema.**
  `tests/integration/checkout-protection.db.test.ts` and
  `tests/integration/checkout-cutover-rehearsal.db.test.ts` build their schema from
  `tests/integration/fixtures/bootstrap-schema.sql` — a manually rebuilt approximation of
  `init_schema.sql`, NOT a replay of the real migration chain. All "25/25" and "31/31" pass claims
  in the RFC-2/RFC-5 reports are against this reconstructed schema on a disposable local Postgres,
  not the real deployed database. See `process/context/tests/all-tests.md` for the disposable-
  container pattern this uses.
