---
name: spec:profile-partial-update-fix
description: "Make PATCH /api/account/profile a genuine partial update so concurrent tab edits stop overwriting each other"
date: 03-09-26
feature: account
---

# SPEC — Profile Partial Update Fix

TL;DR: `PATCH /api/account/profile` is a full-replace disguised as a PATCH. Make it accept `fullName` only, `phone` only, or both; write only what was sent; reject an empty body with 400. Client must stop sending untouched fields.

## Problem

Both `fullName` and `phone` are required by `updateProfileSchema` and written unconditionally by
`profileRepository.update`. The form always submits both RHF values, hydrated once from a
possibly-stale SWR snapshot. Two tabs open on `/account` → each save round-trips both fields →
last writer silently reverts the other tab's change. Silent user data loss, no error surfaced.

## User Goals

| # | Goal |
|---|---|
| G1 | Editing only my phone must not revert a name change I made elsewhere |
| G2 | Editing only my name must not revert a phone change I made elsewhere |
| G3 | A save with nothing changed must not silently pretend to succeed |
| G4 | Existing clients that send both fields must keep working unchanged |

## Key Use Cases

| # | Case | Expected |
|---|---|---|
| U1 | `PATCH {"phone":"0912345678"}` | 200; `name` column untouched; `phone` updated |
| U2 | `PATCH {"fullName":"Nguyen A"}` | 200; `phone` column untouched; `name` updated |
| U3 | `PATCH {"fullName":"...","phone":"..."}` | 200; both updated (backward compatible) |
| U4 | `PATCH {}` | 400 validation error, no DB write |
| U5 | `PATCH {"phone":"abc"}` | 400 regex error, no DB write |
| U6 | `PATCH {"phone":"<already-taken>"}` | 409 `PHONE_TAKEN` (unchanged behavior) |
| U7 | Two tabs, tab A edits phone, tab B edits name, both save | Both changes persist regardless of save order |
| U8 | User opens edit, changes nothing, presses save | No PATCH fired (client-side no-op guard) |

## Acceptance Criteria

- AC1 — `updateProfileSchema` accepts any non-empty subset of `{fullName, phone}`; empty object fails validation.
- AC2 — `profileRepository.update` writes only keys present in the input (conditional spread), always bumping `updated_at`.
- AC3 — Field-level validation rules (name 2–100 chars, phone `^(0|\+84)[0-9]{9}$`) still apply to any field that IS present.
- AC4 — `AccountProfileForm` submits only fields the user actually changed (RHF `dirtyFields`), and skips the request entirely when nothing changed.
- AC5 — Client-side form validation still requires both fields to be well-formed (a dedicated strict form schema — the relaxed API schema must not weaken the form).
- AC6 — `profileRepository` error paths throw `AppError` subclasses instead of plain `Error`.
- AC7 — New Vitest coverage exists for the repository partial-write behavior and the schema subset/empty-body rules.

## Out of Scope

- Phone-uniqueness migration / DB unique constraint (finding inconclusive — do not touch `supabase/migrations/`).
- `fullName` charset restriction (no confirmed unsafe render sink).
- Optimistic-concurrency / ETag / `updated_at` conflict detection (heavier design; partial update solves the reported loss).
- Any change to `GET /api/account/profile`, auth, or the address book.
- Component/UI test infrastructure beyond what already exists.

## Constraints

- Backward compatible: all-fields-present bodies must remain valid (no client version gate).
- Mirror the repo's existing conditional-spread idiom (`features/checkout/services/order.repository.ts:154`); do not invent a new pattern.
- Vitest only; server/repository test files need `// @vitest-environment node`.
- Zero existing tests in this flow — this plan adds the first ones.
