---
phase: priority-bug-fixes-items-3-and-5
date: 2026-08-19
status: COMPLETE
feature: N/A
plan: process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md
---

# EXECUTE Report — Items 3 + 5 (scoped)

Scope: ONLY Item 3 (order-email XSS) and Item 5 (Cloudinary env leak). Items 1, 2, 4 untouched
(owned by concurrent agents).

## What Was Done

**Item 3 — XSS/HTML injection in order confirmation email — CODE DONE.**
`features/checkout/services/order-email.service.ts`:
- Added local `escapeHtml(value: string)` helper (escapes `&` first, then `<`, `>`, `"`, `'`) — no new
  file, no new dependency, per plan step 1.
- Wrapped all 5 customer-supplied fields at interpolation: `order.buyer.fullName`,
  `order.buyer.phone`, `order.address.street`, `order.address.ward`, `order.address.province`.
- NOT wrapped (per plan step 2): `order.orderCode` (server-generated), `formatCurrencyVnd(...)`
  output, `paymentLabel` / `shippingLabel` (fixed constants lookup), `estimatedDeliveryLabel`
  (server-generated label). Template structure/labels unchanged (plan step 3).

Tests added to the existing `describe` block in `order-email.service.test.ts` (no new file), captured
via the mocked `resend.emails.send` `html` argument:
- payload case: `<img src=x onerror=alert(1)>` in `fullName` + `</td></tr><tr><td>Fake` in `street` →
  asserts raw payloads absent AND exact escaped entities present.
- benign-character case: `O'Brien & "Con"` → asserts `O&#39;Brien &amp; &quot;Con&quot;` and NO
  double-escaping (`&amp;#39;` / `&amp;quot;` absent) — directly guards the plan's stated
  replacement-order risk.

TDD Mode A honored: stubs confirmed RED first (2 failed / 4 passed) before implementation, then green.

**Item 5 — Cloudinary guard env leak — VERIFIED BY INSPECTION, NO EDIT MADE.**
Per Execute-Agent Instruction E1, re-read `app/api/staff/uploads/route.ts` live BEFORE any write.
Lines 21-28 already use the two-arg pattern:
`InternalServerError("Tải ảnh lên thất bại — vui lòng thử lại sau.", "Thiếu CLOUDINARY_.../.env")` —
generic client message, diagnostics in `details`. The old single-arg leaking form is gone.
→ **No edit applied to `route.ts`.** Resolved by the concurrent sibling
`full-codebase-review_PLAN_19-08-26.md` execute run, not by this plan's edit.

Per E3, `app/api/staff/uploads/route.test.ts` already exists with the covering 4th `it` block
("Cloudinary chưa cấu hình -> message generic, không lộ tên biến môi trường") asserting the response
body excludes `CLOUDINARY_CLOUD_NAME` / `API_SECRET`. → **No duplicate test written.** Gate run to
confirm green.

## What Was Skipped or Deferred

- Item 5 source edit — skipped by design (E1 idempotent pre-check: already fixed).
- Item 5 test write — skipped by design (E3: covering case already present).
- Items 1, 2, 4 — out of this session's scope (concurrent agents).
- `npx tsc --noEmit` — deliberately NOT run: it is Item 2/Item 4's gate, and concurrent agents are
  mid-edit on `CartLineItem.tsx` / `pricing.ts`, so a whole-repo typecheck now would report their
  in-flight state, not this session's. Items 3+5 introduce no type-surface change (one new local
  function, five call-site wraps, all `string → string`).

## Test Gate Outcomes

| Gate | Command | Result |
|---|---|---|
| AC2 (Item 3) | `npx vitest run features/checkout/services/order-email.service.test.ts` | PASS — 6/6 (4 pre-existing + 2 new) |
| AC6 (Item 5) | `npx vitest run app/api/staff/uploads/route.test.ts` | PASS — 4/4 (unchanged, confirmed green) |

## Plan Deviations

Two minor, within-blast-radius additions; no hard-stop class deviation:
1. Added a SECOND test case for Item 3 (benign `&`/`'`/`"` double-escape guard) beyond the single
   case the plan named. Rationale: the plan's own Risks section names replacement order as Item 3's
   top risk and asks for exact escaped-entity assertions; one payload case alone does not prove
   absence of double-escaping. Additive test-only, no source impact.
2. Item 5 completed with zero source edits — this is the plan's own prescribed E1 path, recorded here
   as an explicit deviation from the literal "Fix" text of the Item 5 checklist.

## Test Infra Gaps Found

None new. Pre-existing gap re-noted from the plan: the email gate proves the HTML string is free of
unescaped user input but does not prove rendering fidelity in real mail clients (not introduced here).

## Closeout Packet

- Selected plan: `process/general-plans/active/priority-bug-fixes_19-08-26/priority-bug-fixes_PLAN_19-08-26.md`
- Finished (this session): Item 3 CODE DONE + gate green; Item 5 VERIFIED by inspection + gate green.
- Verified: both scoped gates green in this session. Still unverified: independent EVL re-run by
  vc-tester (required per plan's Phase Completion Rules — execute-agent green claim is not sufficient).
- Remaining: Items 1, 2, 4 (other agents); full 5-gate + `tsc --noEmit` regression pass once all
  items land.
- Best next valid state: **Keep in active/testing** — plan is not archivable until Items 1/2/4 land
  and the full regression pass is green.

## Forward Preview

**Test Infra Found:** Vitest-only, co-located `*.test.ts(x)`. Server-only modules need the
`// @vitest-environment node` docblock (both touched test files already have it). `vi.hoisted` +
`vi.mock` factory is the house mocking style; module-level flag flipping via a getter in the mock
factory (`resendConfigured`) is the pattern for toggling a nullable client per test.

**Blast Radius Changes:** `order-email.service.ts` (+1 helper, 5 call-site wraps) and its test file
(+2 cases). `app/api/staff/uploads/route.ts` and its test: ZERO changes from this session.

**Commands to Stay Green:**
- `npx vitest run features/checkout/services/order-email.service.test.ts`
- `npx vitest run app/api/staff/uploads/route.test.ts`

**Dependency Changes:** none (escape helper hand-written; no `escape-html` / `sanitize-html` added).
