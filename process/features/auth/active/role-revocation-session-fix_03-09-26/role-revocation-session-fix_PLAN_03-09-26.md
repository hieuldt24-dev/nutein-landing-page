---
name: plan:role-revocation-session-fix
description: "PLAN — downgrading a Staff/Admin role must revoke outstanding refresh tokens (mirrors setLocked), and the refresh route must reject on a downgrade-role mismatch instead of blindly copying the old JWT's role forward"
date: 03-09-26
feature: auth
---

# PLAN — Role Downgrade Must Revoke the Stale Session

**Date**: 03-09-26  
**Complexity**: Simple  
**Status**: ⏳ PLANNED

## Overview

Locked SPEC: `process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_SPEC_03-09-26.md`

Repo context loaded per `process/context/all-context.md` -> `process/context/auth/all-auth.md` (two-layer auth model, JWT role claims, account-lock enforcement precedent) and `process/context/tests/all-tests.md` (Vitest-only, mocked-Supabase-client convention).

Two-file fix, SIMPLE shape, no schema changes:

1. `admin-users.repository.ts` `setRole()` gains the same revoke-on-privilege-reduction behavior
   `setLocked()` already has — but conditioned on the change being a **downgrade** (rank
   comparison), not unconditional.
2. `app/api/auth/refresh/route.ts` stops blindly copying `role` from the old JWT payload. It
   re-checks the DB row's current `role` in the same query that already reads `is_deleted`, and:
   - on a **downgrade** mismatch → rejects (mirrors the `is_deleted` rejection path exactly:
     `revokeAllForUser` + throw, no cookies set)
   - on an **upgrade** (or any non-downgrade) mismatch → does NOT reject; reissues the new token
     pair using the **current DB role**, so the user is not force-logged-out but does pick up
     their new role on this refresh

A new shared helper (`roleRank` / `isDowngrade`) in `features/auth/services/auth.service.ts` is
the single source of truth for "is this a downgrade", used by both touchpoints, so the two call
sites can never drift out of sync on what counts as a downgrade.

## Design Decision — Resolving the Refresh-Route Reject-vs-Reissue Ambiguity

The INNOVATE handoff flagged that SPEC's Acceptance Criterion 3 ("rejects... when the token's
claimed role no longer matches the current database role") could be read as "reject on ANY
mismatch (up or down)" — but Acceptance Criterion 4 requires upgrades to "continue to work...
with no unexpected forced logout" and to be verified via "a subsequent refresh reflects the new
role correctly" (i.e. refresh must **succeed**, not reject, for upgrades).

**Resolution (locked, not left ambiguous):** the refresh-route role recheck is
**downgrade-specific**, using the exact same `isDowngrade()` rank helper as `setRole()`:

| Mismatch direction | Refresh route behavior | Which AC this satisfies |
|---|---|---|
| `payload.role` (old JWT claim) is a **downgrade** vs. current DB `role` | **Reject** — mirror the `is_deleted` path exactly: `revokeAllForUser(sub)` then throw, no cookies set | AC3 — this is the "race-window edge case where revocation fired late" scenario the SPEC describes; by the time a genuinely-downgraded user's token is *already revoked* (from `setRole`'s immediate revoke), this branch is a pure defense-in-depth backstop for the narrow race window before that revoke lands |
| `payload.role` is an **upgrade** (or otherwise not a downgrade) vs. current DB `role` | **Do NOT reject** — reissue the token pair using the **current DB role** instead of the stale JWT claim | AC4 — no forced logout on upgrade; the reissued token reflects the new role immediately on next refresh |
| `payload.role === profile.role` (no mismatch) | Unchanged — proceed exactly as today | AC4 regression guard, AC6 |

This keeps both touchpoints (setRole's revoke trigger, and the refresh route's reject trigger)
using the identical "downgrade" definition, and both are asymmetric in the same direction as the
existing, trusted `setLocked` precedent (act only on privilege *reduction*, never on privilege
*increase*).

## Touchpoints

| # | File | Range | Change |
|---|---|---|---|
| T1 | `features/auth/services/auth.service.ts` | lines 1-23 (whole file, small) | Add `roleRank(role: AuthRole): number` and `isDowngrade(oldRole: AuthRole, newRole: AuthRole): boolean` to the exported `authService` object |
| T2 | `features/admin-users/services/admin-users.repository.ts` | `setRole()` at lines 87-103; new import line near top (after line 5) | Add a pre-update SELECT of the current `role`; after a successful UPDATE, revoke all refresh tokens for the user iff the change is a downgrade |
| T3 | `app/api/auth/refresh/route.ts` | lines 63-91 (the existing DB-lookup block through `newPayload` construction); new import near line 18 | Extend the existing `SELECT is_deleted` to also select `role`; add downgrade-reject / upgrade-reissue-with-current-role logic; use the resulting `effectiveRole` when signing `newPayload` |
| T4 | `features/auth/services/auth.service.test.ts` (new file) | whole file | Unit tests for `roleRank` / `isDowngrade` |
| T5 | `features/admin-users/services/admin-users.repository.test.ts` | new `describe`/`it` blocks appended after line 172 (end of existing `describe` block, before final `});`) | New tests for downgrade-revokes / upgrade-does-not-revoke; existing tests (lines 1-172) must pass unmodified |
| T6 | `app/api/auth/refresh/route.test.ts` | `setLockedFlag()` helper at lines 46-57 (extend signature); new `it()` blocks appended after line 181 (end of `describe`, before final `});`) | Extend the mock helper to also stage a `role` field (default `"USER"`, matching `payload.role`) so all 8 existing tests (lines 76-181) keep passing unmodified; add new tests for the downgrade-reject and upgrade-reissue paths |

No other files change. No schema/migration change (reuses `revoked_at` on `refresh_tokens`, per
SPEC Constraints). No changes to `authenticate.middlware.ts` or `proxy.ts` (per SPEC Out of Scope).

## Public Contracts

- `authService.roleRank` / `authService.isDowngrade` — new internal helper functions, not exported
  outside `features/auth/services/auth.service.ts`'s existing export surface (added to the same
  `authService` object already imported elsewhere as `import { authService } from
  "@/features/auth/services/auth.service"`). No breaking change to `fromDbRole` / `isStaffOrAdmin`.
- `adminUsersRepository.setRole(id, role)` — return type and call signature **unchanged**. Behavior
  change only: may now additionally revoke refresh tokens as a side effect when the new role is a
  downgrade. Callers (`admin-users.service.ts`, the `PATCH /api/admin/users/:id` route) need no
  changes.
- `POST /api/auth/refresh` — response shape **unchanged** for the non-mismatch and upgrade-reissue
  paths (200, two cookies set, `{ expiresIn }`). New behavior: on a downgrade-role mismatch it
  returns the same shape as the existing `is_deleted` rejection (`ForbiddenError` → 403, no
  cookies set, no body change beyond the error shape `withErrorHandler` already produces for
  `AppError`).

## Blast Radius

**High-risk class: auth / identity** (per `process/development-protocols/orchestration.md`
§High-Risk Execution Handoff). This plan touches session/token revocation and role-trust
enforcement directly. **VALIDATE and EXECUTE for this plan should treat the manual-first evidence
handoff as expected**, not optional — i.e. before this plan is treated as ready for closure,
capture explicit runtime evidence (test run output at minimum; a manual refresh-flow walkthrough
if the OAuth-only auth constraint allows it) rather than relying on green Vitest alone. This
repo's `process/context/tests/all-tests.md` "Known Gaps" already flags `authenticate.middlware.ts`,
`jwt.service.ts`, `refresh-token.service.ts`, and `proxy.ts` as having zero coverage — this plan
does not close that broader gap, only the two specific security-critical call sites named in the
SPEC's acceptance criteria.

- **Files changed:** 3 source files (T1-T3) + 3 test files (T4 new, T5 + T6 extended) = 6 files
  total.
- **Packages touched:** `features/auth`, `features/admin-users`, `app/api/auth/refresh` — all
  within the single Next.js app (no monorepo package boundary crossed).
- **No new dependencies, no new runtime surface, no new agent/service.**
- **No atomic transaction** — matches existing `setLocked()` precedent (update succeeds, then
  revoke is a best-effort follow-up call; a crash between the two leaves the DB role changed but
  tokens not yet revoked, exactly the same residual risk `setLocked()` already accepts today).

## Implementation Checklist

1. **`features/auth/services/auth.service.ts`** — add two functions to the exported `authService`
   object (do not use `this` inside the object literal; reference `fromDbRole` results only via
   already-computed local `AuthRole` values passed in as parameters, keeping the functions pure
   and independent of call context):
   ```ts
   const ROLE_RANK: Record<AuthRole, number> = { user: 0, staff: 1, admin: 2 };

   function roleRank(role: AuthRole): number {
     return ROLE_RANK[role];
   }

   function isDowngrade(oldRole: AuthRole, newRole: AuthRole): boolean {
     return roleRank(newRole) < roleRank(oldRole);
   }
   ```
   Add `roleRank` and `isDowngrade` as properties on the exported `authService` object (alongside
   `fromDbRole` and `isStaffOrAdmin`), referencing the module-scope functions above.

2. **`features/admin-users/services/admin-users.repository.ts`** — add import:
   ```ts
   import { authService } from "@/features/auth/services/auth.service";
   ```
   Rewrite `setRole` (lines 87-103) to:
   ```ts
   async function setRole(id: string, role: AuthRole): Promise<AdminManagedUser> {
     const client = requireAdminClient();

     const { data: currentRow } = await client
       .from("users")
       .select("role")
       .eq("id", id)
       .maybeSingle();

     const { data, error } = await client
       .from("users")
       .update({ role: role.toUpperCase() })
       .eq("id", id)
       .select(USER_SELECT)
       .maybeSingle();

     if (error) {
       throw new Error(`Không cập nhật được vai trò: ${error.message}`);
     }
     if (!data) {
       throw new NotFoundError("User");
     }

     // Downgrade -> thu hồi toàn bộ refresh token hiện có (mirrors setLocked's
     // revoke-on-privilege-reduction pattern). Upgrade không revoke.
     if (currentRow) {
       const oldRole = authService.fromDbRole((currentRow as { role: DbRole }).role);
       if (authService.isDowngrade(oldRole, role)) {
         await refreshTokenService.revokeAllForUser(id);
       }
     }

     return toAdminManagedUser(data as UserRow);
   }
   ```
   Note: `currentRow` being `null`/`undefined` (id not found on the pre-read) is handled
   gracefully — the revoke check is simply skipped, and the subsequent UPDATE's own
   `NotFoundError` throw (unchanged, still fires if the row truly doesn't exist) still protects
   against the not-found case exactly as it does today.

3. **`app/api/auth/refresh/route.ts`** — add import:
   ```ts
   import { authService } from "@/features/auth/services/auth.service";
   ```
   Replace the existing DB-lookup block (lines 63-72) and the `newPayload` line (line 86) as
   follows — **preserve the existing guard-clause ordering** (rate-limit → refresh-token JWT
   verify → this DB lookup → isActive check → rotate):
   ```ts
   const { data: profile } = await requireAdminClient()
     .from("users")
     .select("is_deleted, role")
     .eq("id", payload.sub)
     .maybeSingle();

   if (profile?.is_deleted === true) {
     await refreshTokenService.revokeAllForUser(payload.sub);
     throw new ForbiddenError("Tài khoản đã bị khóa");
   }

   // F-role — refresh route không được copy mù `role` từ JWT cũ nữa. Nếu role
   // trong DB đã đổi so với claim trong token cũ:
   //  - hạ quyền (downgrade) -> từ chối, mirror hệt path is_deleted ở trên
   //    (đây là lớp phòng vệ thứ 2 cho khoảng race hẹp trước khi
   //    setRole()'s revokeAllForUser kịp có hiệu lực).
   //  - nâng quyền (upgrade) / không phải downgrade -> KHÔNG từ chối, chỉ
   //    dùng role hiện tại trong DB khi cấp lại token, để không ép user phải
   //    đăng nhập lại một cách không cần thiết.
   let effectiveRole = payload.role;
   if (profile && profile.role !== payload.role) {
     const oldAuthRole = authService.fromDbRole(payload.role);
     const newAuthRole = authService.fromDbRole(profile.role);
     if (authService.isDowngrade(oldAuthRole, newAuthRole)) {
       await refreshTokenService.revokeAllForUser(payload.sub);
       throw new ForbiddenError("Vai trò đã thay đổi, vui lòng đăng nhập lại");
     }
     effectiveRole = profile.role;
   }

   const isActive = await refreshTokenService.isActive(refreshToken);
   if (!isActive) {
     // ... unchanged ...
   }

   const newPayload = { sub: payload.sub, email: payload.email, role: effectiveRole };
   ```
   `effectiveRole` replaces the old direct `payload.role` reference in the `newPayload` literal
   (was line 86). Everything else in the route (`isActive` check, `rotate`, audit log, cookie
   setting) is unchanged.

4. **New file `features/auth/services/auth.service.test.ts`** — `roleRank` / `isDowngrade` unit
   tests (no `// @vitest-environment node` docblock needed — `auth.service.ts` has no
   `"server-only"` import and no side effects, so the default jsdom environment is fine, matching
   how this module is safely imported client-side elsewhere).

5. **Extend `features/admin-users/services/admin-users.repository.test.ts`** — append new
   `it()` blocks inside the existing `describe("adminUsersRepository.setRole / setLocked", ...)`
   block (after line 163, before the "không tìm thấy" test at line 165, or after it — ordering
   within the block does not matter). Do not modify any existing `it()` block.
   **VALIDATE finding (E1 — see Validate Contract): the shared `makeBuilder(result)` test helper
   returns ONE fixed `result` for every `.from("users")` call the mock intercepts. `setRole()`
   after this change performs TWO separate `.from("users")...maybeSingle()` calls (the new
   pre-update SELECT of the current role, then the existing UPDATE...SELECT). The new downgrade/
   upgrade tests MUST distinguish these two calls' results (old role vs. post-update row) —
   do not reuse a single shared `result` object for both. Use sequential mocking
   (`mocks.from.mockReturnValueOnce(builderA).mockReturnValueOnce(builderB)`, or extend
   `makeBuilder`'s `maybeSingle` to `mockResolvedValueOnce` per call) so the pre-read genuinely
   returns the OLD role and the post-update read genuinely returns the NEW row. A test written
   against the existing single-shared-result pattern will silently misclassify the downgrade/
   upgrade rank comparison (both reads collapse to the same role) and either fail for the wrong
   reason or pass without exercising the intended two-step read/write/revoke logic.**

6. **Extend `app/api/auth/refresh/route.test.ts`**:
   - a. Modify `setLockedFlag()` (lines 46-57) to accept an optional second parameter and stage a
     `role` field, defaulting to `"USER"` (matching the module-level `payload.role`) so every
     existing call site (`setLockedFlag(false)`, `setLockedFlag(true)`) continues to produce a
     matching role and every existing test (lines 76-181) still passes unmodified:
     ```ts
     function setLockedFlag(isDeleted: boolean | null, role: string = "USER") {
       mocks.maybeSingle.mockResolvedValue({
         data: isDeleted === null ? null : { is_deleted: isDeleted, role },
         error: null,
       });
       const builder: Record<string, unknown> = {
         select: vi.fn(() => builder),
         eq: vi.fn(() => builder),
         maybeSingle: mocks.maybeSingle,
       };
       mocks.from.mockReturnValue(builder);
     }
     ```
   - b. Add new `it()` blocks after the existing `describe` body's last test (line 181, before the
     closing `});` at line 182) for: downgrade mismatch → reject + revoke; upgrade mismatch →
     accept + reissue with new role; no-mismatch → unchanged (already covered by existing tests,
     no new test needed for this case).
     **VALIDATE note (E2 — see Validate Contract): this file's refresh route issues only ONE
     `.from("users")` call per request (the extended `SELECT is_deleted, role` query), so the
     mock-sequencing risk from item 5 does NOT apply here — the single shared `setLockedFlag()`
     result is sufficient. Do preserve the exact ordering already in the route (role-mismatch
     check BEFORE the `isActive()` check) when writing assertions — that ordering is what makes
     the downgrade path independent of whether the token has actually been revoked yet (the
     AC3 race-window defense).**

7. Run the verification commands (see Verification Evidence) and confirm all pass before handing
   off to VALIDATE.

## Test Plan

### Area: `features/auth/services/auth.service.ts` (new: `roleRank` / `isDowngrade`)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | `roleRank("user") < roleRank("staff") < roleRank("admin")` | `npx vitest run features/auth/services/auth.service.test.ts` | Rank ordering is correct | Nothing about call sites using it correctly |
| Fully-automated | `isDowngrade("admin", "user") === true`, `isDowngrade("user", "admin") === false`, `isDowngrade("staff", "staff") === false` (same-role is not a downgrade) | Same command | Downgrade/upgrade/same-rank classification is correct at every pairwise boundary | Nothing about revoke side effects |

Failing stub:
```
test("should rank user < staff < admin", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: roleRank ordering")
})
test("should classify admin->user as a downgrade and user->admin as not a downgrade", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: isDowngrade classification")
})
```

### Area: `features/admin-users/services/admin-users.repository.ts` (`setRole`)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | `setRole` staff→user (downgrade) calls `refreshTokenService.revokeAllForUser(id)` after the update succeeds | `npx vitest run features/admin-users/services/admin-users.repository.test.ts` | AC1 — downgrade revokes tokens, mirrors `setLocked` | Whether the revoked token is actually rejected on next refresh (that's the refresh-route test area) |
| Fully-automated | `setRole` user→staff (upgrade) does NOT call `revokeAllForUser` | Same command | AC4 (repository half) — upgrade does not force logout | Refresh-route reissue behavior |
| Fully-automated | `setRole` staff→staff (no rank change) does NOT call `revokeAllForUser` | Same command | Same-role "change" (e.g. re-saving the same role) is not misclassified as a downgrade | — |
| Fully-automated | Existing `setRole`/`setLocked`/`list` tests (lines 1-172) still pass unmodified | Same command | AC5 — no regression to `setLocked`'s existing immediate-revocation behavior | — |

Failing stub:
```
test("should call revokeAllForUser when setRole downgrades staff to user", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole downgrade revokes")
})
test("should NOT call revokeAllForUser when setRole upgrades user to staff", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole upgrade does not revoke")
})
test("should NOT call revokeAllForUser when setRole is a no-op rank change", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole same-rank does not revoke")
})
```

### Area: `app/api/auth/refresh/route.ts`

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | Token claims `STAFF`, DB `role` is now `USER` (downgrade mismatch) → 403, `revokeAllForUser` called, `rotate` NOT called, no cookies set | `npx vitest run app/api/auth/refresh/route.test.ts` | AC2 + AC3 — stale-downgraded token cannot mint a new elevated-role access token; refresh route no longer blindly trusts the old JWT claim | Real end-to-end browser session behavior (blocked by Google-OAuth-only auth per repo constraints — accepted per SPEC Constraints) |
| Fully-automated | Token claims `USER`, DB `role` is now `STAFF` (upgrade mismatch) → 200, `rotate` called, new access token's decoded payload has `role: "STAFF"` (not the stale `"USER"`) | Same command | AC4 — upgrade continues to work, no forced logout, new role reflected on next refresh | — |
| Fully-automated | Token claims `USER`, DB `role` is still `USER` (no mismatch) → unchanged behavior (already covered by existing "tài khoản chưa khóa" test at line 155-164) | Same command | AC4 regression guard | — |
| Fully-automated | `is_deleted=true` rejection (existing test, line 141-152) still passes unmodified | Same command | AC6 — no regression to the existing lock-rejection path | — |

Failing stub:
```
test("should reject and revoke when refresh token role is a downgrade vs current DB role", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: refresh route downgrade-role rejection")
})
test("should accept and reissue with current DB role when refresh token role is stale-upgraded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: refresh route upgrade-role reissue")
})
```

### Missing Test Areas

| Area | Why untestable in this plan | Resolution chosen |
|---|---|---|
| Real end-to-end browser refresh flow (cookie round-trip through an actual browser session) | No e2e/Playwright suite exists in this repo; app is Google-OAuth-only with no test-login bypass (`process/context/tests/all-tests.md` "Known Gaps") | Accepted per SPEC Constraints — all criteria proven via Vitest unit/integration tests against the route handler directly, matching the existing test file's own approach |
| Residual ≤15-minute access-token window after downgrade | Explicitly out of scope per SPEC — access tokens are never DB-checked per request by design | Accepted architectural tradeoff, not part of this fix's acceptance criteria |
| `refresh-token.service.ts` `rotate()` non-atomic race condition | Separate, already-identified issue per SPEC, needs its own SPEC/fix | Out of scope — noted as a related backlog item, not created here (SPEC already tracks it in Background/Research Findings) |

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `npx vitest run features/auth/services/auth.service.test.ts` | Fully-Automated | Foundation for AC1-AC4 (rank helper correctness, no direct AC of its own) |
| `npx vitest run features/admin-users/services/admin-users.repository.test.ts` | Fully-Automated | AC1 (downgrade revokes), AC4 partial (upgrade does not revoke), AC5 (setLocked unchanged) |
| `npx vitest run app/api/auth/refresh/route.test.ts` | Fully-Automated | AC2 (revoked token rejected), AC3 (role-mismatch defense-in-depth reject), AC4 (upgrade reissue), AC6 (is_deleted unchanged) |
| `npx vitest run` (full regression suite) | Fully-Automated | Confirms no unrelated suite broke (e.g. `admin-users.service.test.ts` which calls through the unchanged client-side `adminUsersService.setRole` wrapper) |

## Test Infra Improvement Notes

- This plan closes the two most security-critical of the zero-coverage gaps flagged in SPEC
  Background (`setRole` downgrade-revoke, refresh-route role-recheck). It does **not** close the
  broader zero-coverage gap on `authenticate.middlware.ts`, `jwt.service.ts` (beyond what's
  exercised transitively), or `proxy.ts` — those remain a larger follow-up per
  `process/context/tests/all-tests.md` "Known Gaps", unchanged by this fix.
- No e2e/Playwright harness exists for this repo and none is proposed here — Google-OAuth-only
  auth blocks a test-login bypass; this is a pre-existing, accepted repo constraint, not a new gap
  introduced by this plan.

## Dependencies / Risks

- **Dependency:** `setRole`'s new pre-read SELECT adds one extra DB round-trip per role change
  (admin-panel action, low frequency — not a hot path). Acceptable; matches the repo's existing
  "extra query for security correctness" precedent already used in the refresh route's `is_deleted`
  check.
- **Risk — non-atomic update-then-revoke:** if the process crashes between the successful UPDATE
  and the `revokeAllForUser` call in `setRole`, the DB role is downgraded but old tokens remain
  valid until their natural refresh/expiry. This is the exact same residual risk `setLocked()`
  already accepts today (SPEC explicitly scopes "no atomic transaction" as acceptable, matching
  precedent).
- **Risk — test helper drift (T6a):** if `setLockedFlag()`'s default `role` parameter is not added
  correctly, all 8 existing refresh-route tests will spuriously fail (every mismatch would trip
  the new upgrade-reissue branch, changing `effectiveRole` and altering assertions that inspect
  the decoded access token). Checklist item 6a is written to prevent this exactly.
- **Risk — `authService` import direction:** `admin-users.repository.ts` already imports from
  `@/features/auth/services/refresh-token.service`; adding an import from
  `@/features/auth/services/auth.service` (a pure, side-effect-free module with no `server-only`
  guard) does not create a new module-boundary violation — confirmed by reading the target file
  (T1) has no `"server-only"` import today and is already safely imported in client contexts.

## Resume and Execution Handoff

1. **Selected plan file path:** `process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_PLAN_03-09-26.md` (this file)
2. **Last completed phase or step:** PLAN — this file just written; no EXECUTE work done yet
3. **Validate-contract status:** PASS (re-validated 03-09-26, PVL cycle 1) — see `## Validate Contract` below. `ENTER EXECUTE MODE` is legal: the E1 test-mock-sequencing concern was independently re-confirmed as resolved (checklist step 5 lines 235-246, step 6b lines 271-277 verified present, exact, and unambiguous against live plan text and live source/test files during this re-validation pass) — 0 FAILs, 0 CONCERNs remain.
4. **Supporting context files loaded:** the locked SPEC (path above), `admin-users.repository.ts`,
   `app/api/auth/refresh/route.ts`, `refresh-token.service.ts`, `auth.service.ts`,
   `features/auth/types/index.ts`, `admin-users.repository.test.ts`, `refresh/route.test.ts`,
   `features/auth/services/jwt.service.ts` (for `JwtPayload.role` casing confirmation)
5. **Next step for a fresh agent picking up mid-execution:** the validate-contract below is PASS (re-validated 03-09-26, PVL cycle 1) — per `process/development-protocols/orchestration.md` §PVL/EVL Loop Routing this satisfies the mechanical EXECUTE gate (`grep -c 'Gate: PASS' <plan-file>` >= 1). Run EXECUTE against the Implementation Checklist in order (steps 1-7), running the per-area test gates from the Test Plan section after each of steps 1-3 (per-section test-gate discipline), not batched to the end. This is auth/identity high-risk class — the manual-first evidence handoff (see Blast Radius above) is expected before this plan is treated as closed.

## Phase Completion Rules

- This is a SIMPLE plan (single session, no phase gates). "Code complete" means all Implementation
  Checklist steps 1-6 are applied and the file diffs match the Touchpoints section exactly.
- "Verified" (ready for UPDATE PROCESS) requires ALL FOUR Verification Evidence commands to exit 0
  — the three scoped Vitest files AND the full `npx vitest run` regression suite. Code-complete
  without a green full-suite run must not be reported as "done", only as "CODE DONE — verification
  pending".
- Because this plan is in the auth/identity high-risk class, EXECUTE must not self-certify as
  finished on green tests alone without surfacing the manual-first evidence handoff described in
  Blast Radius above.

## Validate Contract

Status: PASS
Date: 03-09-26
date: 2026-09-03
generated-by: outer-pvl
supersedes: 2026-09-03 (outer-pvl) — outer PVL has current evidence; this is the PVL cycle 1 re-validation confirming the E1 gap fix (see role-revocation-session-fix-pvl-iteration-001_REPORT_03-09-26.md)

Parallel strategy: sequential (re-validation executed directly by this validate-agent — no Agent/Task fan-out tool available in this invocation; mirrors the original pass's approach)
Rationale: 7-signal score 4/7 unchanged from the original pass (S2 auth/identity surface, S5 user-requested extra scrutiny, S6 high-risk class flagged in Blast Radius, S7 6 files in blast radius). Re-validation scope is narrow — confirm one CONCERN's resolution and regression-check the rest — so a single agent reading real source/tests directly against the plan text was sufficient and matched the rigor a fan-out would have produced.

### Re-validation Findings (PVL cycle 1 — this pass)

Independently re-verified against live repo state (not just trusted from the prior pass or the PVL-supplement report):

- **E1 resolution confirmed:** re-read Implementation Checklist step 5 (plan lines 231-246) and step 6b (plan lines 271-277) verbatim — both carry the exact, unambiguous mock-sequencing instruction (`mockReturnValueOnce`/`mockResolvedValueOnce` chaining, tied to call order: old role on the pre-read, new row on the update-select). No drift, no ambiguity found.
- **Mechanical feasibility re-confirmed against live source** (not assumed unchanged): re-read `features/admin-users/services/admin-users.repository.ts` (setRole at lines 87-103), `app/api/auth/refresh/route.ts` (DB-lookup block lines 63-72, newPayload line 86), and `features/auth/services/auth.service.ts` (whole file, lines 1-23) — all three match the plan's Touchpoints section byte-for-byte. No execution has happened yet (this plan is still pre-EXECUTE; `features/auth/services/auth.service.test.ts` — the new T4 file — does not exist on disk yet, as expected).
- **Test mock structure re-confirmed:** re-read `admin-users.repository.test.ts` — `mocks.from` is a plain `vi.fn()` currently driven with `mockReturnValue` in existing tests; `mockReturnValueOnce` chaining (as the checklist instructs for the new downgrade/upgrade tests) is a standard, compatible `vi.fn()` method — the instruction is mechanically sound, not just textually present.
- **E2 scope re-confirmed:** re-read `app/api/auth/refresh/route.test.ts` — the route issues exactly one `.from("users")` call per request today, and the plan's T3 change only widens the `select()` field list on that same single call (adds `role` alongside `is_deleted`) — it does not add a second call. The mock-sequencing risk genuinely does not apply here; `setLockedFlag()`'s single shared result remains sufficient once extended with the `role` field (checklist step 6a).
- **Type/casing claims re-confirmed:** `AuthRole` (`features/auth/types/index.ts`) is lowercase `"user"|"staff"|"admin"`; `JwtPayload.role` (`jwt.service.ts`) and the DB `role` column are both uppercase `"USER"|"STAFF"|"ADMIN"` — matches the plan's casing assumptions for `authService.fromDbRole()` conversions on both sides of the rank comparison.
- **No regressions found** in Section A (`auth.service.ts`) or Section C (`app/api/auth/refresh/route.ts`) — both remain PASS, unchanged since the original pass.
- **No new CONCERNs or FAILs surfaced** during this fresh, independent audit.

Test gates (C3 5-column table — ADDITIVE; existing consumers still parse the legacy line form below it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | `setRole()` revokes all outstanding refresh tokens when the role change is a downgrade | Fully-Automated | `npx vitest run features/admin-users/services/admin-users.repository.test.ts` — new "downgrade revokes" test | B |
| AC2 | A refresh attempt using a token invalidated by a downgrade is rejected, forcing re-login | Fully-Automated | `npx vitest run app/api/auth/refresh/route.test.ts` — proven end-to-end by AC1 (revoke) combined with the new downgrade-mismatch 403 test (this specific test proves the mismatch path directly; the pre-existing "token đã bị thu hồi" 401 test at line 118-131, unmodified, independently proves the isActive()-revoked-token path) | B |
| AC3 | Refresh route re-checks the current DB role in the same query as `is_deleted` and rejects on a downgrade mismatch (race-window defense-in-depth) | Fully-Automated | `npx vitest run app/api/auth/refresh/route.test.ts` — new "refresh route downgrade-role rejection" test | B |
| AC4 | Upgrade does not revoke tokens, does not force logout, and the refresh route reissues with the current (upgraded) DB role | Fully-Automated | `npx vitest run features/admin-users/services/admin-users.repository.test.ts` (upgrade-does-not-revoke) + `npx vitest run app/api/auth/refresh/route.test.ts` (upgrade-role reissue, decoded access token asserted) | B |
| AC5 | `setLocked()`'s existing immediate-revocation behavior is unchanged | Fully-Automated | `npx vitest run features/admin-users/services/admin-users.repository.test.ts` — existing setLocked tests (lines 133-163, unmodified by this plan) | A |
| AC6 | `is_deleted` rejection behavior on the refresh route is unchanged | Fully-Automated | `npx vitest run app/api/auth/refresh/route.test.ts` — existing is_deleted test (lines 141-152, unmodified by this plan) | A |
| helper | `roleRank`/`isDowngrade` total-order rank classification is correct at every pairwise boundary (up/down/same) | Fully-Automated | `npx vitest run features/auth/services/auth.service.test.ts` | B |
| regression | No unrelated suite breaks (e.g. `admin-users.service.test.ts` calling through the unchanged `adminUsersService.setRole` wrapper) | Fully-Automated | `npx vitest run` (full 44+ file suite) | B |
| e2e | Real browser cookie-refresh round trip | Agent-Probe (blocked) | N/A — no e2e suite, no OAuth test-login bypass | D |

gap-resolution legend:
- A — proven now (gate passes in this cycle; these are pre-existing, unmodified tests)
- B — fixed in this plan (gate added by this plan's checklist; RED stub until Implementation Checklist steps 1-6 are executed)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue)

C-4 reconciliation: all rows above use only Fully-Automated / Agent-Probe strategies. The one Agent-Probe row is a pre-existing, durable repo constraint (OAuth-only auth, no test-login bypass — see `process/context/tests/all-tests.md` "Known Gaps"), not something this plan could resolve, and does not gate this plan's own developed behavior (all 8 developed-behavior rows above it are Fully-Automated).

Legacy line form (retained so existing validate-contract consumers still parse):
- `features/auth/services/auth.service.ts` (roleRank/isDowngrade): Fully-automated: `npx vitest run features/auth/services/auth.service.test.ts`
- `features/admin-users/services/admin-users.repository.ts` (setRole): Fully-automated: `npx vitest run features/admin-users/services/admin-users.repository.test.ts`
- `app/api/auth/refresh/route.ts`: Fully-automated: `npx vitest run app/api/auth/refresh/route.test.ts`
- full regression: Fully-automated: `npx vitest run`
- real browser refresh flow: known-gap: documented (OAuth-only, no test-login bypass, pre-existing repo constraint per `process/context/tests/all-tests.md`)

Failing stubs (Fully-Automated rows, copied verbatim from the Test Plan section above):
```
test("should rank user < staff < admin", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: roleRank ordering")
})
test("should classify admin->user as a downgrade and user->admin as not a downgrade", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: isDowngrade classification")
})
test("should call revokeAllForUser when setRole downgrades staff to user", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole downgrade revokes")
})
test("should NOT call revokeAllForUser when setRole upgrades user to staff", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole upgrade does not revoke")
})
test("should NOT call revokeAllForUser when setRole is a no-op rank change", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: setRole same-rank does not revoke")
})
test("should reject and revoke when refresh token role is a downgrade vs current DB role", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: refresh route downgrade-role rejection")
})
test("should accept and reissue with current DB role when refresh token role is stale-upgraded", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: refresh route upgrade-role reissue")
})
```

Dimension findings:
- Infra fit: PASS — single Next.js app, no monorepo/container/port surface touched, no new dependencies or runtime surfaces. Unchanged since original pass.
- Test coverage: PASS — the E1 test-mock-sequencing gap is resolved: checklist step 5 carries an explicit, mechanically-sound sequential-mock instruction, independently re-verified against the live `vi.fn()`-based mock structure in this pass. Test tiers and the high-risk minimum (Fully-Automated exceeds the required Hybrid minimum for auth/identity areas) remain correct.
- Breaking changes: PASS — Public Contracts section re-verified against real source (`setRole` callers, `POST /api/auth/refresh` response shape); no signature or schema changes; no other call site affected. Unchanged since original pass.
- Security surface: PASS — the reject-vs-reissue design resolution was independently re-derived from the rank total-order (`user=0 < staff=1 < admin=2`) and verified sound in the original pass; this re-validation re-confirmed the casing/type facts underpinning that reasoning (`AuthRole` lowercase vs. `JwtPayload.role`/DB `role` uppercase) against live source and found no drift. No new attack surface, no bypass path found. E2's ordering note (role-check before `isActive()`) remains a forward-looking execute-agent instruction, not a defect.
- Section A feasibility (`auth.service.ts` / T1+T4): PASS — mechanically clean, pure functions, no external state, no gaps or conflicts, lowest risk in the plan. Unchanged; re-confirmed T4's target file (`auth.service.test.ts`) does not yet exist on disk, consistent with this still being pre-EXECUTE.
- Section B feasibility (`admin-users.repository.ts` / T2+T5): PASS (was CONCERN in the original pass — E1). Edit target re-confirmed byte-for-byte against current source (lines 87-103 match exactly); the test-guidance gap that caused the original CONCERN is now resolved — checklist step 5's sequential-mock instruction is present, exact, and mechanically compatible with the real `mocks.from` `vi.fn()` structure in `admin-users.repository.test.ts`.
- Section C feasibility (`app/api/auth/refresh/route.ts` / T3+T6): PASS — edit target re-confirmed against current source (`is_deleted` block lines 63-72, `isActive` block lines 74-84, `newPayload` line 86 all match exactly); re-confirmed the route issues only one `.from("users")` call per request, so the Section B mock-sequencing risk genuinely does not apply here. Unchanged since original pass.

Execute-Agent Instructions (carried forward — still binding during EXECUTE):
- E1 (Section B / T5, RESOLVED — was Test coverage CONCERN, now PASS): When writing the new downgrade/upgrade `setRole()` tests, do NOT reuse a single shared `makeBuilder(result)` result for both the new pre-update SELECT and the existing UPDATE...SELECT — `setRole()` now issues two separate `.from("users")` calls per invocation and they must resolve to different values (old role vs. new row) for the downgrade/upgrade assertions to actually exercise the intended logic. Use `mockReturnValueOnce`/`mockResolvedValueOnce` sequencing. Already folded into Implementation Checklist step 5 and independently re-confirmed present, exact, and mechanically sound in this re-validation pass.
- E2 (Section C / T3, Security surface note — still binding): Preserve the exact placement of the new role-recheck block BEFORE the `isActive()` check in the refresh route — this ordering is what makes the AC3 race-window defense independent of whether the token has separately been revoked yet. Do not reorder this relative to `isActive()` even though both branches ultimately reject.

Open gaps: real end-to-end browser cookie-refresh round trip (Agent-Probe, blocked by Google-OAuth-only auth, no test-login bypass) — pre-existing, durable, documented repo constraint per `process/context/tests/all-tests.md` "Known Gaps"; not a new gap introduced by this plan; not deferred to a new backlog plan since it is already tracked at the context-doc level.

What this coverage does NOT prove:
- `auth.service.test.ts`: nothing about whether call sites (`setRole`, refresh route) use `roleRank`/`isDowngrade` correctly — only that the functions themselves classify correctly in isolation.
- `admin-users.repository.test.ts` (setRole rows): whether a revoked token is actually rejected on the next refresh attempt (that is proven separately by the refresh-route test file), and does not exercise the real Supabase network/RLS layer (mocked client only).
- `refresh/route.test.ts` (new rows): real end-to-end browser session behavior, real cookie transport, real Google OAuth flow — blocked by this repo's OAuth-only auth with no test-login bypass; also does not prove the non-atomic update-then-revoke race window in `setRole()` is fully closed (accepted residual risk, matches existing `setLocked()` precedent).
- Full regression suite: does not add new coverage of the still-zero-coverage files (`authenticate.middlware.ts`, `jwt.service.ts` beyond transitive use, `proxy.ts`) — those remain a known, separate follow-up.

Gate: PASS (0 FAILs, 0 CONCERNs — the E1 test-mock-sequencing gap is confirmed resolved via Implementation Checklist step 5's sequential-mock instruction, independently re-verified against live plan text, live source, and live test-file mock structure during PVL cycle 1 re-validation; no regressions found in any other section)
Accepted by: session (autonomous PVL cycle 1 re-validation — clean PASS, 0 unresolved concerns; no user acceptance action needed)

## Autonomous Goal Block

SESSION GOAL: Close the role-downgrade session-revocation security hole — downgraded Staff/Admin users must lose elevated access within one refresh cycle; upgrades must keep working without forced logout; setLocked()/is_deleted behavior must not regress.
Charter + umbrella plan: N/A — single plan (SIMPLE, no phase program)
Autonomy: standard RIPER-5 gates apply; ENTER EXECUTE MODE requires an explicit user command; this is the auth/identity high-risk class — the manual-first evidence handoff (per `process/development-protocols/orchestration.md` §High-Risk Execution Handoff) is expected, not optional, before this plan is treated as closed.
Hard stop conditions / safety constraints:
- Do not add a per-request DB lookup to the JWT-claim-based role-check path (`authenticate.middlware.ts` / `proxy.ts`) — explicitly out of scope per SPEC Constraints.
- Do not reorder the existing guard-clause order in the refresh route (rate-limit -> refresh-token JWT verify -> DB lookup -> isActive -> rotate); do not reorder the new role-check relative to `isActive()` either (must stay before it — see E2).
- Do not change `setLocked()`'s behavior — it is the reference implementation, not something to modify.
- Do not add a `ROLE_CHANGED` audit-log event — explicit scope cut per SPEC.
- Do not weaken the downgrade-only asymmetry (never revoke/reject on upgrade) — this is the same asymmetric precedent `setLocked()` already uses.
Next phase: EXECUTE — `process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_PLAN_03-09-26.md` — Gate: PASS (re-validated 03-09-26, PVL cycle 1); `ENTER EXECUTE MODE` is legal now.
Validate contract: inline in plan (this file, `## Validate Contract` section above).
Execute start: `npx vitest run features/auth/services/auth.service.test.ts` then `npx vitest run features/admin-users/services/admin-users.repository.test.ts` then `npx vitest run app/api/auth/refresh/route.test.ts` then full regression `npx vitest run` | e2e spec: none (blocked, see Open gaps) | probe scenario: manual Google-OAuth refresh-flow walkthrough if feasible | high-risk pack: yes — auth/identity, manual-first evidence handoff required per orchestration.md.
