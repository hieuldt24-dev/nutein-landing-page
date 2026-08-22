# auth

<!-- Part of nutein-landing-page -->

## Scope

Authentication for the app — a hybrid Supabase Auth + custom app JWT model (cookie
`nutein_access_token`), role-based access control (USER/STAFF/ADMIN), refresh tokens, auth email,
and audit logging. Cross-cutting: used sitewide via `AuthModal`/`useAuthStore`, not a single page.

## Key Source Files

- `features/auth/services/{auth,jwt,refresh-token,audit-log}.service.ts` -- core auth/session/token logic
- `features/auth/services/auth.repository.ts` -- auth data access
- `app/auth/*` -- auth pages (callback, etc.)
- `app/api/auth/*` -- auth API routes (session, refresh, logout, email-status)
- `proxy.ts` (repo root) + `src/middlewares/authenticate.middlware.ts` -- role-gating middleware

## Related Context

- `process/context/auth/all-auth.md` -- auth conventions and patterns

## Current Status

<!-- STUDY: Brief status of the feature. Update as work progresses. -->
<!-- Use one of: not-started | in-progress | stable | needs-refactor -->

Status: (pending)

## Folder Contents

```
process/features/auth/
  active/       -- in-progress plans for this feature (each task lives inside a {slug}_{date}/ task folder)
  completed/    -- archived completed plans
  backlog/      -- deferred/future plans
```

All artifacts (plans, specs, reports, references) colocate inside each `{slug}_{date}/` task folder. Do NOT create `reports/` or `references/` sibling dirs.
