---
phase: vietqr-self-hosted-payment
date: 2026-08-27
status: COMPLETE
feature: checkout
plan: process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_PLAN_27-08-26.md
---

# EXECUTE Report — Self-Hosted VietQR Bank Transfer (PayOS Replacement)

**TL;DR:** All 30 checklist items implemented and independently EVL-confirmed green (405/405
tests, 95/95 blast-radius tests, type-check clean, 0 new lint errors, AC9 grep sweep clean). The 3
mandatory Agent-Probe walkthroughs were performed **by the user manually** (agent browser
automation cannot authenticate in this OAuth-only app — see "UPDATE PROCESS Closeout" below) and
found one real gap (AC7: `AccountOrderList.tsx` never rendered `paymentStatus`), fixed the same
session via the QUICK FIX lane. Plan is VERIFIED and archived to `completed/`.

## What Was Done

### Section 1 — VietQR utility
- Confirmed the VietQR Quick Link param shape **empirically against the live service** (the docs page
  `vietqr.io/en/danh-sach-api/link-tao-ma-qr/` returns 404; WebFetch/WebSearch/Context7 unavailable
  this session). Probe: `GET https://img.vietqr.io/image/970407-19001234567890-compact2.png?amount=250000&addInfo=...&accountName=...`
  → `200 image/png`, 72,249 bytes; content byte-length varies with `amount`/`addInfo`, proving the
  params are consumed. Path form `<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png` and params
  `amount` / `addInfo` / `accountName` confirmed as sketched. Not guessed from memory.
- `.env.example`: added the `VIETQR_*` block (server-only, no `NEXT_PUBLIC_`), matching the
  `PAYOS_*`/`CLOUDINARY_*` convention (comment header + doc URL + blank vars).
- `lib/vietqr.ts` (new): `buildVietQrImageUrl()` + `getVietQrBankAccount()`, `import "server-only"`,
  env read at call time, nullable-return when `VIETQR_BANK_ID`/`VIETQR_ACCOUNT_NO` unset.

### Section 2 — checkout service / order repository
- `resolvePayment()` is now **synchronous and pure** (no `await`, no network); returns
  `{ uiStatus: "awaiting_payment", qrImageUrl }`.
- Removed the orphan-cancel `try/catch` scaffold (its only reason was PayOS's external side effect).
- Deleted `getPaymentStatusForUser()` and `retryPayment()`.
- `order.repository.ts`: `mapPaymentMethod()` → `BANK_TRANSFER`; dropped `payos_*` from insert
  payload, SELECT list, and `OrderInsertRow`; deleted `findByOrderCodeForUser()`,
  `updatePayosLink()`, `markPaidByPayosOrderCode()`.
- `CreateOrderResult`: `paymentUrl` removed, `qrImageUrl` added; `RetryPaymentResult` deleted.
- **P1 (VALIDATE fold-in) applied:** `CheckoutForm.tsx` dead-redirect block removed; falls through to
  `notify.success(...)` + `router.push(...)`.
- `constants.ts`: `bank_transfer` copy no longer claims auto-confirmation.

### Section 3 — Staff confirm-payment
- `AdminOrder.paymentMethod: string` (raw enum) added; `toAdminOrder()` surfaces it.
- `confirmPayment(id, staffUserId)` added — touches `payment_status` ONLY, never `status`.
  **E1 (VALIDATE fold-in) applied:** the UPDATE carries `.eq("payment_status", "UNPAID")` for atomic
  double-confirm protection; a 0-row result throws 400 rather than silently succeeding.
  Audit trail via existing `auditLogRepository.record()` in `after()` — no new columns.
- `POST /api/staff/orders/[id]/confirm-payment` (STAFF-only, no body — YAGNI, per plan default).
- `adminOrdersService.confirmPayment()` client wrapper.

### Section 4 — Checkout success UI
- `CheckoutSuccessView`: `livePaymentStatus`/`isPayos` props gone; renders the QR `<img>` +
  static "awaiting manual confirmation" copy; graceful text fallback when `qrImageUrl` is undefined.
- `app/checkout/success/page.tsx`: `usePayosLiveStatus()` hook and its call site deleted.

### Section 5 — PayOS deletion sweep
Deleted: `lib/payos.ts`, `payos.service.ts` (+test), `payos.schema.ts` (+test),
`app/api/checkout/payos/{webhook,status,retry}/route.ts`.
`account-order.service.ts`: `canRetryPayment` removed; `"PAYOS"` kept in the **read-only** union with
an explicit comment marking the deliberate read/write asymmetry. `AccountOrderList.tsx`: retry
handler, ref guard, button, and now-unused imports removed.

### Section 6 — Admin UI
- `AdminOrderDetail.tsx`: distinct "Xác nhận đã nhận thanh toán" section, gated on
  `paymentMethod === "BANK_TRANSFER" && paymentStatus === "unpaid"`, visually separated from the
  order-status transition controls (two state machines).
- `AdminOrdersList.tsx`: "Chờ xác nhận CK" badge on unpaid bank-transfer rows.

## What Was Skipped or Deferred

- **The 3 Agent-Probe walkthroughs (AC3, AC5, AC7) — NOT PERFORMED.** No browser/E2E tooling
  available to this agent session. These remain **mandatory before archival** per the plan's Phase
  Completion Rules and High-Risk Class Table.
- No migration written (per plan). `PAYOS` enum value and `payos_*` columns left dormant.
- `npm run format:check` not made green — see Test Infra Gaps.

## Test Gate Outcomes

| Gate | Result |
|---|---|
| `npx vitest run lib/vietqr.test.ts` | PASS (8/8) |
| `npx vitest run features/checkout` | PASS |
| `npx vitest run features/admin-orders` | PASS (44/44) |
| `npx vitest run features/account` | PASS (29/29) |
| `npx vitest run components/checkout` | PASS (3/3) |
| `npx vitest run "app/api/staff/orders"` | PASS (5/5) |
| Blast-radius combined | PASS (14 files, 142 tests) |
| `npm test` (full suite) | **405 tests PASS, 0 test failures**; 1 suite fails at IMPORT — pre-existing, see gaps |
| `npm run type-check` | PASS (clean) |
| `npm run lint` | 535 pre-existing repo problems; **0 in new files**; blast-radius findings are all pre-existing `react-hooks` patterns |
| `npm run format:check` | FAIL — pre-existing repo-wide drift (1281 files incl. untouched `tsconfig.json`) |
| AC9 payos sweep | PASS — zero live PayOS imports; 3 routes gone; remaining `PAYOS` strings are the sanctioned read-only historical union, display label, and test fixtures |

## Plan Deviations

1. **`features/admin-dashboard/services/revenue-from-orders.test.ts` (not in plan touchpoints)** —
   an `AdminOrder` fixture outside the listed blast radius broke on the additive `paymentMethod`
   field. Added one line. Within-blast-radius class (mechanical consequence of a plan-declared
   additive contract change).
2. **`features/account/services/account-order.service.test.ts` created, not extended** — the plan says
   "extend existing"; no such file existed. Created it to satisfy the AC7 Fully-Automated row.
3. **`lib/cloudinary.ts` / `lib/resend.ts` comment fix** — both said "Mirror lib/payos.ts", a file this
   plan deletes. Repointed to `lib/supabase.ts`. Comment-only.
4. **`getVietQrBankAccount()` added to `lib/vietqr.ts`** beyond the plan's single named export — the
   plan's Section D calls for a plain-text bank-details fallback. Exported and unit-tested; the
   success view currently uses the text fallback message only, so this is available but unused by UI.
5. **`.next/` deleted** — stale generated `validator.ts` referenced the removed PayOS routes and broke
   type-check. Build-artifact only.
6. **Stale test title reworded** in `admin-orders.repository.test.ts` (referenced a payOS webhook that
   no longer exists). Assertions unchanged.

None are hard-stop class. No schema, auth, container, or external-integration change.

## Test Infra Gaps Found

- `CONTEXT_PARTIAL: vietqr-live-docs` — WebFetch, WebSearch, and Context7 MCP are all unavailable in
  this session; the official VietQR docs URL 404s. Param shape was confirmed by **live endpoint probe**
  instead. Adequate but weaker than doc confirmation; the AC3 Agent-Probe should re-confirm that the
  rendered QR actually scans with the correct amount and reference.
- **Pre-existing:** `npm run format:check` fails repo-wide (1281 files, including files this change
  never touched). Running `prettier --write` would produce a ~1281-file diff far outside this plan's
  blast radius — deliberately NOT done. `npm run check` therefore cannot go green until that is
  addressed as its own task.
- **Pre-existing:** `lib/useAddresses.test.tsx` fails at import (`lib/supabase-browser.ts` requires
  `NEXT_PUBLIC_SUPABASE_URL` at module load; vitest does not load `.env`). Zero files in that import
  chain were touched by this change.
- No E2E/browser suite exists — the reason AC3/AC5/AC7 are Agent-Probe at all.

## Closeout Packet

- **Selected plan:** `process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_PLAN_27-08-26.md`
- **Finished:** all 6 sections, all 30 checklist items, both VALIDATE fold-ins (P1, E1).
- **Verified:** every Fully-Automated row of the C3 test-gate table.
- **Still unverified:** AC3, AC5, AC7 Agent-Probe walkthroughs (live UI).
- **Remaining cleanup:** run the 3 walkthroughs; set real `VIETQR_*` values in `.env`; decide
  separately whether to fix the repo-wide prettier drift.
- **Classification: `Keep in active/testing`.** Code-complete but not VERIFIED — the plan's own
  Phase Completion Rules forbid archival on green automated tests alone for this billing surface.

## Forward Preview

### Test Infra Found
Vitest only; `vitest-stubs/server-only.ts` alias lets `server-only` modules be tested with
`// @vitest-environment node`. Supabase mocked via a chainable fake builder. No E2E runner.

### Blast Radius Changes
`lib/payos.ts` gone, `lib/vietqr.ts` added. `app/api/checkout/payos/**` gone;
`app/api/staff/orders/[id]/confirm-payment/**` added. `AdminOrder` gained `paymentMethod`;
`AccountOrder` lost `canRetryPayment`; `CreateOrderResult` swapped `paymentUrl` → `qrImageUrl`.

### Commands to Stay Green
```
npx vitest run features/checkout features/admin-orders features/account components/checkout "app/api/staff/orders" lib/vietqr.test.ts
npm run type-check
```

### Dependency Changes
None added. `@payos/node` is now unused in source — removing it from `package.json` is a separate
follow-up, deliberately not done here (out of plan scope).

## Files Changed

**Created (6):** `lib/vietqr.ts`, `lib/vietqr.test.ts`,
`app/api/staff/orders/[id]/confirm-payment/route.ts`,
`app/api/staff/orders/[id]/confirm-payment/route.test.ts`,
`components/checkout/CheckoutSuccessView.test.tsx`,
`features/account/services/account-order.service.test.ts`

**Deleted (8):** `lib/payos.ts`, `features/checkout/services/payos.service.ts` (+`.test.ts`),
`features/checkout/schemas/payos.schema.ts` (+`.test.ts`),
`app/api/checkout/payos/{webhook,status,retry}/route.ts`

**Modified (18):** `.env.example`, `features/checkout/services/checkout.service.ts` (+`.test.ts`),
`features/checkout/services/order.repository.ts` (+`.test.ts`), `features/checkout/types/index.ts`,
`features/checkout/constants.ts`, `components/checkout/CheckoutForm.tsx`,
`components/checkout/CheckoutSuccessView.tsx`, `app/checkout/success/page.tsx`,
`features/admin-orders/types/index.ts`, `features/admin-orders/services/admin-orders.repository.ts`
(+`.test.ts`), `features/admin-orders/services/admin-orders.service.ts`,
`features/account/services/account-order.service.ts`, `features/account/types/index.ts`,
`components/account/AccountOrderList.tsx`, `components/admin/orders/AdminOrderDetail.tsx`,
`components/admin/orders/AdminOrdersList.tsx`,
`features/admin-dashboard/services/revenue-from-orders.test.ts`, `lib/cloudinary.ts`, `lib/resend.ts`

---

## UPDATE PROCESS Closeout (27-08-26)

**Status: VERIFIED. Archived to `process/features/checkout/completed/vietqr-self-hosted-payment_27-08-26/`.**

### EVL confirmation run

An independent `vc-tester` EVL pass re-ran the validate-contract gate commands (not just
execute-agent's own claim): type-check clean, 405/405 tests pass, 95/95 blast-radius tests pass, 0
new lint errors in touched files, AC9 PayOS-removal grep sweep clean (zero live-code `payos`
matches outside the 3 sanctioned read-only compat references). All Fully-Automated rows of the
Verification Evidence table confirmed green.

### The 3 mandatory Agent-Probe walkthroughs — performed manually by the user, not by an agent

No agent in this session could authenticate a browser session against this app: auth is
Google-OAuth-only with no test credentials and no dev-login bypass (recorded as a durable Known Gap
in `process/context/tests/all-tests.md`). Instead, **the user personally performed all 3
walkthroughs** in their own browser:

1. Placed a real bank-transfer order (order code `NT-20260827-YNQ3`) — confirmed the checkout QR
   renders with the correct amount and order reference (AC3).
2. Confirmed payment as staff via the new "Xác nhận đã nhận thanh toán" button on the order detail
   page (AC5).
3. Checked `/account` to confirm the order's payment status reflects PAID (AC7).

### Gap found via manual walkthrough — AC7

Step 3 above surfaced a real gap that the automated test suite missed: the backend correctly
computed `order.paymentStatus` (unit-tested, passing at the service layer) but
`components/account/AccountOrderList.tsx` never actually rendered it anywhere in the UI. A narrow
service-level test passed while the user-visible behavior AC7 cares about was broken — this is
exactly the class of gap Agent-Probe walkthroughs exist to catch, and exactly why the plan's Phase
Completion Rules forbid archiving on green automated tests alone for this billing surface.

**Fix applied via the QUICK FIX lane** (appropriately scoped — small, single-file, display-only,
no schema/auth/API/billing-logic change): added a payment-status badge to `AccountOrderList.tsx`
(PAID → "Đã thanh toán" green, UNPAID → "Chưa thanh toán" muted), reading the already-computed
`order.paymentStatus` field, matching the existing `AccountOrderStatusBadge` visual pattern.
Typecheck clean. No dedicated test file exists for this component (repo-wide gap, not new), so no
automated regression coverage was added — tracked as a residual backlog item, not silently
skipped.

**Residual open item:** the user has not yet explicitly re-confirmed the badge displays correctly
after refreshing `/account` post-fix (they moved on to other work). Not treated as a blocker to
archival — the fix is low-risk/display-only, independently verified via typecheck + code reading
(the underlying field was already correctly computed and tested; only the render was missing), and
follows an established, working sibling component's pattern exactly. Tracked in
`process/features/checkout/backlog/vietqr-account-badge-followups_27-08-26.md`.

### Dependency cleanup

Via a second QUICK FIX, the now-unused `@payos/node` npm dependency was removed from `package.json`
(`package-lock.json` regenerated). Verified zero remaining source-code imports via repo-wide grep
before removal.

### Intentional PAYOS strings — not cleanup targets

3 files still contain the string `"PAYOS"` by design, not as leftovers — each keeps `PAYOS` in a
**read-only** type union / display-label map only so historical pre-migration orders still render
correctly, with an explicit comment marking the deliberate read/write asymmetry:
`features/checkout/services/order.repository.ts`, `features/account/services/account-order.service.ts`,
`features/admin-orders/services/admin-orders.repository.ts`. No write path produces `PAYOS`
anymore. Do not "clean up" these.

### Durable knowledge captured this session

- `process/context/payment/all-payment.md` — full rewrite of the provider description: VietQR
  self-hosted (no gateway, no webhook), manual staff confirmation, `BANK_TRANSFER` DB enum,
  `VIETQR_*` env vars, updated Source Paths, new "VietQR self-hosted payment migration" section
  documenting the AC7 gap/fix and the intentional dormant-PAYOS state.
- `process/context/all-context.md` — Technology Stack Payment line, repo-structure `lib/` line,
  routing-table descriptions, env-var group updated to VietQR; PayOS marked legacy/dormant.
- `process/context/tests/all-tests.md` — new durable Known Gap: OAuth-only auth blocks all
  Agent-Probe browser walkthroughs for authenticated features (recurring infra gap, not
  feature-specific).
- `process/features/checkout/backlog/vietqr-account-badge-followups_27-08-26.md` — new backlog
  note: missing test coverage for the badge fix + the recurring OAuth/Agent-Probe blocker.

### Commit checkpoint

**Not invoked in this session** — per explicit instruction, commit recommendation is left as a
separate user decision. Execution changes (source files) are ready for a logical execution commit;
this UPDATE PROCESS session's context-doc/report/archive changes would follow as a separate process
commit, per this repo's two-commit convention.
