---
name: note:account-component-test-harness
description: "Backlog test-building stub — components/account/ has no automated test harness; dirty-field payload logic in AccountProfileForm is unverified by any Fully-Automated/Hybrid gate"
date: 03-09-26
feature: account
---

# Backlog Note — Account Component Test Harness

**Date:** 03-09-26
**Source:** VALIDATE re-pass (PVL cycle 1) on `profile-partial-update-fix_PLAN_03-09-26.md` —
Step A1 net-gate vacuous-green ban requires a named backlog test-building stub for any developed
behavior whose only coverage is Known-Gap/Agent-Probe.

## Gap

`components/account/AccountProfileForm.tsx`'s dirty-field payload construction (only submit
changed fields; skip the request entirely when nothing changed) — the actual reported
cross-tab-overwrite fix (AC4/G1/G2 in the profile-partial-update-fix plan) — has zero
Fully-Automated or Hybrid test coverage. The only verification path is a human two-tab browser
walkthrough (T6), which cannot be run by an agent because this repo's user auth is
Google-OAuth-only (no test credentials, no headless-login path — see
`process/context/tests/all-tests.md` §Known Gaps).

This is not because the behavior is inherently untestable — it is because `components/` has
**zero component-level render-test harness** repo-wide (no `@testing-library/react` usage
anywhere), so even an auth-free RTL test of `AccountProfileForm`'s dirty-field logic is currently
not possible without first standing up that infra.

## Why deferred (not fixed in the originating plan)

Adding a component-test harness (dependency install, RTL setup, a render-test pattern) is a
test-infra investment larger than the profile-partial-update-fix plan's SIMPLE scope. The
originating plan's "Test Infra Improvement Notes" section already flags this: "Consider
extracting the payload builder to a pure helper if this recurs."

## Recommended future fix

1. Extract the dirty-field payload-building logic out of `AccountProfileForm.tsx` into a pure,
   framework-agnostic helper (e.g. `buildDirtyFieldsPayload(dirtyFields, values)`), so it can be
   unit-tested with plain Vitest — no rendering, no auth, no OAuth blocker.
2. Add a Vitest unit test asserting: only-fullName-dirty → payload has only `fullName`;
   only-phone-dirty → payload has only `phone`; nothing dirty → empty payload (component then
   skips the request).
3. (Optional, larger) stand up `@testing-library/react` + `jsdom` render testing for
   `components/account/` and `components/checkout/` if component-level regressions recur.

## Status

Open — not required for `profile-partial-update-fix` to proceed to EXECUTE (accepted as a
documented, justified Known-Gap residual for this plan's scope). Candidate for a small follow-up
plan if the payload-builder extraction is wanted before or after this fix ships.
