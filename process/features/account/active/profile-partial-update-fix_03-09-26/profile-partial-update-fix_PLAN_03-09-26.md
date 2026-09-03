---
name: plan:profile-partial-update-fix
description: "SIMPLE plan — make PATCH /api/account/profile a true partial update (schema subset + conditional-spread write + dirty-field client submit) to stop concurrent-tab data loss"
date: 03-09-26
feature: account
---

# Plan — Profile Partial Update Fix

- **Date**: 03-09-26
- **Status**: PLANNED (validate-contract written; CONDITIONAL pending explicit accept before EXECUTE)
- **Complexity**: SIMPLE (6 source files + 2 new test files, 1 feature area, no schema/migration/auth change)
- **Feature:** account
- **Spec:** `process/features/account/active/profile-partial-update-fix_03-09-26/profile-partial-update-fix_SPEC_03-09-26.md`

TL;DR: split the profile schema into a strict client form schema and a relaxed partial API schema, write only the provided fields via conditional spread, submit only dirty fields from the form, and add the first tests for this flow.

## Overview

`PATCH /api/account/profile` is documented and routed as a partial update but behaves as a mandatory
full replace: `updateProfileSchema` requires both `fullName` and `phone`, and
`profileRepository.update` writes both unconditionally. The form compounds this by always submitting
both react-hook-form values, hydrated once from a possibly-stale SWR snapshot.

Result: with two tabs open on `/account`, a save in one tab silently reverts the other tab's change.
This plan makes the endpoint a genuine partial update on the server AND stops the client from
sending fields the user never touched, while remaining backward compatible with all-fields bodies.

## Acceptance Criteria

| # | Criterion |
|---|---|
| AC1 | `updateProfileSchema` accepts any non-empty subset of `{fullName, phone}`; an empty object fails validation (400). |
| AC2 | `profileRepository.update` writes only the keys present in the input (conditional spread), always bumping `updated_at`. |
| AC3 | Field rules (name 2–100 chars, phone `^(0\|\+84)[0-9]{9}$`) still apply to any field that IS present. |
| AC4 | `AccountProfileForm` submits only fields the user actually changed and fires no request when nothing changed. |
| AC5 | Client-side form validation still requires both fields — a dedicated strict form schema, not the relaxed API schema. |
| AC6 | `profile.repository.ts` error paths throw `AppError` subclasses instead of plain `Error`. |
| AC7 | New Vitest coverage exists for repository partial-write behavior and schema subset/empty-body rules. |
| AC8 | `npm run check` is green (excluding the pre-existing `useAddresses.test.tsx` env drift). |

---

## Decision Summary

### Chosen Approach

**Partial schema + conditional-spread write + dirty-field client submit** — fixes the data loss at
both ends: the server stops requiring/writing untouched fields, and the client stops sending them.

### Why This Over Alternatives

| Alternative | Why Rejected |
|---|---|
| Server-only partial support (client unchanged) | Necessary but NOT sufficient. The form always submits both RHF values from a once-hydrated, possibly stale snapshot — the last-writer-wins overwrite still happens even with a partial-capable server. |
| Optimistic concurrency (`updated_at` as ETag, 409 on mismatch) | Solves a broader class of conflict but is much heavier: needs `updated_at` in the read contract, a new error path, client retry/merge UX, and arguably a DB-level guarantee. Out of scope per SPEC; partial update fully resolves the reported symptom. |
| Reuse one relaxed schema for both form and API | Would silently weaken client-side validation — an empty name field would pass `zodResolver`. Two schemas is the correct split. |

### Risk Predictions (vc-predict brief)

| Persona | Risk |
|---|---|
| Architect | Two schemas can drift. Mitigation: derive the partial API schema FROM the strict form schema (`.partial().refine(...)`), single source for field rules. |
| Implementer | `dirtyFields` from RHF resets on `reset()`; the form calls `reset()` in `startEdit`/`cancelEdit`, so the dirty baseline is correct at edit start. Must confirm the baseline is the freshest profile, not the once-hydrated snapshot. |
| Security | None new — same auth, same user-scoped `.eq("id", userId)`, no new surface. Relaxing required-ness cannot escalate anything. |
| Tester | Repository tests need `// @vitest-environment node` or they crash on `server-only`. Component-layer coverage is near-zero repo-wide; the form change is verified by unit-testing the payload-builder, not by rendering. |
| Ops | Backward compatible; no migration, no env, no deploy ordering. Old full-body clients keep working. |

### Key Constraints Accepted

- Empty-body PATCH returns 400 (deliberate; a no-op PATCH is a client bug).
- Conditional spread mirrors `features/checkout/services/order.repository.ts:154`; no new idiom.
- No DB-level concurrency guarantee — two tabs editing the SAME field still last-writer-wins (accepted, documented known-gap).

---

## Touchpoints

| File | Change |
|---|---|
| `features/account/schemas/profile.schema.ts` | Add strict `profileFormSchema` (both required, current rules) + derive relaxed `updateProfileSchema` = `.partial()` + `.refine(at least one key)`. Export both types. |
| `features/account/services/profile.repository.ts` | `update()` builds the payload via conditional spread; error paths use `AppError` subclasses. |
| `features/account/services/profile.service.ts` | Type-only follow-through (still a pass-through). |
| `app/api/account/profile/route.ts` | No logic change — `updateProfileSchema.parse` now enforces the partial contract. Verify only. |
| `components/account/AccountProfileForm.tsx` | Use `profileFormSchema` for the resolver; build the PATCH payload from `formState.dirtyFields`; skip the call when nothing is dirty. |
| `lib/useAccountProfile.ts` | `updateProfile` param type becomes the partial `UpdateProfileInput`. |
| `features/account/services/profile.repository.test.ts` (new) | Repository partial-write + error-path tests. |
| `features/account/schemas/profile.schema.test.ts` (new) | Schema subset / empty-body / field-rule tests. |

## Public Contracts

- `PATCH /api/account/profile` request body: was `{fullName: string, phone: string}` (both required) → now `{fullName?: string, phone?: string}` with **at least one key required**. Response shape unchanged (`AccountProfile`).
- `UpdateProfileInput` type becomes partial; new exported `ProfileFormInput` (strict) for form consumers.
- `profileRepository.update(userId, input)` now accepts and honors a partial input.

## Blast Radius

- **Scope:** 6 modified files + 2 new test files, all inside `features/account/`, `app/api/account/profile/`, `components/account/`, `lib/`. Single feature area.
- **Risk class:** internal, non-public API route (session-authenticated, first-party client only). NOT auth/identity logic, NOT billing, NOT schema/migration, NOT a third-party-facing contract — the high-risk manual evidence-pack ceremony does not apply.
- **Request-contract change (call out):** this changes the accepted request shape of an existing endpoint. It is **backward compatible in the loosening direction** — every previously valid body (both fields present) remains valid. Only previously-*invalid* bodies (one field, or none) change behavior: one field now succeeds, empty body now returns a clearer 400.
- **Downstream consumers (corrected 03-09-26 by independent VALIDATE re-pass — see Validate Contract):** TWO consumers of the hook's `updateProfile()`, not one:
  1. `lib/useAccountProfile.ts` → `components/account/AccountProfileForm.tsx` (the form this plan changes — now sends only dirty fields).
  2. `components/checkout/CheckoutForm.tsx` (line ~221) — after a successful order, always calls `updateProfile({ fullName: values.buyer.fullName, phone: values.buyer.phone })` to sync checkout buyer info back to the account profile, even when "save address" isn't checked. It sends **both fields unconditionally** (from the checkout buyer sub-form, which itself requires both), so it always lands in the still-valid "both fields present" case (U3) — **unaffected by the schema relaxation, no code change needed here**. This plan does not touch `CheckoutForm.tsx`. Grep-confirmed: no other importer of `updateProfileSchema` (the schema module) or `profileService.updateProfile` (the service call) exists; `CheckoutForm.tsx` reaches it only indirectly via the `useAccountProfile()` hook, which the original grep did not check for. No server action, no other route.
  - **Re-confirmed 03-09-26 (PVL cycle-1 re-validation):** `CheckoutForm.tsx:221-224` read directly from disk — still `await updateProfile({ fullName: values.buyer.fullName, phone: values.buyer.phone })` unconditionally inside the post-order sync block. Claim holds byte-for-byte; no drift.
- **DB:** no migration. Same `users` table, same columns, same `.eq("id", userId)` scoping.

---

## Implementation Checklist

### Section A — Schema split

1. In `features/account/schemas/profile.schema.ts`, keep `phoneSchema` as-is; rename the current object to `profileFormSchema` (strict: `fullName` + `phone` both required, same messages).
2. Add `export const updateProfileSchema = profileFormSchema.partial().refine(v => v.fullName !== undefined || v.phone !== undefined, { message: "Cần ít nhất một trường để cập nhật" })`.
3. Export `export type ProfileFormInput = z.infer<typeof profileFormSchema>` and keep `UpdateProfileInput = z.infer<typeof updateProfileSchema>` (now partial).
4. Add JSDoc noting: form schema = strict (client UX); update schema = partial (API contract).

### Section B — Repository partial write + AppError

5. In `profile.repository.ts` `update()`, replace the unconditional object with a conditional-spread payload mirroring `order.repository.ts:154`:
   `{ ...(input.fullName !== undefined && { name: input.fullName.trim() }), ...(input.phone !== undefined && { phone: input.phone.trim() }), updated_at: new Date().toISOString() }`.
6. Replace `throw new Error(...)` at `requireAdminClient` (line 16) with `InternalServerError`.
7. Replace `throw new Error(\`Không tải được hồ sơ: ...\`)` (line 42) with `InternalServerError`.
8. Replace `throw new Error(\`Không cập nhật được hồ sơ: ...\`)` (line 70) with `InternalServerError`. Keep the 23505 → `ConflictError("...","PHONE_TAKEN")` branch exactly as-is.
9. Update the `import` line to pull `InternalServerError` alongside `ConflictError`/`NotFoundError` from `@/src/errors/app.error`. Verify `InternalServerError`'s constructor signature in that file before use.

### Section C — Service + route follow-through

10. `profile.service.ts` — confirm it compiles against the partial `UpdateProfileInput`; no logic change expected.
11. `app/api/account/profile/route.ts` — confirm no change needed (it already parses with `updateProfileSchema`). Do not add manual field checks.

### Section D — Client sends only changed fields

12. `lib/useAccountProfile.ts` — `updateProfile(input: UpdateProfileInput)` (now partial). No other change.
13. `components/account/AccountProfileForm.tsx` — switch `useForm` generic + `zodResolver` to `profileFormSchema` / `ProfileFormInput`; pull `dirtyFields` from `formState` (destructure it alongside `errors` in the `formState: { errors, dirtyFields }` binding at the top of the component, same place `errors` is already read — do not read it only inside `onSubmit`, keep it consistent with how `errors` is already sourced).
14. In `onSubmit`, build `payload = { ...(dirtyFields.fullName && { fullName: values.fullName }), ...(dirtyFields.phone && { phone: values.phone }) }`.
15. If `Object.keys(payload).length === 0`: skip the request, `setIsEditing(false)`, and show a neutral toast (or no toast) — never fire an empty PATCH.
16. Otherwise `await updateProfile(payload)` and keep existing success/error handling.
17. Confirm `reset()` in `startEdit`/`cancelEdit` re-baselines `dirtyFields` correctly (RHF resets dirty state on `reset`).

### Section E — Tests

18. New `features/account/schemas/profile.schema.test.ts`: fullName-only parses; phone-only parses; both parse; `{}` fails; bad phone fails; short name fails.
19. New `features/account/services/profile.repository.test.ts` with `// @vitest-environment node` docblock: mock `@/lib/supabase` via `vi.hoisted` + `vi.mock` chainable builder — copy `features/account/services/address.repository.test.ts` verbatim as the pattern (same feature folder, same `supabaseAdmin.from` mock shape; a closer match than `order.repository.test.ts`). Assert `update()` payload contains ONLY `phone` + `updated_at` when given phone-only, ONLY `name` + `updated_at` when given fullName-only, and both when given both.
20. Add a repository test asserting the 23505 error maps to `ConflictError`/`PHONE_TAKEN` and a generic error maps to `InternalServerError`.
21. Run `npm run check` (format:check && lint && type-check && test) and confirm green.

---

## Phase Completion Rules

This is a single-phase SIMPLE plan. Completion status vocabulary:

- **CODE DONE** — Sections A–D applied and `npm run type-check` + `npm run lint` are green. Not verified.
- **TESTED** — Section E written and T1–T5 all exit 0. Automated proof only.
- **VERIFIED** — T6 (the two-tab + no-op-save human walkthrough) has been performed by the user and both changes persisted. Because auth is Google-OAuth-only, no agent can reach this state alone.
- Do NOT mark this plan complete or archive it at CODE DONE or TESTED. The bug being fixed is a concurrency-visible UI behavior; only T6 proves it. Report `DONE_WITH_CONCERNS` and hold the plan in `active/` until the user confirms T6.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `npx vitest run features/account/schemas/profile.schema.test.ts` exits 0 | Fully-Automated | AC1, AC3 (U1, U2, U3, U4, U5) |
| `npx vitest run features/account/services/profile.repository.test.ts` exits 0 | Fully-Automated | AC2, AC6, AC7 (U1, U2, U3, U6) |
| `npm run type-check` exits 0 | Fully-Automated | AC5 (strict form schema still typed as required in the form) |
| `npm run lint` exits 0 | Fully-Automated | Repo quality gate |
| `npm test` (full suite, 44+ files) exits 0 | Fully-Automated | Regression — no other consumer broken by the contract loosening. Note: this suite has no test that directly exercises `CheckoutForm.tsx`'s `updateProfile()` call site; its safety is established by code-reading (always sends both fields), not by an automated assertion. |
| Two-tab manual walkthrough on `/account`: tab A edits phone + saves, tab B (loaded before) edits name + saves; reload → both persist | Agent-Probe → **human-only** | AC4, G1, G2 (U7). Auth is Google-OAuth-only; per `process/context/tests/all-tests.md` §Known Gaps, no agent can perform an authenticated `/account` walkthrough. Must be run by the user. |
| Manual: open edit, change nothing, press save → no network request in devtools | Agent-Probe → **human-only** | AC4 (U8), same OAuth blocker |

### TDD stubs (red-first starting points)

```
test("should accept a phone-only body", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: phone-only body parses")
})
test("should reject an empty body", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: empty body rejected")
})
test("should write only the phone column when given phone only", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: repository partial write")
})
test("should map postgres 23505 to ConflictError PHONE_TAKEN", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: duplicate phone conflict")
})
```

## Test Infra Improvement Notes

- Recurring blocker: OAuth-only auth prevents agent-run verification of any `/account` change (already documented in `all-tests.md` §Known Gaps). The two-tab scenario — the exact bug this plan fixes — is therefore **not machine-verifiable**; the repository-level test is the closest automated proxy.
- Component-layer (`components/account/`) has no test harness; the dirty-field payload logic is verified indirectly via type-check + human walkthrough. Consider extracting the payload builder to a pure helper if this recurs.
- **Backlog test-building stub filed 03-09-26** (PVL cycle-1 re-validation, Step A1 requirement): `process/features/account/backlog/account-component-test-harness_NOTE_03-09-26.md` — recommends extracting the dirty-field payload builder into a pure, auth-free unit-testable helper.

## Known Gaps

| Gap | Resolution |
|---|---|
| Two tabs editing the SAME field still last-writer-wins | Accepted — out of scope; requires optimistic concurrency (rejected alternative). |
| Phone-uniqueness relies on catching PG 23505; no confirmed unique constraint | Accepted — SPEC out-of-scope; do not touch migrations. Backlog candidate. |
| No automated coverage of `AccountProfileForm` render/submit | Accepted — near-zero component coverage repo-wide; human walkthrough covers it. |
| AC4/G1/G2 (the plan's core fix) has zero Fully-Automated/Hybrid proof — Agent-Probe reduces to human-only | **Accepted as a structural residual** — durable, repo-wide OAuth-only-auth blocker (`all-tests.md` §Known Gaps), not fixable within this plan's scope, and not fixable by further plan-text supplementation. Repository-level test (`profile.repository.test.ts`) is the closest automated proxy for the write-only-provided-keys behavior; T6 remains the only proof of the actual cross-tab UX fix. Backlog test-building stub filed: `process/features/account/backlog/account-component-test-harness_NOTE_03-09-26.md`. Per the VALIDATE net-gate vacuous-green ban, this residual keeps the net gate at CONDITIONAL — it cannot be excluded to reach PASS (see Validate Contract Findings). |

---

## Resume and Execution Handoff

1. **Selected plan file:** `process/features/account/active/profile-partial-update-fix_03-09-26/profile-partial-update-fix_PLAN_03-09-26.md`
2. **Last completed phase:** VALIDATE — PVL cycle 1 complete (`SUPPLEMENT_APPLIED`, verification-only, 0 additional plan edits needed) and re-validated from V1 (this pass). Gate: **CONDITIONAL (final)** — the one remaining CONCERN (AC4/G1/G2 zero automated proof) is a structural residual, not fixable by another supplement cycle; no further PVL loop is recommended.
3. **Validate-contract status:** written (see `## Validate Contract`). Gate: CONDITIONAL after 1 PVL supplement cycle. Requires explicit accept (user or orchestrator, per `process/development-protocols/orchestration.md` §PVL/EVL Loop Routing "CONDITIONAL after N≥1 cycles → plateau → accept as known-gap") before `ENTER EXECUTE MODE`.
4. **Supporting context loaded:** `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/development-protocols/implementation-standards.md`, `process/development-protocols/vc-system-behavior/08-validate.md`, SPEC file above.
5. **Next step for a fresh agent:** if CONDITIONAL is accepted, start at Section A step 1. Sections A→B→C→D→E in order; A and B are the behavioral core, D is what actually stops the data loss. Run `npm run check` at step 21 before reporting done. Do not archive or mark VERIFIED without human T6 confirmation (see Phase Completion Rules).

---

## Validate Contract

**Gate: CONDITIONAL (final for this PVL cycle chain — not a further-supplement-fixable gap)**
**generated-by: outer-pvl**
**date: 2026-09-03**
**supersedes: 2026-09-03 (outer-pvl) — PVL cycle 1 re-validation from V1; both flagged gaps re-verified, AC4/G1/G2 residual reassessed against the Hard E2E gate / vacuous-green ban**
Validated: 03-09-26 | Mode: Simple | Plan: `profile-partial-update-fix_PLAN_03-09-26.md` | PVL cycle: 1 of 10 (SUPPLEMENT_APPLIED, verification-only)

### V1 Pre-Check (re-run, fresh)

- Plan file exists and is readable; SPEC file exists and is readable.
- `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs` on this plan: **0 failures, 0 warnings** (336 lines at time of check — re-run fresh for this pass, not reused from the prior pass).
- File existence re-check (fresh `ls`, not reused): all 6 touchpoint source files + `address.repository.test.ts` reference + `app.error.ts` confirmed present on disk.
- `components/checkout/CheckoutForm.tsx:221-224` re-read from disk (fresh grep + read, not reused): confirmed still `await updateProfile({ fullName: values.buyer.fullName, phone: values.buyer.phone })` unconditionally — the Blast Radius correction from PVL cycle 1 is accurate and holds with zero drift.
- No `## Phase Ordering` section (not a phase program) — Dependency-BLOCKED guard N/A.
- No umbrella plan with `## Stable Program Goal` found — BRANCH A (Autonomous Goal Block already present in plan, verified unchanged in shape).
- `results.tsv` confirms 1 recorded PVL fix cycle (3 data rows: baseline + independent-revalidation-found-gaps + SUPPLEMENT_APPLIED) — satisfies the orchestrator's mechanical `wc -l ≥ 3` gate for CONDITIONAL-with-cycle eligibility.

### Net gate derivation

| Layer 1 dimensions | Status |
|---|---|
| Infra fit | PASS |
| Test coverage | CONCERN (structural — see Findings) |
| Breaking changes | **PASS (upgraded from CONCERN)** — Blast Radius correction confirmed accurate and complete; no further undocumented consumer found on re-check |
| Security surface | PASS |

| Layer 2 sections | Status |
|---|---|
| Section A — Schema split | PASS |
| Section B — Repository partial write + AppError | PASS |
| Section C — Service + route follow-through | PASS |
| Section D — Client dirty-field submit | PASS |
| Section E — Tests | PASS |

**Totals: 0 FAILs / 1 CONCERN / 7 PASSes → Net Gate: CONDITIONAL**

**Net gate is CONDITIONAL, not PASS, even with only 1 CONCERN remaining and 0 FAILs — see "Why this cannot be PASS" below.**

### Why this cannot be PASS (exact rule citations)

This re-validation was explicitly asked to re-derive, not assume, whether the AC4/G1/G2 residual
forces CONDITIONAL. It does. Two independent, converging rule sources both mandate this:

1. **VALIDATE mode's net-gate vacuous-green ban (Step A1):** "Before finalizing the net gate, scan
   the blast radius for developed behavior with ZERO automated gates. If ANY developed behavior
   has no Fully-Automated or Hybrid gate proving it (its only 'coverage' is Known-Gap), the net
   gate CANNOT be a terminal PASS — it MUST be classified CONDITIONAL with the missing coverage
   named explicitly... Known-Gap is permitted ONLY as a named residual with written justification
   (and a backlog test-building stub), never as the silent reason a behavior passes."
2. **`process/development-protocols/vc-system-behavior/08-validate.md` §V3 "Net Gate Rule" / Hard
   E2E gate:** "If a contract's developed area is covered only by the weak tiers (agent-probe,
   known-gap — where automation was possible) — or by no planned gate at all ('vacuously
   green') — the strongest verdict it can earn for that area is CONDITIONAL, never PASS."

AC4/G1/G2 — the two-tab dirty-field submit that is the entire reason this plan exists — has zero
Fully-Automated or Hybrid gate. Its only coverage is Agent-Probe reduced to human-only (T6). Per
both rules above, this alone is sufficient and sole grounds to keep the net gate at CONDITIONAL,
independent of how many other CONCERNs exist or get resolved.

**The `## Known Gaps (Resolved via Backlog)` exclusion mechanism does NOT apply here and cannot be
used to reach PASS.** That mechanism (08-validate.md §V3 "Known-Gap Exclusion") excludes gaps that
are **out-of-scope, deferred to a NEW PLAN REQUIRED** — a scope-exclusion tool for gaps outside
this plan's blast radius. AC4/G1/G2 is squarely **in scope** (it is this plan's core deliverable)
and is blocked by a durable, repo-wide OAuth-only-auth constraint, not deferred to a future plan.
Using the out-of-scope exclusion mechanism to silently drop an in-scope, un-automatable core
behavior from the CONCERN count would itself be the "vacuously green" failure mode both rules
exist to prevent. Confirmed: this is a genuine protocol requirement, not habit — re-deriving from
first principles reaches the same CONDITIONAL conclusion as the prior pass.

**What DID change since the prior pass:** the Breaking-changes CONCERN (undocumented `CheckoutForm.tsx`
consumer) is fully resolved and re-verified — Layer 1 Breaking-changes moves from CONCERN to PASS.
Total CONCERN count dropped from 2 to 1. The remaining CONCERN (AC4/G1/G2) is not
supplement-fixable — a further PVL cycle would not change this outcome, so no further supplement
loop is recommended (see orchestration.md §PVL/EVL Loop Routing "CONDITIONAL after N≥1 cycles →
plateau → accept as known-gap"). This is the terminal classification for this plan absent a scope
change (e.g., a future plan that adds a component-test harness, per the filed backlog stub).

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Blast Radius CheckoutForm.tsx consumer documentation | **RESOLVED** (was CONCERN) | Re-verified fresh from disk this pass — `CheckoutForm.tsx:221-224` unconditionally sends both fields, stays on valid "both present" path (U3), no code change needed. Plan text is accurate and complete. |
| AC4/G1/G2 — core reported bug — zero Fully-Automated/Hybrid proof | CONCERN (structural, accepted) | Named explicitly, written justification present in Known Gaps table, backlog test-building stub filed (`process/features/account/backlog/account-component-test-harness_NOTE_03-09-26.md`). Cannot be excluded to PASS per Hard E2E gate / vacuous-green ban — see "Why this cannot be PASS" above. Requires explicit accept before EXECUTE. |
| `InternalServerError` constructor signature | ✅ PASS (RESOLVED prior pass, re-confirmed) | `src/errors/app.error.ts`: `constructor(message = "Internal server error", details?: unknown)` — compatible with all 3 planned call sites. |
| RHF `dirtyFields` baseline freshness | ✅ PASS (RESOLVED prior pass, re-confirmed) | `AccountProfileForm.tsx:61-67` `startEdit()`'s `reset()` seeds from the live `profile` object; `dirtyFields` is a live Proxy getter, no staleness risk. |
| Conditional-spread guard shape precision | ✅ PASS | Plan step 5's `...(x !== undefined && {...})` and cited `order.repository.ts:154`'s `...(x !== undefined ? {...} : {})` are the same idiom family; not a blocker. |
| Repository test reference pattern | ✅ PASS | `features/account/services/address.repository.test.ts` is the correct, directly reachable copy source (used in step 19). |
| Empty-body → 400 mechanism | ✅ PASS | `.refine(v => v.fullName !== undefined \|\| v.phone !== undefined, {...})` is unambiguous. |
| Line-number drift check | ✅ PASS | All 6 touchpoint files re-read from disk this pass; every line-number claim matches current file state exactly — zero drift. |
| Security: no new surface; user-scoped update unchanged | ✅ PASS | Same `authenticate(req)` + `.eq("id", userId)`; relaxing required-ness cannot escalate privilege. |
| Infra fit: Vitest single runner, `// @vitest-environment node` required | ✅ PASS | Matches `all-tests.md` exactly. |
| Structural validator (`validate-plan-artifact.mjs`) | ✅ PASS | 0 failures, 0 warnings, re-run fresh this pass. |

### Execute-agent instructions

| # | Instruction | Trigger |
|---|---|---|
| E1 | `InternalServerError` signature confirmed: `constructor(message, details?)`. No action needed beyond using it as planned. | Section B entry (informational) |
| E2 | `startEdit`'s `reset()` seeds from live `profile` — confirmed. Do not regress it. | Section D entry (informational) |
| E3 | Do not touch `supabase/migrations/`, `GET /api/account/profile`, or add a `fullName` charset rule. Explicitly out of scope. | Throughout |
| E4 | If step 21 `npm run check` surfaces the pre-existing `lib/useAddresses.test.tsx` Supabase-env failure, that is documented harness drift (backlog note `infra-followups-19-08-26.md`) — do NOT fix it here, report it as pre-existing. | Section E |
| E5 | Do NOT modify `components/checkout/CheckoutForm.tsx` — it is a confirmed-safe second consumer (always sends both fields), explicitly out of scope for this plan. If a future change to it is needed, that is a separate plan. | Throughout |

### Test gates (5-column form)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1, AC3 | schema accepts non-empty subset; empty object 400; field rules apply when present | Fully-Automated | `npx vitest run features/account/schemas/profile.schema.test.ts` | B |
| AC2, AC6 | repository writes only provided keys via conditional spread; error paths throw `AppError` subclasses | Fully-Automated | `npx vitest run features/account/services/profile.repository.test.ts` | B |
| AC7 | new Vitest coverage exists for both areas above | Fully-Automated | both files above exist and exit 0 | B |
| AC5 | strict form schema still types/requires both fields | Fully-Automated | `npm run type-check` | B |
| repo quality gate | lint clean | Fully-Automated | `npm run lint` | B |
| regression | no other consumer (incl. `CheckoutForm.tsx`) broken by the contract loosening | Fully-Automated | `npm test` | D — full suite is Fully-Automated, but does not directly exercise `CheckoutForm.tsx`'s call site; that consumer's safety rests on code-reading, named as a residual |
| AC4, G1, G2 | two-tab dirty-field submit prevents cross-tab overwrite (the actual reported bug) | Agent-Probe → known-gap | manual two-tab `/account` walkthrough | D — human-only, OAuth blocker, no agent path exists; backlog stub filed |
| G3, U8 | no-op save fires no request | Agent-Probe → known-gap | manual devtools no-request check | D — human-only, same OAuth blocker |

gap-resolution legend: A — proven now; B — fixed in this plan (gate added by this plan's checklist); C — deferred to a named later phase/plan; D — backlog test-building stub (named residual; keep-active; continue).

C-4 reconciliation: strategy column carries only Fully-Automated / Hybrid / Agent-Probe; Known-Gap rows above are the Agent-Probe rows that reduce to known-gap in practice (repo-wide OAuth blocker), carried via gap-resolution D, never as a `strategy:` value on their own.

### Legacy line form (retained for existing consumers)

- Schema/subset rules: Fully-automated: `npx vitest run features/account/schemas/profile.schema.test.ts`
- Repository partial write + AppError: Fully-automated: `npx vitest run features/account/services/profile.repository.test.ts`
- Type safety: Fully-automated: `npm run type-check`
- Lint: Fully-automated: `npm run lint`
- Regression: Fully-automated: `npm test`
- Cross-tab UX fix (the core bug): Agent-probe: two-tab `/account` walkthrough — known-gap: human-only, OAuth blocker documented in `all-tests.md`
- No-op save guard: Agent-probe: devtools no-request check — known-gap: human-only, same OAuth blocker

### What this coverage does NOT prove

- T1 (schema test) does NOT prove the repository or the route actually use the schema correctly at runtime — only that the schema's own parse/refine logic is correct in isolation.
- T2 (repository test) does NOT prove the API route wires the parsed input into the repository correctly, and does NOT prove the client only sends dirty fields — it proves only that IF the repository receives a partial input, it writes only those keys.
- T3 (type-check) does NOT prove `zodResolver(profileFormSchema)` actually blocks an invalid submit at runtime — it only proves the TypeScript types line up; Zod's runtime refinement behavior is unverified by this gate.
- T5 (`npm test`) does NOT exercise `CheckoutForm.tsx`'s call to `updateProfile()` at all — that consumer's continued safety after this change is established by source reading (it always sends both fields), not by any test in the suite.
- None of T1–T5 prove the actual concurrency scenario (two tabs, different fields, both persist) — that is exclusively what T6 proves, and T6 cannot be run by an agent in this repo. This is the specific gap that keeps the net gate at CONDITIONAL (see "Why this cannot be PASS" above).
- None of T1–T5 prove the no-op-save guard (G3/U8) fires zero network requests — that is what the second manual check proves, also human-only.

### Open gaps

- Two-tab same-field conflict (accepted, no optimistic concurrency).
- Phone-uniqueness DB constraint unverified (out of scope, backlog candidate).
- `AccountProfileForm` has no automated coverage.
- **AC4/G1/G2 core-fix proof is human-only (T6) — durable OAuth blocker, structural, terminal for this plan's scope. This is the sole remaining reason the gate is CONDITIONAL rather than PASS. Backlog test-building stub filed: `process/features/account/backlog/account-component-test-harness_NOTE_03-09-26.md`.**
- ~~`CheckoutForm.tsx` second-consumer correction~~ — RESOLVED and re-verified this pass; no longer an open gap.

Accepted by: user (2026-09-03, "ENTER EXECUTE MODE" given after explicit CONDITIONAL disclosure —
user informed that AC4/G1/G2 cross-tab-overwrite fix has no automated proof and committed to
performing the T6 two-tab manual walkthrough personally after EXECUTE). CONDITIONAL, final for this
PVL cycle chain (1 supplement cycle completed;
the remaining CONCERN is structural and not further-supplement-fixable). Per
`process/development-protocols/orchestration.md` §PVL/EVL Loop Routing ("`Gate: CONDITIONAL` after
N≥1 cycles → check plateau... plateau hit → surface to user (non-/goal) or accept remaining gaps
as known-gaps (/goal)"), this must be surfaced to the user/orchestrator for an explicit accept
decision before `ENTER EXECUTE MODE` — it is not eligible for another automatic supplement loop.
The mechanical EXECUTE-eligibility gate (`orchestration.md` "VALIDATE → EXECUTE is legal only
when...") is independently satisfied via path (b): `results.tsv` records 1 completed PVL fix cycle
(3 data rows). EXECUTE may therefore proceed once this CONDITIONAL is explicitly accepted.

---

## Autonomous Goal Block

SESSION GOAL: Make PATCH /api/account/profile a genuine partial update (server accepts subset + writes only provided keys; client submits only dirty fields) so concurrent-tab edits on /account stop overwriting each other.
Charter + umbrella plan: N/A — single SIMPLE plan (no phase program, no umbrella plan exists for this work).
Autonomy: standard `/goal` autonomy per `process/development-protocols/orchestration.md` §Autonomy Mode — CONDITIONAL findings: apply supplement and proceed without pausing; BLOCKED items: write to backlog and continue; irreversible or outward-facing action without explicit contract instruction: hard stop and ask.
Hard stop conditions / safety constraints:
- Do not touch `supabase/migrations/`, `GET /api/account/profile`, or add a `fullName` charset rule (out of scope per SPEC).
- Do not implement optimistic concurrency / ETag (rejected alternative — heavier design, out of scope).
- Backward compatibility is mandatory: any request body with both `fullName` and `phone` present must remain valid (U3) — never regress this.
- Do not modify `components/checkout/CheckoutForm.tsx` — confirmed-safe second consumer, explicitly out of scope.
- Do NOT mark this plan CODE DONE/TESTED as complete or archive it without the human two-tab walkthrough (T6) — auth is Google-OAuth-only, no agent can perform it; hold in `active/` until the user confirms.
Next phase: This validate pass is Gate: CONDITIONAL (final — 1 PVL supplement cycle completed; the remaining CONCERN, AC4/G1/G2 zero automated proof, is a structural residual, not fixable by further plan-text supplementation). Requires explicit user/orchestrator accept of the CONDITIONAL before `ENTER EXECUTE MODE`. No further PVL re-validate loop is recommended.
Validate contract: inline in plan (`## Validate Contract` section, this file).
Execute start: fully-auto — `npx vitest run features/account/schemas/profile.schema.test.ts`, `npx vitest run features/account/services/profile.repository.test.ts`, `npm run type-check`, `npm run lint`, `npm test` | e2e spec: none (no Playwright suite exists) | probe scenario: two-tab `/account` walkthrough + no-op-save devtools check (both human-only, OAuth blocker) | high-risk pack: no — not auth/identity, billing, schema-migration, public-API, deploy/proxy, or trust-boundary class.
