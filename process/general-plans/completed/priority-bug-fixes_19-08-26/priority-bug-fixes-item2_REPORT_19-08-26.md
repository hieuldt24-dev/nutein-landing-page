---
phase: item-2-cartlineitem-price-fallback
date: 2026-08-19
status: COMPLETE
feature: N/A
plan: process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md
---

# EXECUTE Exit Summary — Item 2 (scoped)

Item 2 only. Items 1, 3, 4, 5 untouched (owned by concurrent agents).

## What Was Done

- **E2 pre-check (required by validate-contract):** re-grepped `CartLineItem` repo-wide live.
  Only caller is `components/shared/CartDrawer.tsx:195`, which already passes
  `lineSubtotal={line.lineSubtotal}` at line 199. No second caller found; no call-site edit needed.
  (`docs/checkout-page-implementation-plan.md:224` mentions the component in prose only — not a caller.)
- `components/shared/CartLineItem.tsx:12` — `lineSubtotal?: number` → `lineSubtotal: number` (required).
- `components/shared/CartLineItem.tsx:65` — `formatCurrencyVnd(lineSubtotal ?? product.price * quantity)`
  → `formatCurrencyVnd(lineSubtotal)`. Naive-multiply fallback deleted (unreachable under the new type).
- `components/shared/CartLineItem.test.tsx` — NEW co-located test file (repo convention, patterned on
  `TargetAudienceSection.test.tsx`: explicit vitest imports, `vi.mock("next/image")`).
  Two cases: (a) bundle-discounted `quantity=3`, `lineSubtotal=1_275_000 !== price*quantity` → asserts the
  discounted value renders and the naive value does NOT; (b) `lineSubtotal={0}` boundary — a falsy-but-valid
  subtotal must still render 0, not fall back.
- `CartDrawer.tsx` NOT modified (already compliant, per plan step 3).

## What Was Skipped or Deferred

- Items 1, 3, 4, 5 — out of this agent's scope.
- `docs/checkout-page-implementation-plan.md`'s planned future `CartLineItem` caller — explicitly out of scope.

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| AC3 | `npx vitest run components/shared/CartLineItem.test.tsx` | PASS — 1 file, 2 tests |
| AC3-contract | `npx tsc --noEmit` | PASS — zero output (no caller breaks on the required-prop tightening) |

## Plan Deviations

- **TDD Mode A red-first, partial:** the runtime assertion could not be made to fail before the fix —
  with `lineSubtotal` supplied, the old `lineSubtotal ?? …` expression already returned the correct value.
  The bug was a *latent contract* bug (fallback reachable only via prop omission), so no Vitest test can go
  red pre-fix; the plan's own Test-gate note says as much ("no test can directly assert a compile error in
  Vitest, so the `tsc --noEmit` gate is the proving mechanism for this half"). The new test is therefore a
  regression lock on the discounted-value path, and `tsc --noEmit` is the red/green proof for the type half.
  Within blast radius; no scope change.
- **Test-stub fix (per Mode A step 1, "fix the stub, not the code"):** first run failed on both cases because
  `Intl.NumberFormat("vi-VN")` emits U+00A0 before `₫` while testing-library normalizes DOM whitespace.
  Added a local `currencyText()` helper that normalizes the expected string. No production code changed for this.
- Added a second test case (`lineSubtotal={0}`) beyond the plan's single named case (a). Additive coverage
  inside the same new file; strengthens AC3 (0 was the one value the old `??` fallback would have mishandled
  had it been `||`). Within blast radius.

## Test Infra Gaps Found

None new. Pre-existing gap re-confirmed (already documented in `process/context/tests/all-tests.md` §Known Gaps):
React component layer has near-zero coverage; this adds one of the first `components/shared/` tests.

## Closeout Packet

- Plan: `process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md`
- Finished: Item 2 fully (both AC3 and AC3-contract green).
- Verified: both Item 2 gate commands run locally green. Unverified: the other 4 items (other agents).
- Remaining: EVL confirmation run by vc-tester; plan stays active until all 5 items land.
- Follow-up plan stubs created: none.
- CONTEXT_PARTIAL items: none.
- Next valid state: **Keep in active/testing** — plan is not archivable until Items 1/3/4/5 report in.

## Forward Preview

- **Test Infra Found:** Vitest 4.1.10, jsdom default, no `test.globals` (explicit imports required),
  `vitest.setup.ts` provides `jest-dom` + `afterEach(cleanup)`. `next/image` must be `vi.mock`ed in
  component tests. Currency assertions need U+00A0 normalization.
- **Blast Radius Changes:** `components/shared/CartLineItem.tsx` (modified),
  `components/shared/CartLineItem.test.tsx` (new). `CartDrawer.tsx` untouched.
- **Commands to Stay Green:** `npx vitest run components/shared/CartLineItem.test.tsx` and `npx tsc --noEmit`.
- **Dependency Changes:** none.
