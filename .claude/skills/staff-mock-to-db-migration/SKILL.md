---
name: staff-mock-to-db-migration
description: Migrate one of Nutein's Staff admin screens (Sản phẩm/Liên hệ/Coupon/Blog/Trang tĩnh/Đơn hàng-style features) off its in-memory mock service onto the real Supabase table — use whenever a `features/admin-*/services/admin-*.service.ts` still does `let store = structuredClone(MOCK_...)` and needs to persist for real, or when adding a brand-new Staff CRUD screen that should be DB-backed from day one.
---

# Staff mock-to-DB migration

Nutein's Staff portal (`/staff/**`) ships UI-complete but many screens still run on a module-level
in-memory array (`let store: X[] = structuredClone(MOCK_X)`) instead of Supabase — even though the
DB schema for every one of these tables has existed since `20260718000000_init_schema.sql`. This
skill is the repeatable recipe used to flip **Coupon, Trang tĩnh, Liên hệ, Blog, and Sản phẩm**
from mock to real DB in one pass, and how `Đơn hàng` (`admin-orders`) was done earlier — use it for
any Staff screen still in that state, or a new one.

## Recipe (do these in order)

1. **Read the real table schema** in `supabase/migrations/20260718000000_init_schema.sql` (and any
   later ALTERs) for the target table. Note exact column names/types/constraints — these are the
   source of truth, not the mock's TS type.
2. **Read the mock service AND the editor/list UI components** (`components/admin/<domain>/*.tsx`),
   not just `features/admin-<domain>/types/index.ts`. The type can carry fields the UI never
   actually edits (e.g. `AdminProduct.specs` was in the type and round-tripped on save, but had
   no editable form field) — you need the UI's real read/write surface to know what must survive
   a save, not just what the type declares.
3. **Decide field mapping** app-shape ↔ DB-row:
   - Direct scalar match (name, price, stock, title, content...) → use the column as-is.
   - Enum naming mismatch → write an explicit two-way `Record` map, don't assume case-only
     difference. Example: blog `BlogCategoryId` app enum uses `"lifestyle"`, DB `"BlogCategory"`
     enum uses `'HEALTHY_LIFESTYLE'` — irregular, not just upper/lowercase.
   - App boolean with no DB column, but a nullable FK-ish column exists → derive it instead of
     adding a column. Example: `AdminContactMessage.isHandled` has no DB column, but
     `contact_messages.handled_by UUID` does — `isHandled = handled_by !== null`; setting it true
     writes the acting staff user's id, false writes `null` (see
     `features/admin-contact/services/admin-contact.repository.ts`).
   - Rich/nested cosmetic fields with no natural column home (gallery image objects, spec lists,
     pack variants, a tagline) → **don't invent five new scalar columns**; add ONE JSONB column
     (e.g. `products.marketing_meta`) and stash the whole cosmetic bag there. Read-modify-write it
     in the repository (Supabase's query builder has no partial-JSON-merge operator): fetch the
     current row, spread `patch.field ?? current.field` per key, write the full object back. See
     `features/admin-products/services/admin-products.repository.ts`.
   - **Check for convergence with other features before finalizing the mapping.** `products.stock`
     is the *same column* `checkoutService`/`orderRepository.getAvailableStock()` already reads —
     wiring the Staff editor to it means Staff stock edits immediately affect checkout's oversell
     guard. Always check `features/checkout/**` and other already-real features for existing reads
     of the same table before you design something incompatible.
4. **Write one additive migration** (new timestamped file in `supabase/migrations/`, never edit an
   applied one) for whatever the mapping in step 3 needs: `ALTER TABLE ... ADD COLUMN IF NOT
   EXISTS ...` (nullable or `DEFAULT` — never a breaking change), plus `INSERT ... ON CONFLICT
   DO NOTHING` seeds if the screen expects a known fixed set of rows to exist (e.g. the 6
   `static_pages` slugs). Dollar-quote (`$tag$...$tag$`) any multi-paragraph seed content instead
   of single-quote-escaping. **This migration is not applied automatically** — tell the user it
   needs `supabase db push` or the SQL Editor, same as every other migration in this repo; don't
   assume it's live until they confirm.
5. **Write `features/admin-<domain>/services/admin-<domain>.repository.ts`** (new file,
   `import "server-only"` first line), mirroring `features/admin-orders/services/admin-orders.repository.ts`:
   - A `*Row` interface matching the DB columns exactly (snake_case).
   - A `*_SELECT` column-list constant.
   - `toAdmin*(row)` mapper doing the snake_case→camelCase + enum/derived-field translation from
     step 3.
   - CRUD functions (`list`/`getById`/`create`/`update`, whichever the mock service exposed).
   - Translate known Postgres error codes into friendly `BadRequestError`/`NotFoundError` from
     `@/src/errors/app.error` instead of leaking raw Postgres text: `23505` = unique violation
     (duplicate code/slug), `23514` = check violation. Everything else stays a plain `Error`
     (500, logged server-side only — see `withErrorHandler` in
     `src/middlewares/error-handler.middleware.ts`, which only forwards `AppError` subclasses'
     messages to the client).
6. **Write a Zod schema** in `features/admin-<domain>/schemas/admin-<domain>.schema.ts` for the API
   request body/query — mirrors `features/admin-orders/schemas/admin-orders.schema.ts`.
7. **Write thin route handlers** under `app/api/staff/<domain>/route.ts` (+ `[id]/route.ts` if
   per-item): `authenticate(req)` then `requireRole(user, "STAFF")` (Admin does NOT inherit Staff
   operational routes in this project — see the S3 comment convention already in
   `app/api/staff/orders/**`), parse with the Zod schema, call the repository, return via
   `successResponse`/`createdResponse` from `@/src/api/response`. No business logic in the route.
8. **Rewrite `admin-<domain>.service.ts`** to call `apiRequest()` against the new routes instead of
   touching the mock store — **keep every exported function name and signature byte-identical** to
   what the mock service exposed. This is the whole trick: `components/admin/<domain>/*.tsx` only
   imports the service, never the mock/repository directly, so if the public shape doesn't change,
   **zero UI changes are needed**. Verify this by grepping
   `grep -rn "admin<Domain>Service\." components/admin/<domain>` before and after — the call sites
   should be identical.
9. **Delete the mock data file** (`features/admin-<domain>/data/*.mock.ts`) and any now-unused
   `ADMIN_*_MOCK_LATENCY_MS` constant in `constants.ts`. Grep for the exported mock symbols first
   (e.g. `ADMIN_STATIC_SLUGS`) in case something else still imports them.
10. **Write repository tests** mirroring `features/admin-orders/services/admin-orders.repository.test.ts`'s
    fake query-builder pattern: a `makeBuilder({data, error})` helper where every chain method
    (`select/eq/order/insert/update/upsert/...`) returns the same builder and `.single()`/
    `.maybeSingle()`/`.then()` resolve the fixture — `vi.mock("@/lib/supabase", () => ({
    supabaseAdmin: { from: mocks.from } }))`. Cover at minimum: field mapping (snake↔camel +
    derived/enum fields), the not-found path, and the duplicate-key path if the table has a
    UNIQUE constraint.
11. **Verify**: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run features/admin-<domain>`,
    `npx eslint features/admin-<domain> app/api/staff/<domain> --max-warnings=0`. All three must be
    clean before considering the migration done.

## Known boundary of this pattern (tell the user, don't silently assume it's fixed)

Wiring a Staff CRUD screen to the real table does **not** automatically make edits visible on the
public storefront. `features/policies/services/policy.service.ts` (public policy pages),
`features/blog`'s public reads, and `features/product/services/product.service.ts` (PDP/checkout
catalog data) still read their own separate `data/*.mock.ts` files, independent of the tables
Staff now writes to. Closing that loop (pointing public reads at the same DB rows) is a distinct,
larger follow-up — flag it, don't fold it in silently, and don't assume "Staff edited it" implies
"customers see it" until that follow-up is done.

## Files this pattern has already touched (for reference diffs)

- `features/admin-coupons/services/admin-coupons.repository.ts` — plainest case, near 1:1 column mapping.
- `features/admin-content/services/admin-content.repository.ts` — upsert-by-natural-key (`slug`) instead of an `id` PK.
- `features/admin-contact/services/admin-contact.repository.ts` — derived boolean from a nullable FK column.
- `features/admin-blog/services/admin-blog.repository.ts` — irregular enum-name mapping both ways.
- `features/admin-products/services/admin-products.repository.ts` — JSONB read-modify-write bag, and convergence with `checkoutService`'s stock reads.
- `supabase/migrations/20260724010000_admin_content_extra_columns.sql` — the additive migration + seed pattern for all of the above.
