---
name: spec:admin-hardening-batch
description: "Requirements for 4 independent admin-backoffice hardening items (pagination H1, upload MIME sniffing H3, coupon discount cap M2, service-layer tests H2)"
date: 20-08-26
metadata:
  node_type: spec
  type: spec
  feature: general-plans
---

# SPEC — Admin Backoffice Hardening Batch

TL;DR: Four unrelated fixes from the completed admin-backoffice review — bound two unbounded list queries, stop trusting client MIME on uploads, cap percentage coupons at 100, and add contract tests to six untested client service wrappers.

## Goals

| # | Goal | Source finding |
|---|---|---|
| G1 | `admin-users` and `admin-contact` list queries are bounded (limit/offset, default 100, max cap) and `q` search runs in the DB | H1 (remainder) |
| G2 | Upload endpoint validates real file content (magic bytes), not the client-supplied `Content-Type` | H3 |
| G3 | `PERCENTAGE` coupons cannot be created/updated with `discount > 100` | M2 (validation slice only) |
| G4 | All six `features/admin-*/services/*.service.ts` client wrappers have contract tests (query-string building + error passthrough) | H2 (remainder) |

## Key Use Cases

- Admin opens `/admin/users` on a table with 50k users → one page (20 rows) is fetched, not the whole table; typing in search filters server-side via `ilike`.
- Staff opens `/staff/contact` after a contact-form spam flood → paginated, bounded read.
- Attacker uploads `payload.exe` with a spoofed `Content-Type: image/png` → rejected with 400 before reaching Cloudinary.
- Staff creates a `PERCENTAGE` coupon with `discount: 500` → rejected by Zod at the API boundary. A `FIXED` coupon with `discount: 500` (500 VND off) is still valid.
- CI/`npm test` covers the client service layer, so a broken query-string or swallowed error is caught.

## Out of Scope (explicit)

- Coupon redemption / checkout enforcement (`usage_limit`, `expires_at`, `is_active` at order time) — owned by a concurrent track.
- `admin-blog`, `admin-coupons`, `admin-orders.listSummary()` pagination (rest of H1) — not in this batch.
- Any redesign of admin list UI beyond reusing the existing `AdminListPagination` component.
- Rate limiting on the public contact form.
- `admin-blog.service.ts`, `admin-content.service.ts`, `admin-dashboard.service.ts` tests (not in the named six).

## Constraints

- Repo conventions: kebab-case files, repository (`server-only`) + service (client `apiRequest` wrapper) split, Zod at route boundaries, Vitest with co-located `*.test.ts`, `vi.hoisted` + `vi.mock`, `// @vitest-environment node` docblock for `server-only` modules.
- Reference pagination pattern is `features/admin-audit/services/admin-audit.repository.ts` (default 100, `.range(offset, offset+size-1)`, `count: "exact"`, returns `{items,total}`).
- One new npm dependency is permitted for G2 only, and only if it is ESM-compatible with Node 22 + Next 16.
- `features/admin-coupons/schemas/admin-coupons.schema.ts` is shared with the concurrent coupon-checkout track → must be re-read immediately before editing (idempotent pre-check).
- Gate: `npx tsc --noEmit` clean and `npm test` green (excluding the pre-existing `lib/useAddresses.test.tsx` harness-drift failure documented in `process/context/tests/all-tests.md`).

## Acceptance Criteria

| ID | Criterion |
|---|---|
| A1 | `adminUsersRepository.list()` and `adminContactRepository.list()` accept `limit`/`offset`, default 100, cap 100, and return `{items,total}` |
| A2 | `admin-users` `q` filter uses Supabase `.or(...ilike...)`; no post-fetch JS filtering remains |
| A3 | Zod list-query schemas + route handlers accept and pass `limit`/`offset` |
| A4 | Users and Contact panels page through results using the existing `AdminListPagination` |
| A5 | Upload route rejects a file whose magic bytes are not an allowed image type, even with a spoofed image `Content-Type` |
| A6 | `adminCouponInputSchema` rejects `{discountType:"PERCENTAGE", discount:101}` and accepts `{discountType:"FIXED", discount:50000}` |
| A7 | Six `*.service.test.ts` files exist and cover query-string building + error passthrough |
| A8 | `npx tsc --noEmit` clean; `npm test` green |
