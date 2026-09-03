---
name: plan:role-revocation-session-fix-spec
description: "SPEC — downgrading a Staff/Admin role must invalidate the user's existing session instead of letting the stale elevated role survive token refresh"
date: 03-09-26
feature: auth
---

# SPEC — Role Downgrade Must Revoke the Stale Session

## Summary

Today, when an Admin lowers someone's role (for example, taking Staff access away from an
employee, or knocking an Admin down to a plain user), that person keeps their old, more powerful
access until their session eventually expires on its own — which can be indefinitely, because the
app currently re-issues fresh tokens carrying the *old* role forever. This is a critical security
hole: a de-privileged user (e.g. a fired employee, or a staff account caught misusing admin tools)
can keep acting as Staff/Admin after an admin explicitly tried to take that access away. This SPEC
locks the requirement that a role downgrade actually takes effect on the person's live session —
mirroring how "locking" an account already works correctly today.

## User Stories / Jobs To Be Done

- **As an Admin**, I want changing a user's role down (e.g. Staff → User, Admin → User) to
  actually and promptly end their elevated access, so that de-privileging someone is a real,
  trustworthy security action and not just a database label change.
- **As an Admin**, I want promoting a user's role (e.g. User → Staff) to keep working reliably, so
  that legitimate role upgrades are not accidentally broken while fixing the downgrade bug.
- **As a Staff/Admin user whose role is downgraded**, I want my session to stop granting me
  elevated access shortly after the change, so that the system behaves the way a reasonable person
  would expect ("if my access was revoked, I shouldn't still have it").
- **As the business/security owner of this app**, I want the role-revocation fix to follow the
  same trusted pattern already used for account locking (`setLocked`), so we're not inventing a new,
  unproven mechanism for a security-critical fix.

## What The User Wants (Behavioral Outcomes)

- When an Admin downgrades a user's role in the admin panel, that user's ability to act with the
  old (higher) role stops working within one refresh cycle of their session — in practice, the next
  time their browser silently refreshes its session token, the stale higher role is invalidated
  rather than being carried forward.
- When an Admin upgrades a user's role, the user continues to be able to use the app without
  interruption, and gains their new role's access on their next refresh (or immediately, if the fix
  also revokes on upgrade — see Open Questions/Constraints below for the exact default).
- Locking a user's account continues to behave exactly as it does today — immediate, forced
  logout. This fix must not weaken or change that existing behavior.
- There is one known, accepted limitation this fix does NOT close: a person's already-issued
  short-lived access token (currently defaults to 15 minutes) can still work for up to that window
  after a downgrade, because the app deliberately does not check the database on every single
  request (a performance decision already made and out of scope here). The fix guarantees the
  stale role cannot survive past the next token refresh — not that it disappears instantly on every
  request.

## Flow / State Diagram

```
Today (the bug):
  Admin downgrades STAFF -> USER
        |
        v
  users.role updated in DB   (no token revocation happens)
        |
        v
  User's browser silently refreshes session
        |
        v
  Refresh route copies "role" from the OLD token  --> issues NEW token, still says STAFF
        |
        v
  User keeps STAFF access indefinitely  <-- BUG


After this fix:
  Admin downgrades STAFF -> USER
        |
        v
  users.role updated in DB
        |
        v
  Downgrade detected --> all of this user's refresh tokens are revoked
        (mirrors the existing setLocked() pattern)
        |
        v
  User's browser attempts to silently refresh session
        |
        +--> refresh token was revoked --> refresh REJECTED --> forced re-login
        |
        +--> (defense-in-depth) even if a refresh token somehow still looks valid,
             refresh route re-checks the CURRENT role in the DB (not the old token's
             claim) --> stale role never gets copied forward again
        |
        v
  User must log in again --> gets a fresh token with the CORRECT (downgraded) role
        |
        v
  Elevated (STAFF) access is gone. Bug closed.


Upgrade path (must keep working, not regress):
  Admin upgrades USER -> STAFF
        |
        v
  users.role updated in DB
        |
        v
  (per recommended default) upgrade does NOT force-revoke existing tokens
        |
        v
  User's next normal session refresh re-checks DB role --> now picks up STAFF
        |
        v
  User has new STAFF access after next refresh, no forced logout, no broken session


Existing lock path (must not regress):
  Admin locks account (is_deleted = true)
        |
        v
  setLocked() already revokes all refresh tokens immediately (unchanged by this fix)
        |
        v
  User is forced to re-authenticate; login is blocked while locked (unchanged)
```

## Acceptance Criteria (Testable Outcomes)

1. **Downgrading a Staff or Admin user revokes their outstanding refresh tokens**, the same way
   locking an account does today.
   proven by: new unit test on `admin-users.repository.ts` `setRole()` — asserts
   `refreshTokenService.revokeAllForUser(id)` is called when the new role is a downgrade from the
   old role (mirrors the existing `setLocked` test pattern for `locked === true`).
   strategy: Fully-Automated

2. **A user whose role was downgraded cannot keep using their old refresh token to obtain a new
   access token that still carries the old, higher role.** Attempting to refresh with a revoked
   token is rejected, forcing re-login.
   proven by: new unit/integration test on `app/api/auth/refresh/route.ts` — simulates a refresh
   attempt after the user's tokens were revoked by a downgrade; asserts the route rejects the
   request (matching the existing pattern used for `is_deleted` rejection).
   strategy: Fully-Automated

3. **The refresh route no longer blindly copies the role from the old token's JWT payload.** It
   re-checks the user's current role in the database as part of the same query that already checks
   `is_deleted`, and rejects (forcing re-login) when the token's claimed role no longer matches the
   current database role.
   proven by: new unit/integration test on `app/api/auth/refresh/route.ts` — DB role differs from
   token's claimed role (simulating the race-window edge case where revocation fired late); asserts
   rejection rather than silently re-issuing a token with the stale role.
   strategy: Fully-Automated

4. **Upgrading a user's role (e.g. User → Staff) continues to work without breaking their
   session** — no unexpected forced logout, and the user is able to use their new role's access
   after their next normal refresh (immediately if revocation-on-upgrade is also chosen — see
   Constraints).
   proven by: new unit test on `setRole()` for the upgrade direction, plus an integration test that
   a subsequent refresh reflects the new role correctly.
   strategy: Fully-Automated

5. **`setLocked()`'s existing immediate-revocation behavior for locked accounts is unchanged** by
   this fix (no regression).
   proven by: existing `setLocked` test(s) continue to pass unmodified; explicit regression
   assertion added if not already covered.
   strategy: Fully-Automated

6. **The `is_deleted` (locked account) rejection behavior on the refresh route is unchanged** by
   this fix (no regression) — locked accounts are still rejected exactly as before.
   proven by: existing refresh-route `is_deleted` rejection test(s) continue to pass unmodified.
   strategy: Fully-Automated

## Out Of Scope

- **Closing the residual access-token window.** An already-issued access token remains valid for
  up to its configured lifetime (default 15 minutes) after a downgrade, because access tokens are
  intentionally never checked against the database on a per-request basis (a deliberate, documented
  performance tradeoff). Shrinking or eliminating this window would require a much larger
  architecture change (e.g. per-request DB/cache lookup) and is explicitly not part of this fix.
- **The refresh-token `rotate()` race condition.** A separate, already-identified issue exists in
  `refresh-token.service.ts`'s `rotate()` method (non-atomic revoke-then-store sequence). It is
  related but independent of this bug and needs its own SPEC/fix — it is not addressed here.
- **Adding a `ROLE_CHANGED` audit-log event.** No audit event exists today for role changes; adding
  one is a smaller, separate follow-up and is not required for this fix to be considered complete.
- **Any change to how role is verified on every other authenticated request** (the JWT-claim-based,
  zero-DB-lookup design in `authenticate.middlware.ts` / `proxy.ts`). That design is a deliberate
  performance tradeoff and stays exactly as-is.
- **UI/UX changes to the admin role-change screen** (e.g. confirmation dialogs, warnings shown to
  the admin). This fix is backend session-integrity only.
- **Any change to lock/unlock (`setLocked`) behavior itself** beyond verifying it still works
  (see Acceptance Criterion 5) — it is the reference implementation, not something to modify.

## Constraints

- **Recommended default (flagged, not silently decided) — revoke on downgrade only, not on every
  role change.** `setRole()` should call `refreshTokenService.revokeAllForUser(id)` only when the
  new role is a *downgrade* from the old role (mirrors `setLocked`'s existing asymmetric
  precedent: revoke on lock, not on unlock). Upgrades do not force a logout. This can be
  overridden at PLAN review if the user wants all role changes (including upgrades) to force
  revocation for stronger security guarantees at the cost of disrupting legitimate upgrades.
- **Recommended default (flagged, not silently decided) — refresh-route defense-in-depth check
  rejects and forces re-authentication on role mismatch**, exactly mirroring the existing
  `is_deleted` rejection pattern in the same route (not a "softer" partial-trust behavior).
- **Recommended default (flagged, not silently decided) — no `ROLE_CHANGED` audit-log event is
  added in this fix.** This is a deliberate scope cut, not an oversight — call it out as a
  noted gap for a future, smaller follow-up.
- The fix must reuse the existing `revokeAllForUser(userId)` method and the existing `revoked_at`
  column on `refresh_tokens` — no new database schema or new revocation mechanism should be
  needed; `setLocked()` is the reference implementation to follow for this pattern.
- The fix must not add a per-request database lookup to the JWT-claim-based role-check path used
  on every other request (`authenticate.middlware.ts`, `proxy.ts`) — that would contradict the
  documented, deliberate performance design and is out of scope.
- Guard-clause ordering already locked in the refresh route (rate-limit check first, then DB
  lookup) must be preserved — do not reorder existing guard clauses when adding the role recheck.
- All new automated coverage must use the existing Vitest patterns already established in this
  repo (mocked Supabase client at the module boundary via `vi.hoisted`/`vi.mock`; `// @vitest-environment
  node` docblock for server-only files) — there is no e2e/Playwright suite and no OAuth test-login
  bypass, so all acceptance criteria must be provable via Vitest unit/integration tests, not
  browser walkthroughs.

## Open Questions

None — all four product decisions surfaced during RESEARCH have been resolved with an explicit
recommended default, captured above in Constraints and reflected in the Acceptance Criteria. Each
is flagged clearly enough that the user (or PLAN reviewer) can override at the next phase if they
disagree with the default:

1. Revoke on every role change vs. downgrade-only → **resolved: downgrade-only** (mirrors
   `setLocked`), overridable at PLAN.
2. Refresh-route recheck: reject vs. softer handling → **resolved: reject and force re-auth**
   (mirrors `is_deleted`), overridable at PLAN.
3. `ROLE_CHANGED` audit event → **resolved: out of scope for this fix**, noted as a follow-up gap.
4. Residual ≤15-minute access-token window → **resolved: accepted architectural tradeoff**, not
   part of this fix's acceptance criteria.

## Background / Research Findings

- **Root cause, two parts** (already confirmed via source read, not re-investigated here):
  1. `setRole()` in `features/admin-users/services/admin-users.repository.ts:87-103` updates only
     the `users` row and never calls `refreshTokenService.revokeAllForUser(id)`. Its sibling
     `setLocked()` (lines 105-129) DOES call `revokeAllForUser` on lock — an asymmetry within the
     same file that this fix closes.
  2. `app/api/auth/refresh/route.ts:63-86` re-signs new tokens by copying `role` straight from the
     OLD token's JWT payload (`payload.role`). It already does a DB lookup on line 63-67 but
     currently selects only `is_deleted`, never `role`.
- **Role enforcement is 100% JWT-claim-based** with zero DB lookup on every other request
  (`src/middlewares/authenticate.middlware.ts:25-26`, `proxy.ts`) — a deliberate, documented perf
  tradeoff (migration comment: access tokens are "verify thuần bằng chữ ký... để không phải query
  DB mỗi request API"). Confirmed not in scope to change.
- **The fix substrate already exists and is unused for roles**: `refresh_tokens` table has a
  `revoked_at` column; `refreshTokenService.revokeAllForUser(userId)`
  (`features/auth/services/refresh-token.service.ts:64-73`) bulk-revokes. `setLocked()` is the
  working reference implementation for the exact pattern needed here (revoke on privilege change +
  refresh-route defense-in-depth check) — see `process/context/auth/all-auth.md` "Account-lock
  enforcement" section for the existing, already-shipped precedent.
- **Residual exposure window is architectural, not fixable here**: even with this fix, an
  already-issued access token stays valid up to `EXPIRE_ACCESS_TOKEN` (default 15m) because access
  tokens are never DB-checked per request. Explicitly accepted as out of scope per the JWT-stateless
  design tradeoff.
- **Separate, related High-severity finding** (not folded into this SPEC): refresh-token
  `rotate()` (`features/auth/services/refresh-token.service.ts:76`) has a non-atomic
  revoke-then-store race condition. Flagged as an explicit Out of Scope / Related Issue needing its
  own SPEC.
- **No existing plan covers this** — confirmed empty in `process/general-plans/active/`,
  `process/features/auth/active/` (only the unrelated `google-only-auth_23-08-26` folder exists),
  and `process/features/admin-users/active/`.
- **Test coverage gaps found** (from RESEARCH, confirmed against `process/context/tests/all-tests.md`):
  zero test asserts `setRole` revokes tokens on downgrade; zero test asserts the refresh route
  re-checks role; `authenticate.middlware.ts`, `jwt.service.ts`, `refresh-token.service.ts`,
  `proxy.ts` have zero test coverage in general. This SPEC's acceptance criteria are designed to
  close the two most security-critical of these gaps (criteria 1–4); the broader zero-coverage gap
  on those four files as a whole remains a larger follow-up, not fully closed by this fix.
- **Test infra facts used to ground `proven by` claims**: this repo has Vitest only, no
  Playwright/e2e suite, no OAuth test-login bypass (`process/context/tests/all-tests.md` "Known
  Gaps"). All criteria above are therefore scoped to Fully-Automated Vitest unit/integration tests
  using the existing mocked-Supabase-client pattern — never an Agent-Probe browser walkthrough,
  which would be blocked by Google-OAuth-only auth in this repo.
