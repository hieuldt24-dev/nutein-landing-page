---
name: plan:vietqr-self-hosted-payment
description: "Replace PayOS with self-hosted, gateway-free VietQR bank-transfer payment (checkout feature)"
date: 27-08-26
feature: checkout
---

# PLAN — Self-Hosted VietQR Bank Transfer (PayOS Replacement)

**Date**: 27-08-26
**Status**: ✅ VERIFIED — all 30 checklist items complete; EVL-confirmed green; all 3 Agent-Probe
walkthroughs performed (manually, by user); one gap found (AC7) and fixed same session (see
`vietqr-self-hosted-payment_REPORT_27-08-26.md` "UPDATE PROCESS Closeout"). Archived 27-08-26.
**Complexity**: COMPLEX (single plan, not a phase program — one blast radius, one PVL/EVL cycle,
billing/payment high-risk class, 24-file touchpoint).

**Locked SPEC:** `process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_SPEC_27-08-26.md`

**Locked INNOVATE decision:** full-removal single-pass replacement (not staged). VietQR URL built
server-side. No new migration. No new audit columns — reuse `audit_log`. No TTL/auto-expiry.

## Overview

PayOS cannot settle to the merchant's Techcombank business account, so it is being removed entirely
and replaced with a self-hosted, gateway-free VietQR bank-transfer flow: the checkout generates a
static VietQR image URL (merchant's own bank details + order amount + order reference) server-side,
the customer pays manually outside the app, and a staff member marks the order paid by hand via a
new "confirm payment received" action. This plan implements the INNOVATE-locked full-removal
single-pass design: delete all 24 PayOS touchpoints in one pass, add the VietQR branch to
`resolvePayment()`, add the staff confirm-payment endpoint reusing `audit_log` for the audit trail,
and rebuild the checkout success view as a static confirmation (no polling). Context reference:
`process/context/all-context.md` (root router) → `process/context/payment/all-payment.md` (payment
group) → `process/context/tests/all-tests.md` (test group). Full narrative, user stories, and locked
decisions live in the SPEC above; this plan does not restate them beyond what is needed for
execution precision.

## Verified-at-PLAN-time facts (do not re-derive)

- `PaymentMethod` enum already contains `BANK_TRANSFER` — confirmed by reading
  `supabase/migrations/20260718000000_init_schema.sql:36`:
  `CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'BANK_TRANSFER', 'MOMO', 'VNPAY')`. The later
  migration `20260722010000_payos_bank_transfer.sql` only ADDs `'PAYOS'` to the enum and adds the
  `payos_order_code` / `payos_payment_link_id` columns — it never touches `BANK_TRANSFER`. **No new
  migration is needed.** Per SPEC, `PAYOS` enum value and the two `payos_*` columns are left in
  place (dormant) — do not write a migration to drop them.
- `audit_log` table + `auditLogRepository.record()` (`features/admin-audit/services/audit-log.repository.ts`)
  already provides a generic `{userId, action, tableName, recordId, oldData, newData}` audit trail —
  confirmed sufficient for the "who confirmed this payment and when" requirement (SPEC User Story 5).
  No new columns needed on `orders`.
- COD's automatic `payment_status = PAID` side effect lives ONLY in
  `admin-orders.repository.ts::updateStatus()`, gated by
  `nextStatus === "delivered" && current.payment_method === "COD" && current.payment_status !== "PAID"`
  — hardcoded to the literal string `"COD"`. This branch is completely untouched by this plan
  (SPEC AC8) — the new BANK_TRANSFER confirm-payment path is a **separate, additive** repository
  function, never a change to this `if`.
- `markPaidByPayosOrderCode()` / `updatePayosLink()` / `findByOrderCodeForUser()` in
  `order.repository.ts` are called ONLY from `checkout.service.ts` (`getPaymentStatusForUser`,
  `retryPayment`) and `app/api/checkout/payos/webhook/route.ts` — confirmed via repo-wide grep, no
  other call sites. Safe to delete all three alongside their callers.
- `AdminOrder` type currently exposes only `paymentMethodLabel` (a formatted string), not the raw
  DB enum — the new "Confirm Payment" UI button needs the raw method to gate visibility
  (`BANK_TRANSFER` + `paymentStatus === "unpaid"`). A new `paymentMethod: string` (raw DB enum
  value) field must be added to `AdminOrder`.
- `AccountOrder.canRetryPayment` is computed as `row.payment_method === "PAYOS" && paymentStatus === "UNPAID"`
  and drives the "Thanh toán ngay" retry button in `AccountOrderList.tsx`, which calls the now-deleted
  `/api/checkout/payos/retry` route. Both the field and the button must be removed together.
- No E2E/Playwright suite exists (Vitest only, confirmed via `process/context/tests/all-tests.md`).
  UI-facing acceptance criteria (checkout QR display, admin confirm-button, `/account` status
  reflect) use Hybrid + Agent-Probe tiers, matching SPEC.

## Touchpoints

### A — New files (no dependency on deletion order)

| File | Change |
|---|---|
| `.env.example` | Add `# ─── VietQR (chuyển khoản ngân hàng, tự host, không gateway) ───` block: `VIETQR_BANK_ID=`, `VIETQR_ACCOUNT_NO=`, `VIETQR_ACCOUNT_NAME=`, `VIETQR_TEMPLATE=compact2`, with a comment header + doc URL `https://vietqr.io/danh-sach-ngan-hang-vietqr`, following the existing `PAYOS_*`/`CLOUDINARY_*` block convention exactly (comment line + doc URL + blank vars). |
| `lib/vietqr.ts` (new, server-only) | New module, same nullable-client defensive pattern as `lib/payos.ts`/`lib/resend.ts`. Exports `buildVietQrImageUrl(input: { amount: number; addInfo: string }): string \| null`. Reads `process.env.VIETQR_BANK_ID`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `VIETQR_TEMPLATE` (default `"compact2"` if unset) at call time (not module load — avoids the "throws at import" trap `lib/env.ts` warns against). Returns `null` if `VIETQR_BANK_ID` or `VIETQR_ACCOUNT_NO` is unset (caller must null-check, matching the payos/resend/redis pattern). Builds: ``https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`` — confirm exact query-param names/shape via `vc-docs-seeker` before finalizing (see Note below). `addInfo` value = the order code (e.g. `NT-20260827-AB12`), matching the SPEC's "order reference" requirement. First `import "server-only"` line, matching repo convention. |
| `lib/vietqr.test.ts` (new) | Unit test: given all 4 env vars set, `buildVietQrImageUrl({amount, addInfo})` returns a URL containing the bank id, account no, template, and correctly-encoded amount/addInfo/accountName query params. Given `VIETQR_BANK_ID` or `VIETQR_ACCOUNT_NO` unset, returns `null`. Uses `vi.stubEnv`/`process.env` mutation + `vi.resetModules()` per-test (module reads env at call time, not import time, so no reset-modules trick is even required — confirm during EXECUTE). |
| `features/admin-orders/services/admin-orders.repository.test.ts` — **extend, not new** (see touchpoint C1) | New `describe("confirmPayment")` block. |

### B — `checkout.service.ts` / `order.repository.ts` (the resolvePayment + persistence layer)

| File | Change |
|---|---|
| `features/checkout/services/checkout.service.ts` | 1) Remove `import { payosService } from "./payos.service";` — replace with `import { buildVietQrImageUrl } from "@/lib/vietqr";`. 2) `resolvePayment()`: replace the PayOS branch with a `bank_transfer` branch — pure, synchronous (no `await`, no external call): compute `qrImageUrl = buildVietQrImageUrl({ amount: context.amount, addInfo: context.orderCode })`, return `{ uiStatus: "awaiting_payment", qrImageUrl: qrImageUrl ?? undefined }`. No `payosOrderCode`/`payosPaymentLinkId` in the returned shape — those fields are deleted from `ResolvedPayment`. 3) Remove the entire `try { row = await orderRepository.create(...) } catch (createError) { if (payosOrderCode) {...cancelPaymentLink...} throw createError }` block (lines ~168-208) — restore to a plain `const row = await orderRepository.create(...)` (this is the INNOVATE-locked "no orphan-cancel scaffold" decision — the safety net existed only for PayOS's external side effect, which no longer exists). 4) `createOrder()`'s call into `orderRepository.create()`: drop `payosOrderCode`/`payosPaymentLinkId` from the `meta` object passed in. 5) Add `qrImageUrl` to the returned `CreateOrderResult.summary`-adjacent top-level shape (see types touchpoint) — populate from `resolvePayment()`'s result only when `paymentMethod === "bank_transfer"`. 6) **Delete** `getPaymentStatusForUser()` method entirely (PayOS-specific reconciliation, SPEC AC9 forbids any live PayOS surface). 7) **Delete** `retryPayment()` method entirely (same reason — SPEC AC9, also see `RetryPaymentResult` type deletion below). 8) Remove now-unused `ConflictError`, `NotFoundError` imports if no longer referenced after steps 6-7 (re-check at EXECUTE time — `NotFoundError` may still be needed elsewhere in the file; confirm via lint/type-check, don't guess). |
| `features/checkout/services/order.repository.ts` | 1) `mapPaymentMethod()`: change `return method === "cod" ? "COD" : "PAYOS";` → `return method === "cod" ? "COD" : "BANK_TRANSFER";`. 2) `DbPaymentMethod` type: keep `"PAYOS"` in the union (dormant DB value, may still appear in read paths for historical orders) but no code path should ever WRITE it going forward. 3) `create()`: remove `payosOrderCode`/`payosPaymentLinkId` from the `meta` parameter type and from the `.insert({...})` payload (columns stay in the DB schema per SPEC, just stop writing them for new orders — omit the keys entirely rather than passing `null` explicitly, matching how other never-applicable fields are handled elsewhere in this repo). 4) Remove `payos_order_code`/`payos_payment_link_id` from the `.select(...)` column list and from `OrderInsertRow` interface (still readable via raw SQL/admin tooling if ever needed later — out of scope to keep in the app-layer type). 5) **Delete** `findByOrderCodeForUser()`, `updatePayosLink()`, `markPaidByPayosOrderCode()` — confirmed (via repo-wide grep at PLAN time) as called ONLY from the checkout.service methods being deleted and the webhook route being deleted; no other call sites. |
| `features/checkout/types/index.ts` | 1) `PaymentMethod` type: no change needed — already `"cod" \| "bank_transfer"`, correct as-is. 2) `CreateOrderResult`: remove `paymentUrl?: string` (PayOS redirect URL, no longer produced); add `qrImageUrl?: string` (VietQR image URL, only present when `paymentMethod === "bank_transfer"` AND env vars configured). Update the doc-comment above `paymentUrl` accordingly. 3) **Delete** `RetryPaymentResult` type entirely (only consumer was the deleted `retryPayment()` service method + `AccountOrderList.tsx`'s retry button, both being removed). |
| `features/checkout/constants.ts` | `PAYMENT_OPTIONS` array: update the `bank_transfer` entry's `label`/`description` — remove the "(payOS)" / "xác nhận tự động" (auto-confirm) copy since confirmation is now manual. New copy direction (confirm exact Vietnamese wording with a native-reading pass at EXECUTE time, but the semantic must be: no automatic confirmation, staff will confirm manually): e.g. `label: "Chuyển khoản ngân hàng"`, `description: "Quét mã QR và chuyển khoản — nhân viên sẽ xác nhận thủ công sau khi nhận được tiền."` |
| `components/checkout/CheckoutForm.tsx` | **(VALIDATE finding P1, folded into plan)** Remove the `if (result.paymentUrl) { window.location.replace(result.paymentUrl); return; }` block (lines 236-239) entirely — it must fall through to the existing `notify.success(...)` + `router.push('/checkout/success?orderCode=...')` path already below it in the same function. This is a live, previously plan-unlisted consumer of `CreateOrderResult.paymentUrl`; once `paymentUrl` is removed from `CreateOrderResult` (this table, row above), leaving this block in place becomes a TypeScript compile error. Must land in the same pass as the `CreateOrderResult` type change. |

### C — Staff confirm-payment capability (parallel-safe, no dependency on B)

| File | Change |
|---|---|
| `features/admin-orders/types/index.ts` | Add `paymentMethod: string;` (raw DB enum value, e.g. `"BANK_TRANSFER"`, `"COD"`) to the `AdminOrder` interface — needed by the admin UI to gate the new confirm-payment button. Existing `paymentMethodLabel` stays unchanged (display string). |
| `features/admin-orders/services/admin-orders.repository.ts` | 1) `toAdminOrder()`: add `paymentMethod: order.payment_method,` to the returned object (raw value, alongside the existing `paymentMethodLabel`). `OrderRow.payment_method` is already selected via `ORDER_SELECT` — no new SELECT columns needed. 2) Add new exported function `confirmPayment(id: string, staffUserId: string): Promise<AdminOrder>` — mirrors the `updateStatus()` shape but touches `payment_status` only, never `status`. Logic: read current `{status, payment_method, payment_status}` by id (reuse the same select pattern as `updateStatus()`'s current-row read); `NotFoundError` if missing; `BadRequestError("Chỉ xác nhận được đơn chuyển khoản ngân hàng.")` if `payment_method !== "BANK_TRANSFER"`; `BadRequestError("Đơn hàng đã được xác nhận thanh toán.")` if `payment_status === "PAID"`; else `UPDATE orders SET payment_status = 'PAID' WHERE id = ...`, `after(() => auditLogRepository.record({userId: staffUserId, action: "UPDATE", tableName: "orders", recordId: id, oldData: {payment_status: "UNPAID"}, newData: {payment_status: "PAID"}}))` (best-effort, matches the existing `updateStatus()` audit pattern exactly — same `after()` non-blocking wrapper), then re-fetch and return via the existing `getById()`-equivalent select + `toAdminOrder()` mapping (reuse `fetchStatusLogs()` for the `statusHistory` field so the returned shape is consistent with `getById()`). 3) Export `confirmPayment` from the `adminOrdersRepository` object. **Execute-agent instruction (E1, VALIDATE-added, optional hardening — not blocking):** add `AND payment_status = 'UNPAID'` to the `UPDATE orders SET payment_status = 'PAID' WHERE id = ...` statement's WHERE clause for atomicity against a double-confirm race (two concurrent staff clicks could both pass the pre-check before either UPDATE lands). This mirrors an identical pre-existing gap in the sibling `updateStatus()` function — not a new risk class, apply proactively here since this is new code. |
| `features/admin-orders/schemas/admin-orders.schema.ts` | No request-body schema needed — the confirm-payment endpoint takes no body (order id comes from the URL param, matching the pattern of a state-transition action with no payload). If EXECUTE finds a need for an optional `note` field (matching `adminOrderStatusUpdateSchema`'s shape for consistency), add `adminOrderConfirmPaymentSchema = z.object({ note: z.string().trim().max(500).optional() })` — decide based on whether the UI needs a note field; default to NO body schema (simpler, YAGNI) unless UX review during EXECUTE indicates otherwise. |
| `app/api/staff/orders/[id]/confirm-payment/route.ts` (new) | `POST` handler, exact same shape as `app/api/staff/orders/[id]/status/route.ts`: `authenticate(req)` → `requireRole(user, "STAFF")` → `const { id } = await params;` → `const order = await adminOrdersRepository.confirmPayment(id, user.userId);` → `return successResponse(order);`. No body parsing (unless the optional-note decision above adds one). |
| `app/api/staff/orders/[id]/confirm-payment/route.test.ts` (new) | Route-handler test following the `app/api/staff/uploads/route.test.ts` established pattern (mock `authenticate`/`requireRole` + `vi.mock` the repository). Cases: (a) STAFF role + BANK_TRANSFER + UNPAID order → 200, `payment_status` becomes `PAID`; (b) non-STAFF role → 403 (via `requireRole` mock throwing); (c) COD order → 400 `BadRequestError`; (d) already-PAID order → 400 `BadRequestError`; (e) unknown order id → 404 `NotFoundError`. |
| `features/admin-orders/services/admin-orders.service.ts` | Add `async confirmPayment(id: string): Promise<AdminOrder> { return apiRequest<AdminOrder>(\`${BASE_PATH}/${id}/confirm-payment\`, { method: "POST" }); }` — same shape as `updateStatus()`. |
| `components/admin/orders/AdminOrderDetail.tsx` | Add a "Xác nhận đã nhận thanh toán" (Confirm payment received) button, visible only when `order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "unpaid"`. Wire to `adminOrdersService.confirmPayment(order.id)` via a new `handleConfirmPayment` async handler (same `mutate()` + `revalidateAfterOrderMutation()` + `notify.success/error` pattern as `handleUpdateStatus`). Place it in the existing "Bước tiếp theo" (Next step) section or as its own section near the payment-status badge in the identity band — final placement decided during EXECUTE based on UI flow, but must be visually distinct from the order-status transition buttons (different action, different state machine per SPEC's two-state-machine model). |
| `components/admin/orders/AdminOrdersList.tsx` | Confirm (read file at EXECUTE time) whether the list view needs a visual indicator for "bank-transfer orders awaiting confirmation" (SPEC AC5 / User Story 4 — staff need to SEE which orders need confirmation from the list, not just the detail page). At minimum, surface `paymentStatus === "unpaid"` visibility for BANK_TRANSFER rows (reuse the existing `paymentStatus` badge pattern from `AdminOrderDetail.tsx`'s identity band if the list doesn't already show one). |

### D — Checkout success UI (parallel-safe with C, depends on B for the `qrImageUrl` field)

| File | Change |
|---|---|
| `components/checkout/CheckoutSuccessView.tsx` | Remove the `isPayos`/`isPayosPaid`/`livePaymentStatus` prop entirely — the component no longer needs live-status props since there is no live status. Replace the `isPayos ? (...) : null` block with: when `order.paymentMethod === "bank_transfer"`, render the QR image (`<img src={order.qrImageUrl} alt="Mã QR chuyển khoản VietQR" />`, with a graceful fallback message if `qrImageUrl` is undefined — env vars not configured — showing the bank details as plain text instead, or a "liên hệ để được hỗ trợ thanh toán" message; do not crash), the bank account display info (BIN/account name — from the same env-driven source, or omit if only the image is shown), and static instructional copy ("Quét mã QR bằng app ngân hàng để chuyển khoản. Đơn hàng sẽ được xác nhận thủ công sau khi chúng tôi nhận được tiền." / "awaiting confirmation" framing) instead of the old "Đang chờ xác nhận thanh toán... hệ thống sẽ tự động xác nhận" (auto-confirm) copy. Remove the "Đơn demo — chưa trừ tiền" footer line's PayOS-adjacent implication if it still reads as tied to the old flow (re-check copy during EXECUTE). |
| `app/checkout/success/page.tsx` | Delete `usePayosLiveStatus()` hook entirely (the whole function, ~35 lines) and its call site (`const livePaymentStatus = usePayosLiveStatus(order);`). Remove the `livePaymentStatus` prop passed to `<CheckoutSuccessView>`. Remove the now-unused `apiRequest` import if nothing else in this file uses it (re-check at EXECUTE time). |

### E — Delete all PayOS surface (depends on B, C, D being complete — nothing left referencing these)

| File | Action |
|---|---|
| `lib/payos.ts` | Delete |
| `features/checkout/services/payos.service.ts` + `.test.ts` | Delete both |
| `features/checkout/schemas/payos.schema.ts` + `.test.ts` | Delete both |
| `app/api/checkout/payos/webhook/route.ts` | Delete |
| `app/api/checkout/payos/status/route.ts` | Delete |
| `app/api/checkout/payos/retry/route.ts` | Delete |
| `features/checkout/services/checkout.service.test.ts` | Update — remove all PayOS-branch test cases (payment link creation, orphan-link cancellation, `getPaymentStatusForUser`, `retryPayment`); add new test cases for the `bank_transfer` branch (see Verification Evidence). |
| `features/checkout/services/order.repository.test.ts` | Update — remove tests for `markPaidByPayosOrderCode`/`updatePayosLink`/`findByOrderCodeForUser` (deleted functions); update `mapPaymentMethod`/`create()` tests to expect `"BANK_TRANSFER"` instead of `"PAYOS"` for the `bank_transfer` input case; remove `payos_order_code`/`payos_payment_link_id` assertions from the insert-payload test. |
| `features/account/services/account-order.service.ts` | Remove `PAYOS` from the `payment_method` union in `OrderListRow` (keep `"PAYOS"` in the *read* type only if historical orders may still have it in the DB — decide at EXECUTE: since the enum value stays in the DB per SPEC and old orders may exist with `payment_method = 'PAYOS'`, KEEP `"PAYOS"` in this read-only union so historical orders don't crash the mapper; do NOT remove it here, only remove/change the *write* path in `order.repository.ts` (touchpoint B). This is a deliberate asymmetry — flag it clearly in code comments). Remove `canRetryPayment` field computation (`row.payment_method === "PAYOS" && paymentStatus === "UNPAID"`) → delete the field entirely from both this mapping function and the `AccountOrder` type (touchpoint below). |
| `features/account/types/index.ts` | Remove `canRetryPayment: boolean;` field from `AccountOrder` interface. |
| `components/account/AccountOrderList.tsx` | Remove the `handleRetryPayment` handler, the `retryingRef` guard, the `RetryPaymentResult` import, and the `{order.canRetryPayment ? <FillButton onClick={...}>Thanh toán ngay</FillButton> : null}` block entirely. |
| `features/admin-orders/services/admin-orders.repository.ts` | `PAYMENT_METHOD_LABEL` map: keep the `PAYOS: "Chuyển khoản ngân hàng (payOS)"` entry (historical orders still need a readable label) but update `BANK_TRANSFER: "Chuyển khoản ngân hàng"` label copy to drop any "(tự động)" implication if present (currently already payOS-free wording — verify no change needed, this row was already correct at PLAN time). |
| `features/admin-orders/services/admin-orders.repository.test.ts` | Add new `describe("confirmPayment")` block (see touchpoint C) — this is where the new tests physically live, alongside the update, not a separate new test file. |
| `supabase/migrations/20260722010000_payos_bank_transfer.sql` | **No change.** Confirmed by SPEC + INNOVATE: app-layer-only scope, this migration and its DB artifacts (`PAYOS` enum value, `payos_order_code`/`payos_payment_link_id` columns, the partial unique index) are left in place, dormant. Do not write a new migration to drop them. |

## Note — VietQR Quick Link URL contract (confirm before EXECUTE writes `lib/vietqr.ts`)

The exact query-string parameter names/shape for `img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png`
must be confirmed via `vc-docs-seeker` (or a direct fetch of `https://vietqr.io/danh-sach-ngan-hang-vietqr`
and the VietQR Quick Link doc) at the start of EXECUTE, before writing `lib/vietqr.ts` — RESEARCH/INNOVATE
sketched `?amount=...&addInfo=...&accountName=...` informally but did not verify the exact param
casing/order/encoding rules against VietQR's live documentation. Do not hardcode the param shape from
memory; confirm first. If EXECUTE cannot reach the live doc (no internet in the execution sandbox),
fall back to the informally-sketched shape and flag it as a documented assumption in the phase report
for a follow-up Agent-Probe verification against the real rendered QR image.

## Public Contracts

- **New:** `POST /api/staff/orders/[id]/confirm-payment` — STAFF-only, no request body (or optional
  `note`), returns `AdminOrder`. New public API surface.
- **New:** `lib/vietqr.ts::buildVietQrImageUrl()` — server-only pure function, no external call (just
  string building), nullable-return contract matching `lib/payos.ts`/`lib/resend.ts`.
- **Changed:** `CreateOrderResult` — `paymentUrl?: string` removed, `qrImageUrl?: string` added. Any
  external consumer of this type (none found outside `features/checkout/` and
  `components/checkout/CheckoutSuccessView.tsx` at PLAN time — re-verify at EXECUTE) must be updated.
- **Changed:** `AdminOrder` — new `paymentMethod: string` field added (additive, non-breaking).
- **Changed:** `AccountOrder` — `canRetryPayment` field removed (breaking for any consumer reading
  it — confirmed only consumer is `AccountOrderList.tsx`, updated in the same plan).
- **Removed:** `RetryPaymentResult` type, `checkoutService.getPaymentStatusForUser()`,
  `checkoutService.retryPayment()`, `orderRepository.findByOrderCodeForUser()`,
  `orderRepository.updatePayosLink()`, `orderRepository.markPaidByPayosOrderCode()`,
  `payosService` (entire module), `payos.schema.ts` (entire module), 3 PayOS API routes.
- **DB-level (unchanged, confirmed no migration):** `PaymentMethod` enum keeps `PAYOS` value dormant;
  `orders.payos_order_code`/`orders.payos_payment_link_id` columns stay in place, unused by new writes.

## Blast Radius

- **File count:** 24 files from RESEARCH's original PayOS-touchpoint list, all independently
  re-verified at PLAN time via direct read/grep (see "Verified-at-PLAN-time facts" above) — plus 2
  net-new files (`lib/vietqr.ts` + its test) and 1 net-new route pair
  (`confirm-payment/route.ts` + test) not in the original 24. **Total unique files touched or created:
  ~29** (24 original ± exact set below, +5 new).
- **Packages/areas:** single Next.js app, no monorepo boundary. Touches: `lib/` (1 new, 1 deleted),
  `features/checkout/` (services, schemas, types, constants — 8 files), `features/admin-orders/`
  (types, schema note, repository, service — 4 files), `features/account/` (service, types — 2
  files), `components/checkout/` (1), `components/account/` (1), `components/admin/orders/` (1-2),
  `app/api/checkout/` (3 deleted, 1 unchanged `route.ts`), `app/api/staff/orders/` (1 new route pair),
  `app/checkout/success/` (1), `.env.example` (1), zero migration files.
- **Risk class:** billing/payment (high-risk, per this repo's orchestration protocol) — this plan
  changes how orders are persisted (`payment_method` enum value written), removes a payment-status
  reconciliation surface (webhook), and adds a new staff-facing mutation endpoint that changes
  `payment_status`. VALIDATE must apply the high-risk minimum-tier rule (Hybrid minimum, no
  known-gap without explicit rationale) to every row touching order creation, payment status, or the
  new confirm-payment endpoint.
- **No schema migration** — confirmed twice (SPEC Constraints + this plan's Verified-at-PLAN-time
  facts). This lowers blast radius relative to a typical payment-surface change.

## Test Infra Improvement Notes

(none identified yet)

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `lib/vietqr.test.ts` — `buildVietQrImageUrl()` builds correct URL from all 4 env vars; returns `null` when `VIETQR_BANK_ID`/`VIETQR_ACCOUNT_NO` unset | Fully-Automated | AC1 |
| `checkout.service.test.ts` — `resolvePayment("bank_transfer", ...)` returns `{uiStatus: "awaiting_payment", qrImageUrl}` built from `buildVietQrImageUrl`, with zero calls to any PayOS/gateway module (module deleted, so a stray import would be a type/build error, not just a runtime assertion) | Fully-Automated | AC1, AC9 |
| `checkout.service.test.ts` / `order.repository.test.ts` — existing stock-check + `order_items` insert tests continue passing unmodified for the `bank_transfer` path (only `mapPaymentMethod`'s output enum value changes, not the flow) | Fully-Automated | AC2 |
| `CheckoutSuccessView.test.tsx` (new, or extend existing if one exists — confirm at EXECUTE) — renders "awaiting confirmation" static copy for `paymentMethod: "bank_transfer"`, no spinner/poll, no crash when `qrImageUrl` is undefined | Fully-Automated | AC3 |
| Agent-Probe: live walkthrough of `/checkout` → select bank transfer → submit → confirm QR renders, amount/reference are correct, no broken/blank state | Agent-Probe (component of the Hybrid pair for AC3) | AC3 |
| `admin-orders.repository.test.ts::confirmPayment` — creating and progressing a `BANK_TRANSFER` order through non-payment status changes (`updateStatus` to processing/shipped/delivered) never sets `payment_status = PAID`; only `confirmPayment()` does; grep-confirm no cron/scheduled job file exists anywhere in the repo touching `payment_status` | Fully-Automated | AC4 |
| `admin-orders.repository.test.ts` — `list()`/`getById()` surface `paymentMethod`/`paymentStatus` fields for BANK_TRANSFER orders (extend existing tests with a BANK_TRANSFER fixture row) | Fully-Automated | AC5 |
| Agent-Probe: live walkthrough of `/staff/orders` list + detail — confirm bank-transfer unpaid orders are visually distinguishable | Agent-Probe (component of the Hybrid pair for AC5) | AC5 |
| `app/api/staff/orders/[id]/confirm-payment/route.test.ts` — 5 cases: STAFF+BANK_TRANSFER+UNPAID → 200/PAID; non-STAFF → 403; COD order → 400; already-PAID → 400; unknown id → 404 | Fully-Automated | AC6 |
| `account-order.service.test.ts` (extend existing) — `toAccountOrder()` maps `payment_status: "PAID"` the same way for BANK_TRANSFER as it already does for COD/PAYOS (no method-specific branching in the mapper beyond `canRetryPayment` removal) | Fully-Automated | AC7 |
| Agent-Probe: live walkthrough of `/account` — after a staff confirm-payment action, the customer's order-history entry flips to "paid" without further customer action | Agent-Probe (component of the Hybrid pair for AC7) | AC7 |
| `checkout.service.test.ts` / `admin-orders.repository.test.ts` — existing COD-path test cases pass completely unmodified (byte-diff the test file's COD assertions pre/post this plan — no COD-specific line should change) | Fully-Automated | AC8 |
| Type-check / build (`npm run type-check`) fails to compile if any surviving file still imports a deleted PayOS module; `grep -rL` sweep across `app/`, `features/`, `components/`, `lib/` for `payos` (case-insensitive) after deletion, expect zero live-code matches (test fixtures/comments referencing "payOS" as historical context are acceptable, live imports are not) | Fully-Automated | AC9 |
| `app/api/checkout/payos/{webhook,status,retry}/route.ts` no longer exist — Next.js router returns 404 for those paths by construction (route files removed); no explicit route test needed to prove file-absence, but add one `route.test.ts`-adjacent check or a build-time grep assertion for defense-in-depth | Fully-Automated | AC9 |

### High-Risk Class Table

| Area | High-risk class | Minimum tier | Gap rationale if known-gap accepted |
|---|---|---|---|
| `checkout.service.ts::resolvePayment` (bank_transfer branch) | billing/payment | Hybrid (Fully-Automated achieved — no known-gap) | — |
| `admin-orders.repository.ts::confirmPayment` (new) | billing/payment | Hybrid (Fully-Automated achieved — no known-gap) | — |
| `app/api/staff/orders/[id]/confirm-payment/route.ts` (new mutation endpoint) | billing/payment, permission/trust-boundary (STAFF-only) | Hybrid (Fully-Automated achieved — no known-gap) | — |
| `order.repository.ts::create()` — `payment_method` enum write path | billing/payment | Fully-Automated (existing coverage extended) | — |
| Checkout QR display (`CheckoutSuccessView.tsx`) | billing/payment (customer-facing amount/reference display) | Hybrid | If Agent-Probe walkthrough cannot be run this session, document as a deferred backlog artifact (do NOT silently accept as done) — matches the precedent set by the coupon-checkout-integration feature's backlog note. |

### Missing Test Areas

| Area | Why untestable in this plan | Resolution chosen |
|---|---|---|
| Actual VietQR image rendering correctness (does the generated URL produce a scannable QR with correct bank/amount encoded) | No live network call is made in Vitest (mocked/pure URL-building only); requires either a live fetch to `img.vietqr.io` or a human/agent visually confirming the rendered `<img>` | Agent-Probe walkthrough (see Verification Evidence AC3 row) — visually confirm the QR renders and scans correctly in at least one manual pass before treating this as production-ready, per SPEC's high-risk manual-first evidence handoff requirement |
| VietQR Quick Link exact param-shape correctness against the live API (does `img.vietqr.io` actually accept the param names this plan sketches) | Confirmed only informally at RESEARCH/INNOVATE time, not verified against live docs at PLAN time | `vc-docs-seeker` verification is a REQUIRED first EXECUTE step (see the Note above) — this is not a deferred gap, it is a blocking pre-step for `lib/vietqr.ts`'s implementation |

## Resume and Execution Handoff

1. **Selected plan file path:** `process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_PLAN_27-08-26.md`
2. **Last completed phase or step:** PLAN — this document. RESEARCH and INNOVATE (Decision Summary)
   completed in prior sessions (SPEC and Decision Summary content folded into this plan's front
   matter — see "Locked SPEC" and "Locked INNOVATE decision" above).
3. **Validate-contract status:** not written — placeholder below. VALIDATE (`vc-validate-agent`) must
   run before EXECUTE, per this repo's mandatory VALIDATE gate for billing/payment high-risk-class
   plans (no skip conditions apply — this is a multi-file, schema-adjacent, billing-surface change).
4. **Supporting context files loaded this session:**
   - `process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_SPEC_27-08-26.md`
   - `process/context/payment/all-payment.md`
   - `process/context/tests/all-tests.md`
   - `process/context/database/all-database.md` (routed but content already covered by the payment
     group + direct migration reads — no additional facts beyond what's captured above)
   - Direct reads: `supabase/migrations/20260718000000_init_schema.sql`,
     `supabase/migrations/20260722010000_payos_bank_transfer.sql`,
     `features/checkout/services/checkout.service.ts`, `order.repository.ts`, `checkout.schema.ts`,
     `features/checkout/types/index.ts`, `constants.ts`, `features/admin-orders/services/admin-orders.repository.ts`,
     `.../types/index.ts`, `.../schemas/admin-orders.schema.ts`, `.../services/admin-orders.service.ts`,
     `features/account/services/account-order.service.ts`, `.../types/index.ts`,
     `features/admin-audit/services/audit-log.repository.ts`, `components/checkout/CheckoutSuccessView.tsx`,
     `app/checkout/success/page.tsx`, `components/account/AccountOrderList.tsx`,
     `components/admin/orders/AdminOrderDetail.tsx`, `app/api/staff/orders/[id]/status/route.ts`,
     `app/api/staff/orders/[id]/route.ts`, `.env.example`.
5. **Next step for a fresh agent picking up mid-execution:** run `vc-validate-agent` against this
   plan file next. If resuming after VALIDATE, check this plan's `## Validate Contract` section for
   gate status before spawning `vc-execute-agent`. EXECUTE's first concrete action must be the
   `vc-docs-seeker` VietQR param-shape confirmation (see the Note above) before writing `lib/vietqr.ts`.

## Implementation Checklist

Atomic, numbered, in dependency order (this IS the "Suggested Execution Ordering" from INNOVATE,
expanded to file-level granularity; do not batch across sections; run per-section test gates as
you go):

**Section 1 - VietQR utility (no dependency on any other section)**
1. Confirm the VietQR Quick Link URL param shape via vc-docs-seeker (see the Note above) before
   writing any code.
2. Add the VIETQR_* env block to the local env-vars example file, following this repo's existing
   per-integration block convention.
3. Create lib/vietqr.ts (buildVietQrImageUrl()), server-only, nullable-return pattern.
4. Create lib/vietqr.test.ts - cover both the happy path and the missing-env-var null path.
5. Test gate: npx vitest run lib/vietqr.test.ts && npm run type-check.

**Section 2 - checkout.service.ts / order.repository.ts (depends on Section 1's buildVietQrImageUrl)**
6. checkout.service.ts: swap the PayOS branch in resolvePayment() for the bank_transfer
   branch calling buildVietQrImageUrl(); remove the orphan-cancel try/catch; drop
   payosOrderCode/payosPaymentLinkId from the meta object passed to orderRepository.create();
   delete getPaymentStatusForUser() and retryPayment(); remove the payosService import.
6b. components/checkout/CheckoutForm.tsx: remove the `if (result.paymentUrl) { window.location.replace(result.paymentUrl); return; }`
    block (lines 236-239) entirely; let it fall through to the existing notify.success(...) + router.push(...)
    success path (VALIDATE finding P1 — live consumer of the removed CreateOrderResult.paymentUrl field).
7. order.repository.ts: mapPaymentMethod() returns "BANK_TRANSFER"; drop payos_order_code /
   payos_payment_link_id from the insert payload, select list, and OrderInsertRow; delete
   findByOrderCodeForUser(), updatePayosLink(), markPaidByPayosOrderCode().
8. features/checkout/types/index.ts: remove paymentUrl, add qrImageUrl; delete
   RetryPaymentResult.
9. features/checkout/constants.ts: update PAYMENT_OPTIONS bank_transfer copy (remove
   "auto-confirm" framing).
10. Test gate: npx vitest run features/checkout/services/checkout.service.test.ts features/checkout/services/order.repository.test.ts && npm run type-check (expect failures until Section 5 removes stale PayOS-branch test cases - track as in-progress, not a blocker to continue to Section 3/4).

**Section 3 - Staff confirm-payment endpoint (parallel-safe with Section 4, depends only on Section 1/2's type changes existing)**
11. features/admin-orders/types/index.ts: add paymentMethod: string to AdminOrder.
12. features/admin-orders/services/admin-orders.repository.ts: add paymentMethod to
    toAdminOrder(); add and export confirmPayment(id, staffUserId).
13. Decide and apply the optional request-body schema (default: none - YAGNI) in
    admin-orders.schema.ts.
14. Create app/api/staff/orders/[id]/confirm-payment/route.ts.
15. Create app/api/staff/orders/[id]/confirm-payment/route.test.ts - all 5 cases.
16. features/admin-orders/services/admin-orders.service.ts: add confirmPayment() client method.
17. Test gate: npx vitest run features/admin-orders app/api/staff/orders/[id]/confirm-payment && npm run type-check.

**Section 4 - Checkout success UI (depends on Section 2's qrImageUrl field)**
18. components/checkout/CheckoutSuccessView.tsx: remove isPayos/livePaymentStatus props;
    render the QR image + static "awaiting confirmation" copy for bank_transfer.
19. app/checkout/success/page.tsx: delete usePayosLiveStatus() and its call site.
20. Test gate: npx vitest run components/checkout && npm run type-check (add a
    CheckoutSuccessView test if none exists covering the new static-confirmation branch).

**Section 5 - Delete PayOS surface (run only after Sections 2-4 land, nothing references PayOS)**
21. Delete lib/payos.ts, features/checkout/services/payos.service.ts (+test),
    features/checkout/schemas/payos.schema.ts (+test),
    app/api/checkout/payos/{webhook,status,retry}/route.ts.
22. Update features/checkout/services/checkout.service.test.ts - remove PayOS-branch cases, add
    bank_transfer branch cases.
23. Update features/checkout/services/order.repository.test.ts - remove deleted-function tests,
    update mapPaymentMethod/insert-payload assertions to BANK_TRANSFER.
24. features/account/services/account-order.service.ts: remove canRetryPayment computation
    (keep "PAYOS" in the read-only OrderListRow union for historical-order safety).
25. features/account/types/index.ts: remove canRetryPayment from AccountOrder.
26. components/account/AccountOrderList.tsx: remove the retry-payment handler + button + import.
27. Test gate: npm run check (full local pre-push gate - first point this should be clean end to end).

**Section 6 - Admin order list/detail UI (depends on Section 3)**
28. components/admin/orders/AdminOrderDetail.tsx: add the confirm-payment button, gated on
    paymentMethod === "BANK_TRANSFER" && paymentStatus === "unpaid".
29. components/admin/orders/AdminOrdersList.tsx: confirm/add a visual indicator for
    bank-transfer-awaiting-confirmation rows in the list view.
30. Final test gate: npm run check (full suite + lint + type-check + format-check) - this is the
    EVL confirmation run.

## Phase Completion Rules

This is a SIMPLE-structured COMPLEX plan (one execution pass, no phase-program split) - "done" means
all 6 sections above are code-complete AND npm run check is green AND the Verification Evidence
table's Fully-Automated rows all pass AND the two Agent-Probe walkthroughs (checkout QR display,
admin confirm-payment + /account reflect) have been performed at least once before this plan is
marked "Ready for UPDATE PROCESS archival". Code-complete-but-unverified is CODE DONE, not
VERIFIED - do not mark this plan complete on green automated tests alone; the two Agent-Probe
walkthroughs are mandatory given the billing/payment high-risk class (see High-Risk Class Table).

## Validate Contract

Status: PASS
Date: 27-08-26
date: 2026-08-27
generated-by: outer-pvl

Parallel strategy: parallel-subagents
Rationale: 7-signal score 4/7 (S1 multi-package scope, S2 schema/API/auth surface via payment_status write, S6 high-risk billing/payment class, S7 7+ blast-radius files) — Layer 1 (4 dimension agents) + Layer 2 (5 section agents A-E) run as fire-and-forget parallel subagents, no cross-agent communication needed during investigation.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | `buildVietQrImageUrl()` builds correct URL from env vars; returns null when unset | Fully-Automated | `npx vitest run lib/vietqr.test.ts` | A |
| AC1, AC9 | `resolvePayment("bank_transfer", ...)` returns qrImageUrl shape, zero PayOS module calls | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts` | A |
| AC2 | stock-check + order_items insert unchanged for bank_transfer path | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts features/checkout/services/order.repository.test.ts` | A |
| AC3 | CheckoutSuccessView renders static "awaiting confirmation" copy, no crash when qrImageUrl undefined | Fully-Automated | `npx vitest run components/checkout` (new/extended CheckoutSuccessView test) | B |
| AC3 | live QR renders correctly, amount/reference correct | Agent-Probe | manual walkthrough: `/checkout` → bank transfer → submit → confirm QR | D |
| AC4 | only `confirmPayment()` sets payment_status=PAID; status-only transitions never do | Fully-Automated | `npx vitest run features/admin-orders` (`confirmPayment` describe block) | A |
| AC5 | `list()`/`getById()` surface paymentMethod/paymentStatus for BANK_TRANSFER | Fully-Automated | `npx vitest run features/admin-orders` | A |
| AC5 | staff list/detail visually distinguish unpaid bank-transfer orders | Agent-Probe | manual walkthrough: `/staff/orders` list + detail | D |
| AC6 | confirm-payment route: 200/403/400×2/404 across 5 cases | Fully-Automated | `npx vitest run app/api/staff/orders/[id]/confirm-payment` | A |
| AC7 | `toAccountOrder()` maps payment_status the same for BANK_TRANSFER as COD/PAYOS | Fully-Automated | `npx vitest run features/account` (extended `account-order.service.test.ts`) | A |
| AC7 | customer /account order flips to "paid" after staff confirm, no customer action | Agent-Probe | manual walkthrough: `/account` after staff confirm-payment | D |
| AC8 | COD-path test cases pass unmodified (no COD-specific assertion changes) | Fully-Automated | `npx vitest run features/checkout/services/checkout.service.test.ts features/admin-orders` (byte-diff COD assertions) | A |
| AC9 | build fails on any surviving PayOS import; zero live-code `payos` matches | Fully-Automated | `npm run type-check` + `grep -rL` sweep across app/, features/, components/, lib/ for `payos` (case-insensitive), expect zero live-code matches | A |
| AC9 | deleted PayOS API routes return 404 by file-absence | Fully-Automated | build-time grep assertion / route.test.ts-adjacent check confirming `app/api/checkout/payos/{webhook,status,retry}` do not exist | A |
| — | full local pre-push gate, all sections combined (EVL confirmation run) | Fully-Automated | `npm run check` | A |

gap-resolution legend:
- A — proven now (gate passes in this cycle)
- B — fixed in this plan (gate added by this plan's checklist)
- C — deferred to a named later phase/plan
- D — backlog test-building stub (named residual; keep-active; continue) — here: 3 mandatory Agent-Probe walkthroughs (AC3, AC5, AC7), all already scheduled in this plan's Phase Completion Rules as required before archival, not silently deferred.

Legacy line form (retained so existing validate-contract consumers still parse):
- checkout/payment service layer (Section B + confirmPayment): Fully-automated: `npx vitest run features/checkout features/admin-orders` | hybrid: n/a (no live-DB precondition beyond mocked Supabase client) | agent-probe: 3 walkthroughs above | known-gap: none
- checkout/admin UI (Sections C/D/F): Fully-automated: `npx vitest run components/checkout components/admin/orders` | agent-probe: visual QR + list-badge confirmation | known-gap: none
- PayOS deletion sweep (Section E): Fully-automated: `npm run type-check` + `grep -rL` payos sweep | known-gap: none

Dimension findings:
- Infra fit: PASS — single Next.js app, no container/proxy/worker surface touched; no port or runtime conflicts; all edit-target files verified present on disk at V1.
- Test coverage: PASS — Vitest-only test infra confirmed via `process/context/tests/all-tests.md`; every AC has a Fully-Automated row except the 3 inherently-manual UI walkthroughs, correctly tiered Agent-Probe (not silently known-gapped); no high-risk area rests on Known-Gap alone (net-gate vacuous-green check: all billing/payment rows in the High-Risk Class Table above already hit Fully-Automated or Hybrid-achieved).
- Breaking changes: CONCERN → RESOLVED (folded into plan) — `components/checkout/CheckoutForm.tsx` was a plan-unlisted live consumer of `CreateOrderResult.paymentUrl`; now added to Touchpoints Section B (P1) and Implementation Checklist step 6b. `AccountOrder.canRetryPayment` and `RetryPaymentResult` removals were already correctly tracked in the original plan's Public Contracts section — no other unlisted consumers found.
- Security surface: CONCERN → RESOLVED (folded into plan) — `confirmPayment()` had a check-then-set race window (read payment_status, separate error-if-PAID check, then plain UPDATE); hardened via E1 instruction (`AND payment_status = 'UNPAID'` in the UPDATE WHERE clause) added to the Section C touchpoint row. Same latent pattern pre-exists in `updateStatus()` (out of this plan's blast radius, not a new risk class introduced by this plan) — not blocking, noted for awareness only.
- Section A — VietQR utility: PASS — new files, no dependency ordering issues, nullable-client pattern matches `lib/payos.ts`/`lib/resend.ts` convention exactly.
- Section B — checkout.service.ts / order.repository.ts: PASS (after P1 fold-in) — mechanically feasible, all edit targets grep-confirmed at PLAN time; gap found and resolved (CheckoutForm.tsx consumer).
- Section C — Staff confirm-payment capability: PASS (after E1 fold-in) — mechanically feasible, parallel-safe with Section D as stated; race-condition hardening now documented for execute-agent.
- Section D — Checkout success UI: PASS — mechanically feasible, correctly sequenced after Section B for the `qrImageUrl` field dependency.
- Section E — Delete PayOS surface: PASS — deletion order correctly sequenced last (after B/C/D land), grep-confirmed no other call sites for the 3 deleted repository functions.

Open gaps: none — both CONCERNs (breaking-change consumer, security hardening) were resolved by folding fixes directly into the plan (Touchpoints + Implementation Checklist), not deferred. The 2 Missing Test Areas rows (VietQR image rendering correctness, VietQR param-shape live-doc confirmation) were already tracked in the original plan with explicit resolutions (Agent-Probe walkthrough; mandatory first-EXECUTE-step vc-docs-seeker confirmation, respectively) — not new gaps introduced by VALIDATE.

What this coverage does NOT prove:
- `lib/vietqr.test.ts` (AC1): does not prove the generated URL actually renders a scannable, correctly-encoded QR image against the live `img.vietqr.io` service — pure string-building unit test only, no live network call. Covered by the mandatory Agent-Probe walkthrough (AC3) and the required first-EXECUTE-step vc-docs-seeker param-shape confirmation (see plan's Note section).
- `checkout.service.test.ts` (AC1/AC2/AC9): does not prove end-to-end checkout UI behavior (form submission, redirect, success-page render) — service-layer unit test only. Covered by the Agent-Probe walkthroughs.
- `admin-orders.repository.test.ts::confirmPayment` (AC4/AC6): does not prove the double-confirm race hardening (E1's `AND payment_status = 'UNPAID'` clause) under actual concurrent load — no concurrency/load test in this plan's scope; the WHERE-clause fix is a defensive measure proven only by code review, not by a passing automated test. Accepted as adequate hardening for a low-traffic manual staff action (not a new risk class — mirrors existing unhardened `updateStatus()`).
- `npm run type-check` + `grep -rL` payos sweep (AC9): does not prove runtime behavior is correct after PayOS deletion, only that no dangling imports/references remain at compile time. Runtime correctness for the replacement bank_transfer path is covered by the other Fully-Automated + Agent-Probe rows above.
- Agent-Probe walkthroughs (AC3, AC5, AC7): manual, single-pass judgment calls — do not prove behavior across all browsers/devices/screen sizes, only that the happy path renders correctly once, per this repo's existing Agent-Probe convention (no visual-regression tooling in this repo).

Gate: PASS (no FAILs, plan updated — both CONCERNs folded into plan via P1 + E1)
Accepted by: user (session, VALIDATE V5 — "Accept" on both P1 breaking-change fold-in and E1 security hardening fold-in)

## Autonomous Goal Block

SESSION GOAL: Replace PayOS with self-hosted, gateway-free VietQR bank-transfer payment (checkout feature)
Charter + umbrella plan: N/A — single plan, not a phase program
Autonomy: standard RIPER-5 gates apply; ENTER EXECUTE MODE required explicitly; no standing /goal autonomy granted for this session
Hard stop conditions / safety constraints:
- Billing/payment high-risk class — do not treat this plan as production-ready on green automated tests alone; the 2 mandatory Agent-Probe walkthroughs (checkout QR display AC3, admin confirm-payment + /account reflect AC5/AC7) must be performed at least once before archival
- No schema migration is in scope — do not write one; PAYOS enum value and payos_* columns stay dormant in place
- VietQR Quick Link param shape must be confirmed via vc-docs-seeker as the first concrete EXECUTE step, before writing lib/vietqr.ts — do not hardcode the param shape from memory
- Do not touch the COD auto-paid branch in admin-orders.repository.ts::updateStatus() — the new confirmPayment() path must remain a separate, additive function
Next phase: EXECUTE — process/features/checkout/active/vietqr-self-hosted-payment_27-08-26/vietqr-self-hosted-payment_PLAN_27-08-26.md
Validate contract: inline in plan (see ## Validate Contract section above)
Execute start: Fully-Automated: `npx vitest run lib/vietqr.test.ts` (Section 1) | E2E/Agent-probe: manual /checkout walkthrough (AC3) | high-risk pack: no (manual-first evidence via Agent-Probe walkthroughs is already the plan's built-in gate; no separate risk-evidence-pack artifact required beyond the Verification Evidence table)
