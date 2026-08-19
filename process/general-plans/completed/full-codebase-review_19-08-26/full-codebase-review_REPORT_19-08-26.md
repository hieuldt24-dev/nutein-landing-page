---
name: report:full-codebase-review-critical-fixes-execute
description: "EXECUTE phase report for the 7 Critical production-readiness fixes (F1-F7) — all 6 sections code-complete and green"
phase: full-codebase-review-critical-fixes
date: 2026-08-19
status: COMPLETE
feature: N/A
plan: process/general-plans/active/full-codebase-review_19-08-26/full-codebase-review_PLAN_19-08-26.md
metadata:
  node_type: memory
  type: report
  feature: N/A
  phase: execute
---

# EXECUTE REPORT — 7 Critical Fixes (F1–F7)

**TL;DR:** All 6 sections code-complete and green in the locked order (F7 → F6 → F1 → F2+F4 → F5 → F3).
101 tests pass across the 13 plan-gate test files; full suite 323 passed / 1 pre-existing unrelated
failure; `tsc --noEmit` clean. All 16 SPEC Acceptance Criteria now have a Fully-Automated proving gate.

## What Was Done

### Section 1 — F7 (Cloudinary remotePatterns scoping)
Already implemented on disk before this session (`next.config.ts` pathname =
`` `/${process.env.CLOUDINARY_CLOUD_NAME}/**` ``), and `next.config.test.ts` already existed.
Verified byte-exact against plan items 1–4. Gate re-run: **2/2 green** (AC15, AC16).

### Section 2 — F6 (stop leaking internal error detail)
- Items 5, 6, 7a were already implemented on disk (payos two-arg `InternalServerError`; uploads
  catch-block generic message + `details`; `error-handler.middleware.ts` `logger.warn` already
  carries `details: error.details`). Re-verified by direct read — no rework done.
- **New work:** the `isCloudinaryConfigured` guard clause in `app/api/staff/uploads/route.ts`
  (missed by the prior partial work) still leaked
  `"Thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET — kiểm tra lại ..."` as a single-arg
  `InternalServerError`. Converted to the same two-arg pattern (generic client message + diagnostic
  in `details`).
- **New tests:** AC13 case appended to `features/checkout/services/payos.service.test.ts`; new file
  `app/api/staff/uploads/route.test.ts` (4 cases, AC14).
Gate: **14/14 green**.

### Section 3 — F1 (cancel orphaned PayOS link on order-create failure)
Wrapped `orderRepository.create()` in try/catch inside `createOrder()`; on catch, guarded on
`payosOrderCode` (COD path untouched), called
`payosService.cancelPaymentLink(payosOrderCode, "order_create_failed")` inside its own inner
try/catch (log-only via `serviceLogger.error`), then rethrew the original error.
**New tests:** 3 cases (cancel called + original error propagates; cancel-throws → original error
still propagates; COD → cancel never called). Gate: **21/21 green** (AC1, AC2).

### Section 4 — F2+F4 combined (account lock + rate limiting, session/refresh)
Executed as ONE combined change per file with the locked guard-clause order (rate-limit FIRST,
then `is_deleted`):
- `app/api/auth/session/route.ts`: `authLimiter` as first guard; `SELECT "role, is_deleted"` merged
  into the existing single profile query; `ForbiddenError` (403) on lock — short-circuits before any
  token minting/storing.
- `app/api/auth/refresh/route.ts`: `authLimiter` first; new service-role lookup of `is_deleted` by
  `payload.sub` after `verifyRefreshToken()` and before `isActive`; on lock → `revokeAllForUser()`
  then `ForbiddenError`.
- `features/auth/services/refresh-token.service.ts`: new `revokeAllForUser(userId)` —
  `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, using
  the existing `requireAdminClient()`.
- `features/admin-users/services/admin-users.repository.ts`: `setLocked` calls
  `refreshTokenService.revokeAllForUser(id)` after a successful update, **only when `locked === true`**.
**New tests:** 3 on session route, 3 on refresh route, 2 on admin-users repo.
Gate: **23/23 green** (AC3, AC4, AC5, AC8, AC9).

### Section 5 — F5 (email-status limiter) + remaining F4 contact wiring
- `emailStatusLimiter` added to `src/middlewares/rate-limit.middleware.ts`:
  **`max: 5`, `windowMs: 15 * 60 * 1000`, `code: "TOO_MANY_EMAIL_CHECKS"`**.
  *Rationale (item 22 requirement):* 4× stricter than `authLimiter`'s `max: 20` — a real user
  checks 1–2 emails in `AuthModal`/guest checkout, so 5 per 15 min per IP is generous for the
  legitimate flow but useless for enumerating an email list.
- Wired as first guard clause in `app/api/auth/email-status/route.ts`. Per item 24, **no auth/session
  requirement added** — route stays pre-login by design.
- `app/api/contact/route.ts`: wired `sessionLimiter` (general tier, 200/15min) — NOT `authLimiter`,
  per the plan's Risks guidance, since contact-form spam is not credential guessing.
**New test files:** `src/middlewares/rate-limit.middleware.test.ts` (per E3: `@/src/cache/redis`
mocked at the module boundary; `redis: null` for fail-open), `app/api/auth/email-status/route.test.ts`,
`app/api/contact/route.test.ts`. Gate: **13/13 green** (AC10, AC11, AC12).

### Section 6 — F3 (blog stored XSS, write-time + read-time)
- Installed `sanitize-html@^2.17.7` + `@types/sanitize-html@^2.16.1` (types NOT bundled — dev dep
  was required).
- New `lib/sanitize-blog-html.ts` with ONE shared options object: explicit `allowedTags`
  (p, h1–h6, b, strong, i, em, a, ul, ol, li, img), explicit `allowedAttributes`
  (`a: [href]`, `img: [src, alt]`), explicit `allowedSchemes: [http, https, mailto]` +
  `allowedSchemesByTag`, `nonTextTags` discarding script/style/textarea/noscript/iframe content.
  Per **E5**: no wildcard attribute key and no reliance on library defaults — verified by test that
  `on*` handlers, `javascript:`, `data:text/html`, and `style=` are all stripped.
- Wired at write-time (`toInsertPayload` + `toUpdatePayload` in
  `features/admin-blog/services/admin-blog.repository.ts`) and read-time (`toBlogPost` in
  `features/blog/services/blog.service.ts`), both **importing the same function** (item 30).
- `components/blog/BlogArticle.tsx` NOT modified (item 29).
**New tests:** `lib/sanitize-blog-html.test.ts` (11 cases) + boundary cases at both call sites.
Gate: **26/26 green** (AC6, AC7).

## What Was Skipped or Deferred

- Nothing in the plan's scope was skipped.
- SPEC Out-Of-Scope items untouched, as required (`proxy.ts`, `BlogArticle.tsx`,
  `admin-blog.schema.ts`, password-reset, CSP, coupons, migrations).
- **E4 (high-risk evidence pack for Sections 3 and 4)** was explicitly advisory-not-required in the
  contract ("recommended-not-required"); coverage is Fully-Automated for all criteria, exceeding the
  Hybrid minimum. No `harness/` pack written. Flag for the team before merge if belt-and-suspenders
  evidence is wanted on token-revocation / payment-cancellation.

## Test Gate Outcomes

| Section | Gate | Result |
|---|---|---|
| 1 — F7 | `npx vitest run next.config.test.ts` | 2/2 green |
| 2 — F6 | payos.service.test.ts + app/api/staff/uploads/route.test.ts | 14/14 green |
| 3 — F1 | checkout.service.test.ts | 21/21 green |
| 4 — F2+F4 | session + refresh + admin-users.repository | 23/23 green |
| 5 — F5 | email-status + rate-limit.middleware + contact | 13/13 green |
| 6 — F3 | sanitize-blog-html + admin-blog.repository + blog.service | 26/26 green |
| Final regression (all 13 gate files, one pass) | — | **101/101 green** |
| Full suite `npx vitest run` | — | 323 tests passed; **1 pre-existing unrelated suite failure** |
| `npm run type-check` | — | clean |

## Plan Deviations

1. **Section 2 scope extension (approved in the handoff):** fixed the `isCloudinaryConfigured` guard
   clause in `app/api/staff/uploads/route.ts` in addition to plan item 6's catch block. Same file,
   same leak class, same two-arg fix pattern. Within blast radius.
2. **Sections 1, 2 (items 5/6/7a) were already implemented** by prior work before this session.
   Verified by direct read rather than re-implemented. No code churn.
3. **F4 contact-route wiring (AC10) executed inside Section 5**, not as its own numbered section —
   the plan lists `app/api/contact/route.ts` in Blast Radius item 11 and AC10 in the contract, but
   no numbered checklist item owns it. Grouped with Section 5 because both are rate-limiter wiring.
   Tier choice: `sessionLimiter`, per the plan's own Risks recommendation. Within blast radius.
4. **E1 resolved as instructed:** `ForbiddenError` (403) used for the lock rejection on both routes,
   not `UnauthorizedError` (401).
5. **Test-mock leak fixed during execution:** an initial `mockRejectedValue` on `cancelPaymentLink`
   bled across describes in `checkout.service.test.ts` (`clearAllMocks` does not reset
   implementations). Changed to `mockRejectedValueOnce`.
6. **Response-envelope path correction in new tests:** error message lives at `body.error.message`
   (per `src/api/response.ts`), not `body.message`.

## Test Infra Gaps Found

- `lib/useAddresses.test.tsx` fails at import time with
  `@supabase/ssr: Your project's URL and API key are required` — `vitest.config.ts`'s `test.env`
  block hardcodes JWT secrets but not `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  and `lib/supabase-browser.ts` calls `createBrowserClient` at module scope. **Pre-existing, outside
  this plan's blast radius** (neither file was touched — confirmed via `git status`). Classification:
  `harness-drift`. Recommend adding the two public Supabase vars to `vitest.config.ts` `test.env` in
  a follow-up.
- Repo-wide `npm run lint` has a large pre-existing failure baseline (337 errors, mostly
  `src/components/charts/**` react-hooks rules). Scoped lint over my 18 touched files returns exactly
  1 error: the pre-existing `// @ts-ignore` on `next.config.ts:4`, which I did not add and which the
  plan does not touch. Not fixed (out of scope).
- No test asserts logger-call arguments anywhere in this repo, so item 7a's `logger.warn` extension
  remains unproven by test — consistent with the contract's own "What this coverage does NOT prove".

## Closeout Packet

- **Selected plan:** `process/general-plans/active/full-codebase-review_19-08-26/full-codebase-review_PLAN_19-08-26.md`
- **Finished:** all 6 sections (F7, F6, F1, F2+F4, F5, F3) code-complete; every per-section gate green;
  final 13-file regression pass green; typecheck clean.
- **Verified:** all 16 SPEC Acceptance Criteria have a green Fully-Automated proving gate.
- **Still unverified:** the contract's own declared non-proofs (real-browser XSS, live Redis
  throttling in prod, live Supabase session behavior, real `next/image` optimizer). Plus the
  Redis-provisioning prerequisite below.
- **Remaining cleanup:** context-doc capture for the new `sanitize-html` dependency and the new
  limiter tier; plan archival.
- **Single best next state:** `Ready for UPDATE PROCESS archival` — pending the orchestrator's
  independent EVL confirmation run (vc-tester re-running the gate commands).

## Follow-Ups Raised (non-blocking, per plan Section 5)

1. **Redis provisioning (F4/F5 infra prerequisite) — raise before prod:** `rateLimiter()` fail-opens
   when `redis` is falsy. If `REDIS_URL` is not provisioned in production, F4/F5's code lands
   correctly but throttles nothing at runtime. Not a code defect; an infra checklist item.
2. **Blog content-migration side effect:** existing published posts containing out-of-allowlist tags
   (`<table>`, `<iframe>`, inline `style`) will visibly change on next render (read-time sanitize)
   and be permanently stripped on next save. SPEC-accepted (AC6/AC7) — flag to the content/business
   owner, not a code risk.
3. **`vitest.config.ts` `test.env`** should gain `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to unblock `lib/useAddresses.test.tsx` (pre-existing gap).

**CONTEXT_PARTIAL:** none.

**Follow-up plan stubs created:** none — all three follow-ups above are non-blocking notes captured
in this report for the UPDATE PROCESS closeout, per the plan's own instruction to surface (not bury)
the Redis prerequisite.

## Forward Preview

### Test Infra Found
Vitest-only, 51 suites. Co-located `*.test.ts(x)`. `// @vitest-environment node` docblock mandatory
for any file importing a `server-only` chain. `vi.hoisted` + `vi.mock` at the module boundary is the
universal mocking convention; `vi.resetModules()` + `vi.doMock()` for per-test module re-import.
Note: `vi.clearAllMocks()` clears calls but NOT implementations — use `...Once` variants for
per-test behavior overrides.

### Blast Radius Changes
13 files modified, 6 new files created (1 source + 5 tests), 2 new dependencies
(`sanitize-html`, `@types/sanitize-html`). No schema/migration change. No new env vars. No new routes.

### Commands to Stay Green
```
npx vitest run next.config.test.ts features/checkout/services/payos.service.test.ts app/api/staff/uploads/route.test.ts features/checkout/services/checkout.service.test.ts app/api/auth/session/route.test.ts app/api/auth/refresh/route.test.ts features/admin-users/services/admin-users.repository.test.ts app/api/auth/email-status/route.test.ts src/middlewares/rate-limit.middleware.test.ts app/api/contact/route.test.ts lib/sanitize-blog-html.test.ts features/admin-blog/services/admin-blog.repository.test.ts features/blog/services/blog.service.test.ts
npm run type-check
```

### Dependency Changes
- `sanitize-html@^2.17.7` (prod) — blog HTML allowlist sanitization.
- `@types/sanitize-html@^2.16.1` (dev) — types are NOT bundled with the package.
