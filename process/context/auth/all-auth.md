---
name: context:all-auth
description: "Two-layer auth model (Supabase Auth identity + custom app JWT/roles) and proxy.ts role-gating -- the auth group entrypoint/router"
keywords: auth, authentication, authorization, jwt, session, cookie, oauth, supabase auth, role, RBAC, USER, STAFF, ADMIN, proxy, middleware, refresh token, login, signup
related: [context:all-database, context:all-email]
date: 19-08-26
---

# Auth Context

This file is the canonical auth context entrypoint for Nutein Landing Page.

Use it after `process/context/all-context.md` when the task needs login/session/role/permission changes.

---

## Scope

This group covers:

- The two-layer auth model: Supabase Auth (identity/OAuth session) plus a custom app-level JWT layer on top
- `features/auth/` service, repository, JWT, refresh-token, and audit-log logic
- `proxy.ts` (Next.js 16's renamed `middleware.ts`) role-gating for `/staff/**` and `/admin/**`
- The OAuth callback flow and the two routes that read the Supabase session server-side
- Client-side auth state via `lib/useAuthStore.ts`

It does not cover:

- General Supabase client setup mechanics (`lib/supabase*.ts`) — see `database/` group
- Transactional/order email content and Resend — see `email/` group (Supabase's own signup-confirmation email template is noted here as a cross-reference, but its delivery mechanism belongs to Supabase Auth, not Resend)

## Read When

Read this entrypoint when:

- adding or modifying login, signup, OAuth callback, or session-refresh logic
- adding or changing role-based access control (USER/STAFF/ADMIN) on any route
- working on `proxy.ts`, `src/middlewares/authenticate.middlware.ts`, or any `/staff/**` or `/admin/**` route gating
- debugging why a route sees no user / wrong role, or why a session isn't refreshing
- working on refresh-token issuance, rotation, or the audit log for auth events

## Quick Routing

No deeper docs yet — this entrypoint is the full content for now. Deeper docs (e.g. a dedicated role-matrix doc) will be added later if the auth surface grows enough to justify a split.

## Source Paths

- `features/auth/` (15 files) — `schemas/`, `auth.service.ts`, `auth.repository.ts`, `jwt.service.ts` (issues/verifies the app JWT), `refresh-token.service.ts`, `audit-log.service.ts`, `auth-email.server.ts`, `sanitize-return-to.ts`, `constants.ts`, `types/index.ts`
- `app/auth/callback/route.ts` — OAuth code exchange
- `app/api/auth/session/route.ts` — session read/refresh endpoint
- `app/api/auth/email-status/route.ts` — email verification status endpoint
- `proxy.ts` (repo root) — Next.js 16's renamed `middleware.ts`
- `src/middlewares/authenticate.middlware.ts` — note the repo-wide typo "middlware"; preserve it verbatim when referencing this filename
- `lib/useAuthStore.ts` — client auth state (SWR-as-store pattern; despite the name, this is NOT Zustand)
- `supabase/email-templates/confirm-signup.html` — Supabase Auth's own signup confirmation template (separate mechanism from Resend)
- `supabase/migrations/20260720000000_add_refresh_tokens.sql` — refresh token table

## Update Triggers

Update this group when:

- the two-layer model changes (e.g. app JWT is dropped in favor of relying on Supabase session directly, or vice versa)
- role names or role-gating logic in `proxy.ts` change
- new routes are added to the Supabase-session-reading allowlist (currently only `/api/auth/session` and `/auth/callback`)
- the refresh-token flow or its migration changes
- `authenticate.middlware.ts` is renamed to fix the typo (update the filename reference here too)

## Canonical Notes

- Two-layer auth model: (1) Supabase Auth handles identity/OAuth session (`@supabase/ssr`, `@supabase/supabase-js`); (2) a custom app-level JWT layer sits on top (`jsonwebtoken` package, cookie name `nutein_access_token`, roles `USER` / `STAFF` / `ADMIN`). **Most routes check the app JWT, not the Supabase session directly** — do not assume Supabase session presence implies the app considers the user authenticated.
- `proxy.ts` does two distinct jobs, per its own inline comments:
  1. Edge-gates `/staff/**` (requires `STAFF` role) and `/admin/**` (requires `ADMIN` role) via `authenticate()` / `requireRole()` from `src/middlewares/authenticate.middlware.ts`, redirecting on role mismatch.
  2. Refreshes the Supabase session cookie ONLY on `/api/auth/session` and `/auth/callback` — these are, per the file's own comments, the only two routes that read the Supabase session server-side. Do not assume the Supabase session cookie is refreshed on every request.
- Refresh tokens are implemented in `features/auth/services/refresh-token.service.ts`, backed by migration `20260720000000_add_refresh_tokens.sql`.
- `lib/useAuthStore.ts` uses an SWR-as-store pattern for client auth state — despite the "Store" naming convention suggesting Zustand, it is not Zustand. Check this file directly before assuming a state-management library.

### Account-lock enforcement (added 19-08-26)

- Locked accounts (`users.is_deleted = true`) are now rejected at BOTH `POST /api/auth/session` and
  `POST /api/auth/refresh` — previously a locked account could still mint/refresh a valid app JWT.
  Rejection uses `ForbiddenError` (403, `src/errors/app.error.ts`), not `UnauthorizedError` (401-only).
- Guard-clause order in both routes is LOCKED: rate-limit check first, then the `is_deleted` lookup —
  do not reorder (a DB-query-before-throttle timing issue is the reason for this order).
- `features/auth/services/refresh-token.service.ts` has a new method, `revokeAllForUser(userId)`,
  which bulk-revokes ALL of a user's outstanding refresh tokens (`revoked_at = now()` where not yet
  revoked). Called from two places: (1) `features/admin-users/services/admin-users.repository.ts`'s
  `setLocked(id, locked)` — immediate revocation the moment an admin locks an account (only on
  `locked === true`, not on unlock); (2) the refresh route itself, as a defense-in-depth safety net for
  tokens minted in the race window between an admin's lock action and the trigger above.
- `app/api/auth/session/route.ts`'s `is_deleted` check is merged into the existing single `profile`
  query (`SELECT "role, is_deleted"`) — no extra DB round-trip added.

### Rate limiting on auth routes (added 19-08-26)

- `authLimiter` (`src/middlewares/rate-limit.middleware.ts`) is now the first guard clause on both
  `POST /api/auth/session` and `POST /api/auth/refresh` (429 on threshold exceeded, before any
  Supabase/JWT work runs).
- `app/api/auth/email-status/route.ts` has its OWN dedicated, stricter limiter (`emailStatusLimiter`:
  `max: 5` / 15-min window, code `TOO_MANY_EMAIL_CHECKS`) — separate from `authLimiter` because this
  route is an unauthenticated pre-login enumeration oracle. The route intentionally has NO
  login/session requirement — the fix only added throttling, not an auth gate (this is correct by
  design, not a gap).
- Rate limiting fail-open behavior (`rateLimiter()` returns `null`/no-op when `redis` is falsy) is
  UNCHANGED and intentional — see the payment/all-payment.md Redis note and the backlog note
  `process/general-plans/backlog/infra-followups-19-08-26.md` for the outstanding production
  provisioning follow-up (F4/F5 land correctly in code but only throttle for real once `REDIS_URL` is
  set in prod).
