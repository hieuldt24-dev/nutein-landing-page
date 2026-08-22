---
phase: item-4-voucher-tier-ordering
date: 2026-08-19
status: COMPLETE
feature: N/A
plan: process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md
---

# EXECUTE Report — Item 4 (voucher tier ordering)

## What Was Done
- `features/cart/pricing.ts` — `buildProductVoucherTiers()` now appends
  `.sort((a, b) => a.thresholdVnd - b.thresholdVnd)` to the `.map(...)` chain, so every caller
  gets the ascending-threshold invariant for free. Added an explanatory comment.
- `features/cart/pricing.ts` — removed the dead `= VOUCHER_TIERS` default from
  `getVoucherProgress(subtotal, tiers)`; `tiers` is now required. Removed the now-unused
  `VOUCHER_TIERS` import. The constant itself in `features/cart/constants.ts` was NOT deleted
  (per plan step 3).
- `features/cart/pricing.test.ts` — added one case (red-first, confirmed failing before the fix):
  reversed variant order via `productService.setProductDetail` → asserts
  `summary.voucherProgress.tiers` thresholds are ascending and equal
  `[449k, 778k, 1_167k, 1_945k]`.

## What Was Skipped or Deferred
- No change to `buildTierProgress`, `calculateProgressPercent`, or
  `components/shared/CartVoucherProgress.tsx` (`tiers.at(-1)`) — plan step 2 forbids it.
- No deletion of the `VOUCHER_TIERS` constant.
- Items 1, 2, 3, 5 untouched (out of scope for this spawn).

## Test Gate Outcomes
- `npx vitest run features/cart/pricing.test.ts` → 6 passed (was 5 passed + 1 failing red stub).
- `npx tsc --noEmit` → clean, no output (confirms AC5: no caller relied on the omitted default).

## Plan Deviations
- Within blast radius: the new test asserts tier ordering through `buildCartSummary`'s
  `voucherProgress.tiers` rather than calling `buildProductVoucherTiers()` directly, because that
  function is module-private. Rationale: proving the same behavior without widening the module's
  public export surface (a public-contract change the plan did not authorize). Same assertion,
  no API change.

## Test Infra Gaps Found
None.

## Closeout Packet
- Selected plan: `process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md`
- Finished: Item 4 (AC4, AC4-regress, AC5) code-complete, gates green locally.
- Still unverified: EVL confirmation run by vc-tester; other 4 items owned by concurrent agents.
- Classification: `Keep in active/testing` — plan has 4 other items in flight.

## Forward Preview
- Test Infra Found: Vitest-only, co-located `*.test.ts`, `// @vitest-environment node` docblock,
  `productService.setProductDetail(...)` in `beforeEach` is the fixture-injection pattern.
- Blast Radius Changes: `features/cart/pricing.ts`, `features/cart/pricing.test.ts` only.
- Commands to Stay Green: `npx vitest run features/cart/pricing.test.ts` and `npx tsc --noEmit`.
- Dependency Changes: none.
