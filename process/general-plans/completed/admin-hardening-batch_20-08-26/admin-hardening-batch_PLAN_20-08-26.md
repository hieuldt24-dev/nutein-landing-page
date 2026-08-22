---
name: plan:admin-hardening-batch
description: "COMPLEX plan — 4 admin-backoffice hardening items: list pagination (H1), upload magic-byte sniffing (H3), coupon percentage cap (M2), service-layer contract tests (H2)"
date: 20-08-26
feature: general-plans
---

# PLAN — Admin Backoffice Hardening Batch (COMPLEX)

Date: 20-08-26
Status: **VERIFIED (EVL-confirmed 20-08-26)** — all 33 checklist items done (32 automated + 1 agent-probe deferred, accepted as known-gap); independent vc-tester EVL re-run confirmed 5/6 gate commands green, 1 (`npm run lint`) fails only on pre-existing repo-wide debt unrelated to this batch's files. Archived to `process/general-plans/completed/`.
Complexity: **COMPLEX** (4 independent slices, 20+ files, one public contract change, one new dependency)

TL;DR: Four independent slices. Sections A/B are the risky ones (they change a public return shape and add a dependency); C is a two-line schema change with a cross-plan re-read guard; D is pure test addition.

## Overview and Context

The completed admin-backoffice security review (`process/general-plans/completed/full-codebase-review_19-08-26/admin-backoffice-review_REPORT_19-08-26.md`) left four hardening items unaddressed: the remainder of H1 (unbounded `list()` queries in `admin-users`/`admin-contact`), H3 (upload endpoint trusts the client-supplied MIME type), M2's validation slice (no upper bound on percentage coupon discounts), and the remainder of H2 (no tests on any `admin-*.service.ts` client wrapper). This plan implements all four. Requirements are locked in the sibling `admin-hardening-batch_SPEC_20-08-26.md`. Coupon redemption/checkout enforcement is owned by a concurrent track and is explicitly out of scope.

## Acceptance Criteria

| ID | Criterion | Proven by |
|---|---|---|
| A1 | `adminUsersRepository.list()` / `adminContactRepository.list()` take `limit`/`offset`, default 100, cap 100, return `{items,total}` | repository tests + `tsc` |
| A2 | `admin-users` `q` search uses DB `ilike`, no post-fetch JS filter | repository test asserting `.or()` called |
| A3 | List-query Zod schemas + route handlers accept and pass `limit`/`offset` | service tests + `tsc` |
| A4 | Users and Contact panels paginate via the existing `AdminListPagination` | agent probe |
| A5 | Upload route rejects files whose magic bytes are not an allowed image type | `lib/sniff-image-type.test.ts` + agent probe |
| A6 | `PERCENTAGE` coupons with `discount > 100` are rejected; `FIXED` unaffected | `admin-coupons.schema.test.ts` |
| A7 | Six `*.service.test.ts` files cover query-string building + error passthrough | `npx vitest run` |
| A8 | `npx tsc --noEmit` clean; `npm test` green vs pre-edit baseline | gate commands |

## Phase Completion Rules

- A section is `CODE DONE` when its checklist items are applied and `npx tsc --noEmit` is clean.
- A section is `VERIFIED` only when its rows in Verification Evidence pass — code-only completion is never `VERIFIED`.
- Sections A–E are independent and may be completed in any order, except steps 7 and 14 (both edit `admin-dashboard.service.ts`) which must not run concurrently.
- The whole plan is complete only when Section F (steps 29–33) passes, including the `npm test` baseline comparison.
- Any deviation from the checklist (notably the step 15 dependency fallback or a step 19 no-op) must be recorded in the phase report before closeout.

## Decision Summary

### Chosen Approach
**Mirror `admin-audit` exactly for pagination + `file-type` for sniffing + local schema refine + one test file per service.** Consistency with the one repository that already got pagination right beats inventing a second shape.

### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| Add `limit`/`offset` but keep returning a plain array (no `total`) | UI cannot render "page X of Y" or disable Next; `AdminListPagination` requires `total`. Would need a second round-trip later. |
| Hand-rolled ~25-line magic-byte sniffer instead of `file-type` | Viable and dependency-free, but the review explicitly sanctioned the dep and `file-type` covers container-format edge cases (WebP/AVIF ISO-BMFF) correctly. Kept as documented fallback if ESM/bundling fails. |
| Add `.max(100)` unconditionally to `discount` | Would break `FIXED` coupons (a 50 000 VND discount is legitimate). Must be a `superRefine`/conditional check. |
| Test only `admin-orders.service.ts` (the literally-named H2 finding) | The review itself says it is the domain norm, not an outlier — fixing one file leaves the pattern unfixed. |

### Risk Predictions (vc-predict, 5 personas)
- **Architect:** changing `list()` to `{items,total}` is a public-contract change with 6 call sites, two of which are dashboard aggregations that call `.length`/`.filter` on the result. Missing one = runtime `undefined.filter` crash. Mitigation: enumerated call-site table in Section A.
- **Security:** `file.type` is still used to build the base64 data URI sent to Cloudinary. After sniffing, the *sniffed* mime must be used for the data URI, otherwise a spoofed header still propagates downstream. Mitigation: A5 test + explicit step A/B-4.
- **Performance:** the two panels currently fire a *second* unbounded "counts" fetch for filter chips. Paginating the main list without fixing that leaves the full-table scan in place — the finding would be only half-fixed. Mitigation: counts fetches switch to `limit: 1` + read `total`.
- **Tester:** `file-type@22` is pure ESM; Vitest/jsdom or `tsc` may choke. Mitigation: install-then-verify gate before writing route code; documented fallback.
- **Maintainer:** the coupon schema is co-owned this session. Mitigation: mandatory re-read immediately before edit; append-only `superRefine` so a merge with the other track is additive, not conflicting.

### Key Constraints Accepted
- `list()` return shape changes for two features (documented under Public Contracts).
- One new runtime dependency (`file-type`), with a named fallback.
- Coupon slice is validation-only; no redemption logic.

## Touchpoints

| Slice | Files |
|---|---|
| A — users pagination | `features/admin-users/types/index.ts`, `features/admin-users/schemas/admin-users.schema.ts`, `features/admin-users/services/admin-users.repository.ts`, `features/admin-users/services/admin-users.repository.test.ts` (existing — mock builder needs `.range()`; assertions need `{items,total}` shape), `features/admin-users/services/admin-users.service.ts`, `app/api/admin/users/route.ts`, `components/admin/users/AdminUsersPanel.tsx`, `features/admin-dashboard/services/admin-dashboard.service.ts` |
| B — contact pagination | `features/admin-contact/types/index.ts`, `features/admin-contact/schemas/admin-contact.schema.ts`, `features/admin-contact/services/admin-contact.repository.ts`, `features/admin-contact/services/admin-contact.repository.test.ts` (existing — mock builder needs `.range()`; assertions need `{items,total}` shape), `features/admin-contact/services/admin-contact.service.ts`, `app/api/staff/contact/route.ts`, `components/admin/contact/AdminContactList.tsx`, `features/admin-dashboard/services/admin-dashboard.service.ts` |
| C — upload sniffing | `package.json`, `lib/sniff-image-type.ts` (new), `lib/sniff-image-type.test.ts` (new), `app/api/staff/uploads/route.ts` |
| D — coupon cap | `features/admin-coupons/schemas/admin-coupons.schema.ts`, `features/admin-coupons/schemas/admin-coupons.schema.test.ts` (new) |
| E — service tests | 6 new files: `features/admin-{users,contact,audit,coupons,products,orders}/services/admin-*.service.test.ts` |
| — read-only refs | `features/admin-audit/services/admin-audit.repository.ts`, `features/admin-orders/services/admin-orders.repository.test.ts`, `components/admin/orders/AdminOrdersList.tsx`, `components/admin/ui/AdminListPagination.tsx`, `lib/admin-list-query.ts` |

**Added 20-08-26 (real fan-out re-validate):** the two `*.repository.test.ts` rows above were missing from the original Touchpoints/Blast Radius. Direct file reads confirmed both files exist today, assert the current plain-array return shape, and their hand-rolled mock query builders do not implement `.range()`. Once Section A/B repositories start calling `.range()` (per steps 3/10), both existing test files will throw `TypeError: builder.range is not a function` unless updated — see new steps 3b/10b below.

## Public Contracts

| Contract | Before | After | Consumers to update |
|---|---|---|---|
| `adminUsersRepository.list()` / `adminUsersService.list()` | `Promise<AdminManagedUser[]>` | `Promise<AdminManagedUserListResult>` = `{items, total}` | `AdminUsersPanel.tsx` (2 call sites), `admin-dashboard.service.ts:74`, `admin-users.repository.test.ts` (4 existing assertions) |
| `adminContactRepository.list()` / `adminContactService.list()` | `(filter) => Promise<AdminContactMessage[]>` | `(query: {filter?, limit?, offset?}) => Promise<{items,total}>` | `AdminContactList.tsx` (2 call sites), `admin-dashboard.service.ts:53`, `admin-contact.repository.test.ts` (3 existing assertions) |
| `GET /api/admin/users` | returns array | returns `{items,total}`; accepts `limit`,`offset` | internal only (no external clients) |
| `GET /api/staff/contact` | returns array | returns `{items,total}`; accepts `limit`,`offset` | internal only |
| `POST /api/staff/uploads` | 400 only on header mismatch | additionally 400 on magic-byte mismatch | internal callers unaffected on happy path |
| `adminCouponInputSchema` | `discount >= 0` | plus: `PERCENTAGE` ⇒ `discount <= 100` | `POST/PATCH /api/staff/coupons` |

Call-site enumeration was re-verified 20-08-26 by direct grep across `*.ts`/`*.tsx` (not just re-read from the plan text): no production call site is missed. The only omission found was the two repository test files, now added above.

## Blast Radius

- **Files changed:** 15 modified, 9 created (24 total). *(Was 13/9/22 — revised 20-08-26 to include the two existing repository test files that must be updated, not just the code they test.)*
- **Packages:** single Next.js app — `features/`, `app/api/`, `components/admin/`, `lib/`.
- **Risk class:** MEDIUM-HIGH. Touches a public API response shape (2 endpoints), an upload/trust-boundary surface, and adds a runtime dependency. No schema migration, no auth logic, no billing/redemption logic.
- **Concurrency hazard:** `features/admin-coupons/schemas/admin-coupons.schema.ts` is shared with a concurrent coupon-checkout track.

## Architecture Note (data flow, Section A/B)

1. Panel component holds `page` state → calls service with `{limit: ADMIN_LIST_PAGE_SIZE, offset: page*size}`.
2. Service builds query string → `apiRequest` → route handler.
3. Route Zod-parses `limit`/`offset` (coerced numbers, clamped) → repository.
4. Repository applies filters, then `.order(created_at desc).range(offset, offset+limit-1)` with `count: "exact"`.
5. Returns `{items, total}`; `total` is the **filtered** count (Supabase `count:"exact"` respects `eq`/`ilike`/`is` filters applied before `range`), which is exactly what the pagination component needs.
6. Filter-chip counts become separate `limit: 1` calls reading only `total` — no rows transferred.

Cross-slice failure modes considered: a stale SWR key after a role/lock mutation showing a page beyond `total` (mitigated by resetting `page` to 0 on any filter/search change, same as `AdminOrdersList`); `offset` beyond `total` returns an empty page rather than an error (acceptable, matches audit behavior).

---

## IMPLEMENTATION CHECKLIST

### Section A — admin-users pagination + DB-side search

1. `features/admin-users/types/index.ts`: add
   ```ts
   export interface AdminUsersListQuery { q?: string; role?: AuthRole | "all"; limit?: number; offset?: number }
   export interface AdminManagedUserListResult { items: AdminManagedUser[]; total: number }
   ```
2. `features/admin-users/schemas/admin-users.schema.ts`: extend `adminUsersListQuerySchema` with
   `limit: z.coerce.number().int().min(1).max(100).optional()` and `offset: z.coerce.number().int().min(0).optional()`.
3. `features/admin-users/services/admin-users.repository.ts` `list()`:
   - accept `AdminUsersListQuery`, return `AdminManagedUserListResult`;
   - `select(USER_SELECT, { count: "exact" })`;
   - keep the `role` `.eq()` filter;
   - replace the post-fetch JS `q` filter with `builder = builder.or(\`email.ilike.%${q}%,name.ilike.%${q}%\`)` — escape/strip `,` `%` `(` `)` from `q` first (PostgREST `or()` is comma/paren-delimited; unescaped input corrupts the filter);
   - `const pageSize = query.limit ?? 100; const offset = query.offset ?? 0;`
   - `.order("created_at", {ascending:false}).range(offset, offset + pageSize - 1)`;
   - return `{ items: rows.map(toAdminManagedUser), total: count ?? items.length }`.

   **3b. (added 20-08-26) Update `features/admin-users/services/admin-users.repository.test.ts` in the same edit as step 3** — do not leave it for Section F to discover as a failure:
   - In `makeBuilder()`, add `range: vi.fn(() => builder)` alongside the existing `select/eq/order/update/maybeSingle` stubs.
   - Update `makeBuilder({ data, error })` call sites in the four `describe("adminUsersRepository.list", ...)` tests to also pass a `count` field (e.g. `{ data: [userRow], error: null, count: 1 }`) since the repository now destructures `count` from the awaited builder result.
   - Update every assertion currently reading `result[0]` / `result.toHaveLength(...)` to read `result.items[0]` / `result.items` instead (4 call sites: lines ~49, ~66, ~88-89 of the current file).
   - Add one new assertion that `builder.range` was called with the expected default `(0, 99)` when no `limit`/`offset` is passed, matching A1's "default 100" criterion.
4. `app/api/admin/users/route.ts`: parse `limit`/`offset` from `searchParams` into the schema, pass the whole parsed query to the repository, return `successResponse(result)`.
5. `features/admin-users/services/admin-users.service.ts`: `buildQueryString` adds `limit`/`offset` (`!= null` guard, mirroring `admin-audit.service.ts`); `list()` return type → `AdminManagedUserListResult`.
6. `components/admin/users/AdminUsersPanel.tsx`:
   - add `const [page, setPage] = useState(0)`; include `page` in the SWR key;
   - pass `limit: ADMIN_LIST_PAGE_SIZE, offset: page * ADMIN_LIST_PAGE_SIZE`;
   - `const items = data?.items ?? []; const total = data?.total ?? 0;` and replace every `data.length` / `data.map` with `items`;
   - reset `setPage(0)` in the `q` `onChange` and each role chip `onClick`;
   - replace the unbounded counts SWR with three `limit: 1` count calls (`role: "all" | "staff" | "admin"`) reading `.total`; the `user` chip renders no count today, so no fourth call;
   - render `<AdminListPagination page={page} pageSize={ADMIN_LIST_PAGE_SIZE} total={total} onPageChange={setPage} />` below the list, matching `AdminOrdersList`.
7. `features/admin-dashboard/services/admin-dashboard.service.ts` `getAdminHome()`: `adminUsersService.list({})` → destructure; use `users.items` for `newLast7Days`/role counts and `users.total` for `total`. Prefer `list({ limit: 100 })` and add a code comment that `newLast7Days`/role counts are now page-scoped — a follow-up backlog item, not this batch's job.

### Section B — admin-contact pagination

8. `features/admin-contact/types/index.ts`: add
   `export interface AdminContactListQuery { filter?: AdminContactFilter; limit?: number; offset?: number }` and
   `export interface AdminContactListResult { items: AdminContactMessage[]; total: number }`.
9. `features/admin-contact/schemas/admin-contact.schema.ts`: add `adminContactListQuerySchema = z.object({ filter: z.enum([...]).optional(), limit: ..., offset: ... })`; **keep** the existing `adminContactFilterSchema` export. *(Corrected 20-08-26: re-grepped — `adminContactFilterSchema` is NOT actually consumed by `[id]` siblings; `app/api/staff/contact/[id]/route.ts` only imports `adminContactUpdateSchema`. The only current consumer is `app/api/staff/contact/route.ts` itself, which step 11 is already rewriting. Keeping the export costs nothing and avoids any risk if something else references it later — still verify with grep before removing, but the original "used by `[id]` siblings" rationale was incorrect.)*
10. `features/admin-contact/services/admin-contact.repository.ts` `list()`: accept `AdminContactListQuery` (default `{}`, `filter` defaults to `"all"`), `count: "exact"`, same default-100/`.range()` pattern, return `{items,total}`.

    **10b. (added 20-08-26) Update `features/admin-contact/services/admin-contact.repository.test.ts` in the same edit as step 10:**
    - In `makeBuilder()`, add `range: vi.fn(() => builder)` alongside `select/eq/is/not/order/update/single/maybeSingle`.
    - Update the three `describe("adminContactRepository.list", ...)` test bodies to pass `count` in the mocked result and to read `result.items[...]` instead of `result[...]` / `result[0]`.
11. `app/api/staff/contact/route.ts`: parse `filter`/`limit`/`offset` via the new schema; return `successResponse(result)`.
12. `features/admin-contact/services/admin-contact.service.ts`: `list(query: AdminContactListQuery = {})` builds the query string via `URLSearchParams` (replacing the hardcoded `?filter=${filter}`) and returns `AdminContactListResult`.
13. `components/admin/contact/AdminContactList.tsx`: same treatment as step 6 — `page` state, `items`/`total`, `setPage(0)` on filter change, `AdminListPagination`, and replace the `allMessages` full fetch with three `limit: 1` count calls (`all`, `unread`, `open`) reading `.total` (the `handled` chip renders no count).
14. `features/admin-dashboard/services/admin-dashboard.service.ts` `getStaffOps()`: `adminContactService.list("unread")` → `adminContactService.list({ filter: "unread", limit: 100 })`, then pass `.items` as `unreadContacts`.

### Section C — upload magic-byte sniffing

15. **Compatibility gate first:** `npm install file-type` then immediately run `npx tsc --noEmit`. `file-type@22` is pure ESM and requires Node ≥22 (confirmed via `npm view file-type engines` → `{"node":">=22"}`; local is 22.22.0, OK). If `tsc` or the Next build rejects it, STOP and use the documented fallback: implement the same `sniffImageType()` contract with a hand-written magic-byte table (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `47 49 46 38`, WebP `RIFF....WEBP`, AVIF `....ftypavif`) and skip the dependency. Record which path was taken in the phase report.
16. Create `lib/sniff-image-type.ts` (no `server-only` import — must stay unit-testable under jsdom):
    ```ts
    export const ALLOWED_IMAGE_MIMES = ["image/jpeg","image/png","image/gif","image/webp","image/avif"] as const;
    export async function sniffImageType(buffer: Buffer): Promise<string | null>
    ```
    returns the detected mime if it is in the allowlist, else `null`.
17. `app/api/staff/uploads/route.ts`:
    - keep the existing cheap `file.type.startsWith("image/")` and size checks as a fast pre-filter;
    - after `const buffer = Buffer.from(await file.arrayBuffer())`, `const mime = await sniffImageType(buffer)`;
    - `if (!mime) throw new BadRequestError("Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP, AVIF).")`;
    - build the data URI from the **sniffed** `mime`, not `file.type`. *(Verified 20-08-26: the current route at line 43 builds the data URI from `file.type` — this is the exact spoofable header the sniffing is meant to close. Step 17's instruction to switch the data-URI source to the sniffed mime is load-bearing — without it, a spoofed `Content-Type` still reaches Cloudinary even after the magic-byte check rejects genuinely-bad files that don't also spoof a passing `file.type`. E3 below already flags this; treat it as a hard requirement, not a nice-to-have.)*
18. Create `lib/sniff-image-type.test.ts`: PNG/JPEG/GIF/WebP header fixtures → correct mime; a PDF header (`%PDF-`) and a plain-text buffer → `null`; empty buffer → `null`.

### Section D — coupon percentage cap (cross-plan guarded)

19. **Re-read `features/admin-coupons/schemas/admin-coupons.schema.ts` immediately before editing.** If a `PERCENTAGE`/`max(100)` guard already exists (landed by the concurrent coupon-checkout track), mark this step "already applied — no-op" in the phase report and skip to step 21. Do not modify any redemption/checkout code the other track may have added. *(Confirmed 20-08-26: as of this re-validate, `adminCouponInputSchema` is still a plain `z.object({...})` with no `superRefine`/percentage cap — no-op condition does not currently apply.)*
20. Append a `.superRefine()` to `adminCouponInputSchema` (append-only, so it merges cleanly). **Concrete structure (added 20-08-26 — the original prose was directionally correct but underspecified and risked an execute-time `.partial()`-on-`ZodEffects` error):**
    ```ts
    const adminCouponBaseSchema = z.object({
      code: z.string().trim().min(1, "Mã coupon bắt buộc.").transform((v) => v.toUpperCase()),
      discountType: z.enum(["FIXED", "PERCENTAGE"]),
      discount: z.number().min(0, "Giá trị giảm không hợp lệ."),
      minOrderValue: z.number().min(0).nullable(),
      usageLimit: z.number().int().min(1).nullable(),
      usedCount: z.number().int().min(0).optional(),
      isActive: z.boolean(),
      expiresAt: z.string().trim().min(1).nullable(),
    });

    function percentageCapRefine(v: { discountType?: "FIXED" | "PERCENTAGE"; discount?: number }, ctx: z.RefinementCtx) {
      if (v.discountType === "PERCENTAGE" && typeof v.discount === "number" && v.discount > 100) {
        ctx.addIssue({ code: "custom", path: ["discount"], message: "Giảm theo % không vượt quá 100." });
      }
    }

    export const adminCouponInputSchema = adminCouponBaseSchema.superRefine(percentageCapRefine);
    export const adminCouponUpdateSchema = adminCouponBaseSchema.partial().superRefine(percentageCapRefine);
    ```
    Rationale: `.partial()` is only available on the plain `ZodObject` (`adminCouponBaseSchema`), not on the `ZodEffects` wrapper that `.superRefine()` produces. Building `adminCouponUpdateSchema` from `adminCouponBaseSchema.partial()` (not from `adminCouponInputSchema`) keeps `.partial()` legal and still applies the same cap logic — `percentageCapRefine` is written to no-op when either field is `undefined` (partial update), matching the plan's original "only fires when both fields are present" intent. Verify with `tsc` after this edit; also verify `AdminCouponInputPayload`/`AdminCouponUpdatePayload` type exports (currently `z.infer<typeof ...>`) still resolve correctly against the new const shapes.
21. Create `features/admin-coupons/schemas/admin-coupons.schema.test.ts`: rejects `{PERCENTAGE, 101}`; accepts `{PERCENTAGE, 100}`, `{PERCENTAGE, 0}`, `{FIXED, 500000}`; update-schema partial with only `discount: 101` and no `discountType` still parses (cannot be evaluated).

### Section E — service-layer contract tests (6 files)

22. Create a shared-shape test per service using this recipe (no new helper module — keep each file self-contained, matching repo convention):
    - `// @vitest-environment node` is **not** needed (services have no `server-only` import) — leave the jsdom default;
    - `vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }))` with `vi.hoisted`;
    - `beforeEach(() => { mocks.apiRequest.mockReset() })`.
23. `features/admin-audit/services/admin-audit.service.test.ts` — asserts the URL for: empty query (`/api/admin/audit`, no `?`), `action:"all"` omitted, `limit`/`offset` present, `from`/`to` present; error passthrough (mock rejects → `list()` rejects with the same error).
24. `features/admin-users/services/admin-users.service.test.ts` — URL for `{q,role}`, `role:"all"` omitted, `limit`/`offset` present; `setRole`/`setLocked` assert method `PATCH` and JSON body; error passthrough.
25. `features/admin-contact/services/admin-contact.service.test.ts` — URL for default/`unread`/`limit`+`offset`; `markRead`/`markHandled`/`setNote` delegate to `patch` with the right body (`setNote` trims); error passthrough.
26. `features/admin-orders/services/admin-orders.service.test.ts` — `buildListQueryString` coverage (status `all` omitted, `q` trimmed, blank `q` omitted, `limit`/`offset`); `getById` returns `null` on a `FetchError` with `status: 404` and rethrows on 500; `updateStatus` body shape; `listSummary` hits `/api/admin/orders-summary`.
27. `features/admin-products/services/admin-products.service.test.ts` — `getProduct`/`updateProduct` URL+body; `uploadImage` sends a `FormData` with the `file` field to `/api/staff/uploads` and returns `url`; error passthrough.
28. `features/admin-coupons/services/admin-coupons.service.test.ts` — `list`/`getById`/`create`/`update` URL+method+body; `setActive` delegates to `update` with `{isActive}`; error passthrough.

### Section F — gates

29. `npx tsc --noEmit` → clean.
30. `npx vitest run features/admin-users features/admin-contact features/admin-coupons features/admin-orders features/admin-products features/admin-audit lib/sniff-image-type.test.ts` → green (now includes the updated `admin-users.repository.test.ts` / `admin-contact.repository.test.ts` from steps 3b/10b).
31. `npm test` → green except the pre-existing `lib/useAddresses.test.tsx` failure (documented harness drift — must not be "fixed" here; confirm it is the *only* pre-existing failure by comparing against a baseline run taken before any edit).
32. `npm run lint` → zero warnings.
33. Manual probe: `/admin/users` and `/staff/contact` paginate, search works, chip counts still correct.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `npx vitest run features/admin-users/services/admin-users.service.test.ts` — `limit`/`offset` appear in URL | Fully-Automated | A3, A7 |
| `npx vitest run features/admin-contact/services/admin-contact.service.test.ts` | Fully-Automated | A3, A7 |
| `npx vitest run features/admin-users/services/admin-users.repository.test.ts` — mock builder `.range()` called with correct bounds, `result.items`/`.total` shape | Fully-Automated | A1 (added 20-08-26) |
| `npx vitest run features/admin-contact/services/admin-contact.repository.test.ts` — same | Fully-Automated | A1 (added 20-08-26) |
| `npx vitest run lib/sniff-image-type.test.ts` — PDF/text buffers → `null` | Fully-Automated | A5 |
| `npx vitest run features/admin-coupons/schemas/admin-coupons.schema.test.ts` | Fully-Automated | A6 |
| `npx vitest run features/admin-{orders,products,audit}/services/*.service.test.ts` | Fully-Automated | A7 |
| `npx tsc --noEmit` | Fully-Automated | A8 + call-site migration completeness (A1/A2 return-shape change) |
| `npm test` full suite vs pre-edit baseline | Fully-Automated | A8 (no regression) |
| Repository `.range()`/`.ilike()` assertions via the existing chainable-builder mock in the repository tests | Fully-Automated | A1, A2 |
| Upload a real `.pdf` renamed to `.png` with a spoofed `Content-Type` against a running dev server | Agent-Probe | A5 end-to-end (no HTTP-layer test infra exists) |
| Load `/admin/users` and `/staff/contact`, page through, verify chip counts | Agent-Probe | A4 |

### Failing stubs (red-first, for EXECUTE)

```
test("should build users list URL with limit and offset", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: limit/offset appear in URL")
})
test("should return null for a non-image buffer", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: PDF/text buffers → null")
})
test("should reject PERCENTAGE discount above 100", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: PERCENTAGE > 100 rejected")
})
test("should call builder.range(0, 99) as the default page window", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub for: admin-users repository default pagination bounds")
})
```

### Known gaps (accepted)

| Gap | Why | Resolution |
|---|---|---|
| ~~No HTTP-level test for `POST /api/staff/uploads`~~ **CORRECTED post-EXECUTE (20-08-26):** this claim was factually wrong. `app/api/staff/uploads/route.test.ts` already existed pre-plan and was extended during EXECUTE with 2 new tests proving the sniffed-mime-not-file.type behavior at the HTTP layer (PDF spoofed as image/png → 400, Cloudinary never called; data URI carries sniffed mime). Gap is closed. See `admin-hardening-batch_REPORT_20-08-26.md` §Plan Deviations #2. | — (superseded) | Closed during EXECUTE, not deferred |
| `getAdminHome()` user role counts become page-scoped (first 100) after A1 | Correct fix is a SQL aggregate, which is outside this batch | Code comment + backlog note |
| `admin-blog` / `admin-coupons` / `orders.listSummary()` pagination | Explicitly out of scope | Remains open H1 remainder |

## Test Infra Improvement Notes

(none identified yet — populate during EXECUTE/EVL. Candidate already visible: `vitest.config.ts` `test.env` is missing `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, causing the known `lib/useAddresses.test.tsx` failure — tracked in `process/general-plans/backlog/infra-followups-19-08-26.md`, not fixed here.)

## Resume and Execution Handoff

1. **Selected plan file:** `process/general-plans/active/admin-hardening-batch_20-08-26/admin-hardening-batch_PLAN_20-08-26.md`
2. **Last completed phase:** VALIDATE (contract written, real two-layer fan-out — see below); awaiting `ENTER EXECUTE MODE`
3. **Validate-contract status:** written (see below)
4. **Supporting context loaded:** `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/uxui/all-uxui.md`, `process/general-plans/completed/full-codebase-review_19-08-26/admin-backoffice-review_REPORT_19-08-26.md`, sibling SPEC file
5. **Next step for a fresh agent:** take a `npm test` baseline first, then execute Sections in order E→D→C→A→B if you want lowest-risk-first, or A→B→C→D→E as written. Sections are independent; only Sections A and B share `admin-dashboard.service.ts` (steps 7 and 14 — do not run those two in parallel). Steps 3b/10b are part of Sections A/B respectively — do not defer them to Section F.

## Validate Contract

**Gate: CONDITIONAL** (0 FAILs, 6 CONCERNs, all mitigated in-plan by this pass's supplement)

- `generated-by: outer-pvl`
- `date: 2026-08-20`
- Date: 20-08-26
- Plan: `process/general-plans/active/admin-hardening-batch_20-08-26/admin-hardening-batch_PLAN_20-08-26.md`
- Mode: **real two-layer fan-out** — direct file reads, grep-verified call-site enumeration, and live dependency-registry checks (`npm view file-type engines`, `node --version`) performed per dimension/section, not an inline single-agent simulation. Supersedes the prior fast-mode inline-simulation contract.
- `supersedes: 2026-08-20 (outer-pvl) — real fan-out re-validate replaces the fast-mode inline-simulation contract per explicit user request`

### Layer 1 dimensions

| Dimension | Status | Findings |
|---|---|---|
| Infra fit | PASS | Verified by direct read: `AdminListPagination.tsx` props (`page, pageSize, total, onPageChange`) match every planned usage exactly. `admin-audit.repository.ts` read in full — confirms the `select(..., {count:"exact"}).order().range()` → `{items, total: count ?? items.length}` pattern the plan mirrors is real and already working. |
| Test coverage | CONCERN | **New finding:** `admin-users.repository.test.ts` and `admin-contact.repository.test.ts` already exist, assert the pre-change plain-array shape, and their mock query builders lack `.range()` — confirmed by direct read. Without an update they throw `TypeError`, not just fail assertions. Mitigated: added as Touchpoints + new checklist steps 3b/10b in this pass. Residual: no HTTP-level test for the upload route (unchanged known gap, no test infra exists for it). |
| Breaking changes | CONCERN | Grep-verified full call-site enumeration for `adminUsersService.list`/`adminUsersRepository.list` and `adminContactService.list`/`adminContactRepository.list` across the whole repo (not just `*.tsx`/`*.ts` mentioned in the plan text). Production call sites (`AdminUsersPanel.tsx` x2, `AdminContactList.tsx` x2, `admin-dashboard.service.ts:53/74`, both route.ts files) are all correctly covered by the existing checklist — confirmed by reading `admin-dashboard.service.ts` directly (lines 51-101 match the plan's step 7/14 description exactly, including the `.filter`/`.length` calls the Architect persona flagged). The only missed consumers were the two repository test files — now added to scope. |
| Security surface | CONCERN | Confirmed by reading the live `app/api/staff/uploads/route.ts`: line 43 currently builds the Cloudinary data URI from `file.type` (the spoofable client header) — the gap is real, not hypothetical. Step 17 correctly redirects the data-URI source to the sniffed mime, which closes the gap end-to-end (not just the initial reject check). Second: unescaped `q` in PostgREST `.or()` can corrupt the filter expression — mitigated in step 3 (unchanged from prior pass, confirmed still present in current `admin-users.repository.ts` post-fetch filter code at lines 65-70). |

### Layer 2 sections

| Section | Status | Highest-risk edit + mitigation |
|---|---|---|
| A — users pagination | CONCERN | `admin-dashboard.getAdminHome()` silently degrades to page-scoped counts → documented as accepted known gap with a code comment (unchanged). **Elevated from prior pass:** the existing `admin-users.repository.test.ts` (read in full, 145 lines) has 4 assertions against the old shape and no `.range()` stub — real breakage risk, now mitigated via step 3b. |
| B — contact pagination | CONCERN (was PASS in the prior inline pass — corrected here) | Same repository-test-breakage risk applies to `admin-contact.repository.test.ts` (read in full, 108 lines) — mitigated via step 10b. Also corrected a factual error in step 9's rationale: `adminContactFilterSchema` is not actually used by `[id]` route siblings (verified via grep — only `app/api/staff/contact/route.ts` imports it, and that file is already being rewritten in step 11); the "keep it" guidance is still sound as a low-cost precaution, just not for the reason originally stated. |
| C — upload sniffing | PASS | Live-verified: `npm view file-type engines` → `{"node":">=22"}`; local `node --version` → `v22.22.0` — compatible, confirming the plan's claim with real registry data rather than trusting the prose. Data-URI fix (step 17) verified to close the trust-boundary gap end-to-end against the actual current route code. |
| D — coupon cap | CONCERN (was PASS in the prior inline pass — corrected here) | Read `admin-coupons.schema.ts` directly: confirmed `adminCouponInputSchema` is currently a plain `ZodObject` and `adminCouponUpdateSchema = adminCouponInputSchema.partial()` — the `.partial()`-on-`ZodEffects` trap the plan's prose warned about is real. The original step 20 correctly identified the trap in words but did not give an executable structure, risking an execute-time detour. Mitigated: step 20 rewritten with a concrete `adminCouponBaseSchema` + shared `percentageCapRefine` structure that keeps `.partial()` legal on both schemas. |
| E — service tests | PASS | Grep confirmed zero existing tests reference `adminUsersService.list`/`adminContactService.list`/`admin-dashboard.service.ts` directly — the 6 new test files in Section E do not collide with any existing test. Mock boundary (`@/lib/api-client`) pattern confirmed consistent with `admin-contact.service.ts`'s actual current implementation (read in full). |

**Totals: 0 FAILs / 6 CONCERNs / 3 PASSes → Net Gate: CONDITIONAL**

### Execute-agent instructions

| # | Instruction | Trigger |
|---|---|---|
| E1 | Run `npm test` and record the failing-file list BEFORE any edit. Only `lib/useAddresses.test.tsx` may be failing. | Before step 1 |
| E2 | Re-read `admin-coupons.schema.ts` immediately before editing; if the cap already exists, no-op and report it. Never touch redemption/checkout code. | Section D entry |
| E3 | Build the Cloudinary data URI from the sniffed mime, never `file.type`. Confirmed live at 20-08-26 that current code still uses `file.type` at line 43 — this is the exact gap being closed. | Step 17 |
| E4 | If `npm install file-type` + `npx tsc --noEmit` fails, use the hand-written magic-byte fallback and record the deviation. Do not spend cycles fighting ESM interop. | Step 15 |
| E5 | Sanitize `q` (strip `,` `%` `(` `)`) before interpolating into PostgREST `.or()`. | Step 3 |
| E6 | Update every call site in the Public Contracts table; `tsc --noEmit` must be clean before moving to the next section. Includes the two repository test files (steps 3b/10b) — do not defer to Section F. | Sections A, B |
| E7 | Do not expand into `admin-blog`/`admin-coupons`/`listSummary()` pagination or any coupon redemption logic. | Throughout |
| E8 (added 20-08-26) | When building `adminCouponUpdateSchema`, derive it from `adminCouponBaseSchema.partial()`, never from `adminCouponInputSchema.partial()` — the latter will throw a type/runtime error once `adminCouponInputSchema` is wrapped in `.superRefine()`. | Step 20 |

### Test gates

```
npx tsc --noEmit
npx vitest run lib/sniff-image-type.test.ts
npx vitest run features/admin-coupons/schemas/admin-coupons.schema.test.ts
npx vitest run features/admin-users features/admin-contact features/admin-orders features/admin-products features/admin-audit features/admin-coupons
npm test
npm run lint
```

What this coverage does NOT prove:
- `npx vitest run features/admin-users features/admin-contact ...` proves the repository/service layer builds correct query params and returns the correct shape against a MOCKED Supabase client — it does NOT prove the real PostgREST `.or()`/`.range()` calls behave identically against a live Supabase instance (no integration/e2e tier exists for this).
- `npx tsc --noEmit` proves call-site type compatibility — it does NOT prove runtime behavior (e.g., a call site that happens to type-check with `.items` but reads the wrong field silently would not be caught).
- ~~The upload route's magic-byte rejection has no automated HTTP-level gate~~ **CORRECTED post-EXECUTE (20-08-26):** `app/api/staff/uploads/route.test.ts` now provides an automated HTTP-layer gate proving the sniffed-mime is used (not `file.type`) and that a spoofed file is rejected before reaching Cloudinary. A revert of step 17 would now be caught by `npx vitest run app/api/staff/uploads/route.test.ts`. See report §Plan Deviations #2.
- `npm test`/`npm run lint` prove no regression against the pre-edit baseline and zero lint warnings — they do not prove the manual probe scenario (step 33: pagination UX, chip counts) works correctly in a real browser.

### Open gaps (accepted, on record)

1. No automated end-to-end proof for the upload rejection path (no route-test infra) — agent probe only.
2. `getAdminHome()` role counts become page-scoped — backlog follow-up.
3. Rest of H1 (`admin-blog`, `admin-coupons`, `orders.listSummary()`) remains open.
4. ~~(added 20-08-26) No HTTP-level regression gate for the Cloudinary data-URI-source fix (E3)~~ **CLOSED during EXECUTE (20-08-26):** `app/api/staff/uploads/route.test.ts` now asserts this directly (see report §Plan Deviations #2). No longer an open gap.

### Known limitation

None — this pass replaces the prior single-agent inline simulation with a real fan-out: every Layer 1/Layer 2 claim above was checked against the live repository state (file reads, grep, `npm view`, `node --version`) rather than reasoned about from the plan text alone. One genuine gap was found and fixed in-plan (repository test breakage, steps 3b/10b); two Layer 2 verdicts were corrected from PASS to CONDITIONAL (Sections B and D) based on evidence this pass gathered that the prior pass did not surface.

**Accepted by:** pending — this CONDITIONAL gate requires explicit user acceptance of the 6 documented CONCERNs (all mitigated in-plan, 0 unresolved FAILs) before `ENTER EXECUTE MODE`. Say "Accept" (or "Accept with concerns: [list]") to record acceptance, or "Re-validate" / "Return to PLAN" to request further changes.

## Autonomous Goal Block

```
SESSION GOAL: Admin backoffice hardening batch (H1 pagination, H3 upload sniffing, M2 coupon cap, H2 service tests)
Charter + umbrella plan: N/A — single plan (not a phase program)
Autonomy: Standard RIPER-5 interactive gates. No standing /goal autonomy granted for this session — ENTER EXECUTE MODE still requires explicit user confirmation of the CONDITIONAL gate below.
Hard stop conditions / safety constraints:
- Do not modify coupon redemption/checkout code (owned by a concurrent track) — Section D is validation-only.
- Do not remove `adminContactFilterSchema` without a fresh grep confirming zero remaining consumers.
- Cloudinary data URI MUST be built from the sniffed mime (lib/sniff-image-type.ts result), never from the client-supplied `file.type` header (E3/E8).
- `adminCouponUpdateSchema` MUST derive `.partial()` from the base ZodObject (`adminCouponBaseSchema`), never from the `.superRefine()`-wrapped `adminCouponInputSchema` (E8).
- Steps 7 and 14 (both edit `admin-dashboard.service.ts`) must not run concurrently.
Next phase: EXECUTE: process/general-plans/active/admin-hardening-batch_20-08-26/admin-hardening-batch_PLAN_20-08-26.md
Validate contract: inline in plan (## Validate Contract section, this file)
Execute start: npx tsc --noEmit | npx vitest run features/admin-users features/admin-contact features/admin-orders features/admin-products features/admin-audit features/admin-coupons lib/sniff-image-type.test.ts | Agent-probe: upload a renamed .pdf with spoofed Content-Type + paginate /admin/users and /staff/contact | high-risk pack: no (MEDIUM-HIGH risk class per Blast Radius, not one of the 6 auto-trigger high-risk classes requiring the full evidence pack — but E3/E8 hard stops above substitute as the trust-boundary safeguard)
```
