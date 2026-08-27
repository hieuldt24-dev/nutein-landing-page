---
name: plan:vietqr-account-badge-followups-27-08-26
description: "Residual open items from the vietqr-self-hosted-payment feature closeout: no automated test coverage for the new AccountOrderList payment-status badge, and no dev-login bypass to run future Agent-Probe walkthroughs without user involvement"
date: 27-08-26
feature: checkout
---

# Backlog — VietQR Payment: Residual Follow-Ups (27-08-26)

Source: `vietqr-self-hosted-payment_27-08-26` (plan archived to
`process/features/checkout/completed/vietqr-self-hosted-payment_27-08-26/`). All 30 implementation
checklist items shipped; EVL independently confirmed all Fully-Automated gates green. The 3
mandatory Agent-Probe walkthroughs (AC3, AC5, AC7) were performed **by the user manually** — no
agent could run them (see item 2 below) — and found a real gap (item 1), which was fixed via the
QUICK FIX lane the same session.

## 1. No automated test coverage for `AccountOrderList.tsx`'s new payment-status badge

**Priority:** Low-Medium — display-only, read-only render of an already-tested backend field
(`order.paymentStatus`, correctly computed and unit-tested at the service layer since before this
fix). Low risk of regression on its own, but this is exactly the class of gap (backend correct,
UI render missing) that a narrow service test cannot catch — see the AC7 incident this note stems
from.

**Scope:** `components/account/AccountOrderList.tsx` has no dedicated test file at all (component
test coverage is a known repo-wide gap — see `process/context/tests/all-tests.md` "React
components/hooks/pages layer" row). Add a component test asserting: given an `AccountOrder` with
`paymentStatus: "PAID"`, the badge renders "Đã thanh toán"; given `"UNPAID"`, it renders "Chưa
thanh toán".

**Verification status of the fix itself:** applied via QUICK FIX lane 27-08-26. Typecheck clean.
The user has **not yet explicitly re-confirmed** the badge displays correctly after a live
`/account` refresh (they moved on to other work) — low-risk since the change is display-only and
follows the exact pattern of the existing, working `AccountOrderStatusBadge` component reading the
same already-correct field, but flagging as unconfirmed rather than silently assuming it's fine.

**Proves:** SPEC AC7 (regression protection for the fix that closed this AC).

## 2. No dev-login/test-credential bypass — blocks all future authenticated Agent-Probe walkthroughs

**Priority:** Medium — recurring infra gap, not specific to this feature. Tracked as a durable
Known Gap in `process/context/tests/all-tests.md` ("OAuth-only auth blocks ALL Agent-Probe browser
walkthroughs for authenticated features"). Every future feature requiring an Agent-Probe walkthrough
of an authenticated page (`/account`, `/staff/**`, `/admin/**`) will hit this same wall until a
test-login bypass or seeded test session exists. Not actioned in this session — recorded here so it
isn't rediscovered from scratch on the next feature.

## Status

Tracked here, not silently dropped. Does not block archival of the source plan — the plan's own
Phase Completion Rules required the 3 Agent-Probe walkthroughs before archival, and all 3 were
performed (by the user) and their one real finding (item 1's root cause, the missing badge) was
already fixed before archival. Item 1 above is residual test-coverage debt for the fix, not an
unresolved acceptance criterion.
