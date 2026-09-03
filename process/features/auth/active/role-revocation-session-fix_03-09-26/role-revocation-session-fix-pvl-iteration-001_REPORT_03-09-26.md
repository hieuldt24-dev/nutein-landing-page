# PVL Iteration 001 Report — role-revocation-session-fix

**Date:** 2026-09-03
**Cycle:** 1 of 10 (cap)
**Trigger:** V7 verdict `Gate: CONDITIONAL` (first pass) from initial VALIDATE run.

## Gap Addressed

**Gap 1 (E1)** — Section: implementation-checklist. `setRole()`'s new pre-update SELECT and the
existing UPDATE...SELECT issue two separate `.from("users")` calls; a naively-written downgrade/
upgrade test would collapse both to one shared mocked result via the existing `makeBuilder(result)`
test helper, silently failing to exercise the real downgrade/upgrade branch logic.
**Severity:** CONCERN (not FAIL).

## Resolution

vc-validate-agent had already folded the fix directly into the plan's Implementation Checklist
(step 5: explicit mock-sequencing instruction — `mockReturnValueOnce` chained per call, tied to call
order, old role on the pre-read / new-row confirmation on the update-select; step 6b: explicit note
that the refresh-route touchpoint is unaffected since it has only one `.from("users")` call) during
its V6 write, ahead of this supplement cycle.

vc-plan-agent (PVL-supplement mode) verified step 5 (lines 235-246) and step 6b (lines 271-277)
independently against the plan text and confirmed the instruction is present, exact, and
unambiguous. **No further plan edit was needed or made** — this cycle is a verification-only
confirmation, not a new fix.

## Outcome

`SUPPLEMENT_APPLIED: process/features/auth/active/role-revocation-session-fix_03-09-26/role-revocation-session-fix_PLAN_03-09-26.md — 1 gap(s) addressed`

Per orchestration.md PVL routing, this completes PVL cycle 1. Re-spawning vc-validate-agent from V1
against the (already-updated) plan to confirm Net Gate reaches PASS.

## Regression Check

No other checklist sections were touched this cycle. Sections A (auth.service.ts) and C (refresh
route) were PASS in the V1-V7 pass and are unaffected by this verification-only cycle.
