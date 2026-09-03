---
phase: role-revocation-session-fix
date: 2026-09-03
status: COMPLETE
feature: auth
plan: process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_PLAN_03-09-26.md
---

# EXECUTE Report — Role Downgrade Must Revoke the Stale Session

TL;DR: all 6 implementation checklist items applied exactly as planned, all 4 verification gates green, 0 deviations. One pre-existing unrelated test-file failure (`lib/useAddresses.test.tsx`, missing Supabase env vars) confirmed to fail identically on a clean tree. Manual reviewer sign-off (`review-decision.json`) is the one remaining item before closure — this is auth/identity high-risk class.

## What Was Done

| Step | File | Change |
|---|---|---|
| 1 | `features/auth/services/auth.service.ts` | Added module-scope `ROLE_RANK` (user=0 < staff=1 < admin=2), `roleRank()`, `isDowngrade()`; exposed both on the existing `authService` object. Pure, no `this`, no side effects. |
| 2 | `features/admin-users/services/admin-users.repository.ts` | `setRole()` pre-reads the current DB role (SELECT before UPDATE), converts old+new via `authService.fromDbRole()`, and calls `refreshTokenService.revokeAllForUser(id)` after a successful UPDATE **only on a downgrade**. Mirrors `setLocked()`'s post-update revoke pattern. Added the `authService` import. |
| 3 | `app/api/auth/refresh/route.ts` | Widened the existing single `SELECT is_deleted` to `SELECT is_deleted, role` (no new round trip; `lockedProfile` renamed to `profile` per plan). Added the role-mismatch block: downgrade → `revokeAllForUser` + `ForbiddenError` (mirrors the `is_deleted` path exactly); upgrade → sets `effectiveRole` from the DB and continues. `effectiveRole` replaces `payload.role` in `newPayload`. Ordering preserved: rate-limit → JWT verify → DB lookup → is_deleted → **role check** → `isActive` → rotate (E2 binding instruction honored). |
| 4 | `features/auth/services/auth.service.test.ts` (new) | 4 tests covering rank ordering plus all 9 pairwise downgrade/upgrade/same-role combinations. |
| 5 | `features/admin-users/services/admin-users.repository.test.ts` | 3 new tests (downgrade-revokes / upgrade-does-not-revoke / same-rank-does-not-revoke) using **sequential mocking** (`mocks.from.mockReturnValueOnce(...).mockReturnValueOnce(...)`) so the pre-read genuinely returns the OLD role and the update-select the NEW row — per E1. No existing test modified. |
| 6 | `app/api/auth/refresh/route.test.ts` | `setLockedFlag(isDeleted, role = "USER")` now stages a matching `role` field (regression guard). 2 new tests: downgrade-reject (also asserts `isActive` was never called, proving the ordering) and upgrade-reissue (asserts the decoded access token carries `role: "STAFF"`). No existing test modified. |

Evidence pack written to `process/features/auth/active/role-revocation-session-fix_03-09-26/harness/`: `risk-gate.json`, `context-snippets.json`, `verification.json`, `adversarial-validation.json`.

## What Was Skipped or Deferred

- `review-decision.json` — **intentionally not written**. Reviewer sign-off is manual-first by definition and belongs to the user, not this agent. The pack is incomplete until it exists.
- All SPEC out-of-scope items untouched as instructed: no schema change, no `ROLE_CHANGED` audit event, no atomic transaction/locking, no changes to `authenticate.middlware.ts` / `proxy.ts`, no touch of the `rotate()` race condition in `refresh-token.service.ts:76`.

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| Helper unit | `npx vitest run features/auth/services/auth.service.test.ts` | PASS — 4/4 |
| Repository | `npx vitest run features/admin-users/services/admin-users.repository.test.ts` | PASS — 15/15 (12 pre-existing + 3 new) |
| Refresh route | `npx vitest run app/api/auth/refresh/route.test.ts` | PASS — 10/10 (8 pre-existing + 2 new) |
| Full regression | `npx vitest run` | PASS — 414/414 tests, 62/63 files (see note) |
| Typecheck | `npx tsc --noEmit` | PASS — clean |

Gates were run per-section after steps 1, 2, and 3 respectively (not batched), per the plan's sequential-dependency discipline.

**Regression-suite note:** `lib/useAddresses.test.tsx` fails at *import* time with `@supabase/ssr: Your project's URL and API key are required` — a missing-env-var collection error, not a test assertion failure (0 tests failed suite-wide). Confirmed pre-existing by stashing all changes (`git stash -u`) and reproducing the identical failure on a clean tree. Outside this change's blast radius.

## Plan Deviations

None. Every touchpoint matches the plan's Touchpoints table and Implementation Checklist code blocks. Both binding Execute-Agent Instructions were honored: E1 (sequential mocking in the repository test) and E2 (role check placed before `isActive()`).

## Test Infra Gaps Found

- Real end-to-end browser cookie-refresh round trip remains unprovable: no e2e/Playwright suite, Google-OAuth-only auth with no test-login bypass. Pre-existing and already tracked in `process/context/tests/all-tests.md` "Known Gaps" — not introduced here, no new backlog stub created.
- `lib/useAddresses.test.tsx` cannot run without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the test environment. Pre-existing; a separate, unrelated follow-up.
- Broader zero-coverage on `authenticate.middlware.ts`, `jwt.service.ts`, `proxy.ts` is unchanged by this plan (only the two named security-critical call sites were closed).

## Closeout Packet

- **Selected plan:** `process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_PLAN_03-09-26.md`
- **Finished:** all 6 checklist items; 6 files changed (3 source, 2 tests extended, 1 test file new); 9 new tests.
- **Verified:** all 4 Verification Evidence commands green + typecheck clean.
- **Still unverified:** real browser refresh flow (blocked, accepted); reviewer sign-off on the high-risk evidence pack.
- **Remaining cleanup:** user records `review-decision.json`; then commit; then UPDATE PROCESS (archive plan, update `process/context/auth/all-auth.md` with the role-downgrade revocation precedent alongside the existing account-lock one).
- **Best next valid state:** `Keep in active/testing` — code-complete and fully green on automated gates, but the auth/identity manual-first reviewer decision is not yet recorded, so this must not be self-certified as ready for archival.

## Forward Preview

- **Test Infra Found:** Vitest 4.1.10; `// @vitest-environment node` docblock required for `server-only` modules; mocked-Supabase-client-at-module-boundary via `vi.hoisted` + `vi.mock`. Multi-call repository methods now require `mockReturnValueOnce` chaining rather than the shared `makeBuilder(result)` fixture — worth remembering for any future repository method that reads before writing.
- **Blast Radius Changes:** `features/admin-users/services/admin-users.repository.ts` now imports `@/features/auth/services/auth.service` (new, safe: pure module, no `server-only` guard). `setRole()` costs one extra DB round trip per role change (admin-panel action, not a hot path).
- **Commands to Stay Green:** `npx vitest run features/auth/services/auth.service.test.ts`, `npx vitest run features/admin-users/services/admin-users.repository.test.ts`, `npx vitest run app/api/auth/refresh/route.test.ts`, `npx vitest run`, `npx tsc --noEmit`.
- **Dependency Changes:** none. No packages added or removed.
