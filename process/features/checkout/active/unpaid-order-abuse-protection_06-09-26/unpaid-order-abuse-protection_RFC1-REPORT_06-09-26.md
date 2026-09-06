---
name: report:unpaid-order-abuse-protection-rfc1
description: "RFC-1 preflight findings — order-mutation inventory, RLS/trigger/ACL re-confirmation, NOT-PROBED infra list, pending owner decisions, RFC-1 gate verdict"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-1
---

# RFC-1 — Preflight và chốt invariant (findings)

**Verdict: RFC-2 may start.** Nothing found in RFC-1 blocks RFC-2's migration/RPC design work.
Two new defects were found that RFC-2 must absorb, and one plan claim was found to be stale.
Everything requiring a live staging Supabase / Redis / scheduler is **NOT PROBED** — no credentials
exist in this environment, and none were fabricated.

TL;DR:
- Order-mutation inventory is complete and **smaller than the plan implies**: 3 app write sites, 4 DB triggers, 1 seed migration.
- **NEW F3:** a second RLS bypass — `"Users insert own order items"` (`20260721000000_seed_product_order_code_cart_variant.sql:69`) — the plan only names the `orders` INSERT policy. Dropping one without the other leaves the bypass half-open.
- **NEW F4:** `.env.example` is **git-ignored** (`.gitignore:34` = `.env*`, no negation). The RFC-1 env-documentation deliverable was written but **cannot be committed** without a `.gitignore` change.
- **Stale plan claim corrected:** `npm run check` does not fail at `lib/useAddresses.test.tsx`. It fails at step 1, `format:check`, on **1303 files**, and never reaches lint / type-check / test.
- 4 owner-decision thresholds remain **unlocked** — an agent cannot lock them.

---

## (a) Order-mutation inventory — every writer of `orders` / `order_items` / `coupons.used_count` / `products.stock`

### A1. Application code (TypeScript)

| # | Site | file:line | Writes | Notes |
|---|---|---|---|---|
| 1 | Checkout create — order row | `features/checkout/services/order.repository.ts:161-162` | INSERT `orders` | Admin (service-role) client. Fires `trg_validate_coupon` (BEFORE INSERT) → `coupons.used_count + 1`, and `trg_log_order_status_insert`. |
| 2 | Checkout create — item rows | `features/checkout/services/order.repository.ts:214` | INSERT `order_items` | **Separate request from #1 — not one transaction.** Fires `trg_reduce_stock_on_order_item_insert` → `products.stock - quantity` per row. |
| 3 | Checkout compensating delete | `features/checkout/services/order.repository.ts:217` | DELETE `orders` | Runs when #2 fails. **Confirms the plan's coupon leak (F-coupon below).** |
| 4 | Staff status transition | `features/admin-orders/services/admin-orders.repository.ts:298-301` | UPDATE `orders` (`status`, `handled_by`, sometimes `payment_status`) | Transition allowlist enforced in TS (`ADMIN_ORDER_STATUS_TRANSITIONS`, line 271). Auto-sets `payment_status: "PAID"` for COD on `delivered` (lines 288-294). Can fire `trg_restock_on_cancel_or_return`. |
| 5 | Staff status-log note patch | `features/admin-orders/services/admin-orders.repository.ts:325-328` | UPDATE `order_status_logs` | Non-authoritative; patches the row the trigger just inserted. |
| 6 | Staff confirm payment | `features/admin-orders/services/admin-orders.repository.ts:384-388` | UPDATE `orders` SET `payment_status='PAID'` | Guards `payment_method` (374) and `payment_status` (377) only. **`status` is selected at line 364 but never checked** — a CANCELLED order still `UNPAID` passes. Plan's finding #7 re-confirmed against source. |
| 7 | Admin product edit | `features/admin-products/services/admin-products.repository.ts:130-132` | UPDATE `products` (payload may include `stock`) | Out of the checkout path, but it is a stock writer with no ledger awareness — a manual stock edit silently desyncs any future reservation ledger. Not currently named in the plan. |
| 8 | Admin coupon create / edit | `features/admin-coupons/services/admin-coupons.repository.ts:101-103`, `155-157` | INSERT / UPDATE `coupons` | Can change `usage_limit` / `is_active`; `used_count` is not written here. |

**Reads only** (no mutation — listed so the inventory is provably exhaustive):
`features/account/services/account-order.service.ts:117` (customer order history),
`features/admin-orders/services/admin-orders.repository.ts:152, 172, 190, 233, 258, 363`,
`features/checkout/services/order.repository.ts:260` (stock pre-check),
`features/product/services/product-catalog.server.ts:21`,
`features/admin-products/services/admin-products.repository.ts:87`.

**Confirmed absent:** there is no customer-side cancel, no worker, no cron handler, and no
client-side writer. `supabaseBrowser` (`lib/supabase-browser.ts`) is used by exactly five files
(`components/providers/AuthProvider.tsx`, `features/auth/services/auth.repository.ts` + its test,
`features/product/services/product.service.ts`, and the client module itself) — auth and product
reads only. This independently re-confirms the plan's claim that revoking `authenticated` INSERT on
`orders`/`order_items` breaks no caller.

### A2. Database triggers (the real mutation authority)

| # | Object | file:line | Effect |
|---|---|---|---|
| T1 | `validate_and_apply_coupon()` + `trg_validate_coupon` (BEFORE INSERT ON orders) | `20260718000000_init_schema.sql:603-632` | Locks the coupon `FOR UPDATE`, validates active/expiry/usage, then `UPDATE coupons SET used_count = used_count + 1` (line 623). **`SECURITY DEFINER`, no `search_path` pinned.** |
| T2 | `reduce_stock_on_order_item_insert()` + trigger | `20260724000000_reserve_stock_on_order_create.sql:15-30` | `UPDATE products SET stock = stock - NEW.quantity` per inserted row. Correct per-row. `SECURITY DEFINER`, no `search_path`. |
| T3 | `restock_on_order_cancelled_or_returned()` + trigger | `20260724000000_reserve_stock_on_order_create.sql:33-53` | `UPDATE products p SET stock = p.stock + oi.quantity FROM order_items oi WHERE oi.order_id = NEW.id AND oi.product_id = p.id` — **`UPDATE ... FROM` applies exactly one arbitrary matching row, so a 2-line order restocks only one line.** Also has **no guard on `payment_status`**: cancelling a PAID, already-shipped order restocks it. |
| T4 | `log_order_status_change()` + insert/update triggers | `20260718000000_init_schema.sql:579-595` | Writes `order_status_logs`. Does not carry `note` (hence app site #5). |
| T5 | `audit_trigger()` + `trg_audit_orders` / `trg_audit_coupons` / `trg_audit_products` | `20260718000000_init_schema.sql:639-671` | Audit writes only. |
| T6 | `handle_new_auth_user()` + trigger | `20260718000000_init_schema.sql:66-83` | Seeds `public.users.id = auth.users.id` — the precondition that makes the F1 bypass work. |
| T7 | *(superseded)* `reduce_stock_on_processing()` | defined `20260718000000_init_schema.sql:547-573`, **dropped** `20260724000000:11-12` | No longer active. Confirmed there is no double-decrement path from the old trigger. |

### A3. Migration / seed-time mutations

| # | Site | Effect |
|---|---|---|
| M1 | `20260721000000_seed_product_order_code_cart_variant.sql:8-12` | `UPDATE orders SET order_code = ...` backfill (historical, one-time). |
| M2 | `20260721000000_...:24-62` | `INSERT INTO products` seed with `stock = 9999` + `ON CONFLICT DO UPDATE`. Re-running the migration does **not** reset `stock` (stock is not in the DO UPDATE list) — safe. |
| M3 | `20260724010000_admin_content_extra_columns.sql:30`, `20260812010000_refresh_product_gallery_media.sql:3`, `20260818000000_update_nutein_bundle_offers.sql:15` | `UPDATE products` — media/offer columns only, no `stock`. |

**Inventory completeness statement:** derived by grepping every `.from("orders"|"order_items"|"coupons"|"products")` call and every `INSERT/UPDATE/DELETE` + `CREATE TRIGGER/FUNCTION` across all 13 migrations (the plan says 14; the directory contains 13). No writer was found outside the tables above.

---

## (b) RLS / trigger / ACL findings verifiable from migrations alone

### F1 — RE-CONFIRMED (orders INSERT bypass)

`supabase/migrations/20260718000000_init_schema.sql:271-272`, verbatim:

```sql
CREATE POLICY "Users create own orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Combined with T6 seeding `public.users.id = auth.users.id`, any logged-in customer can `POST` to
the Supabase REST API with their own OAuth session + the public anon key and insert an order row —
bypassing the app JWT, the rate limiter, the future account cap, and idempotency entirely. The
insert also fires T1, so the bypass can burn coupon `used_count` directly.

### F2 — RE-CONFIRMED (zero GRANT / REVOKE)

Grep across all 13 migration files returns **zero** `GRANT` and **zero** `REVOKE` statements. The
effective privilege set for `anon`, `authenticated`, and `service_role` is entirely whatever
Supabase's project defaults are. The RFC-1 ACL probe therefore starts from an undocumented state,
not from a baseline that can be assumed safe.

### F3 — NEW: second RLS bypass the plan does not name

`supabase/migrations/20260721000000_seed_product_order_code_cart_variant.sql:60-79` creates:

```sql
CREATE POLICY "Users insert own order items"
  ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders o
                      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
```

This is the second half of F1. Together they let an authenticated customer create a *complete*
order (header + lines) straight through PostgREST, which also fires T2 and decrements
`products.stock` with no app-layer involvement at all.

**Impact on the plan:** the RFC-2 checklist item currently says only "bỏ policy `"Users create own
orders"`". That is incomplete — `"Users insert own order items"` must be dropped in the same
migration, or the bypass survives with `orders` insert closed and `order_items` insert open. Also
note the plan's remediation must handle the **`SELECT`** side deliberately: `"Users view own orders"`
(`init_schema.sql:268`) and `"View own order items"` (`:296`) are read policies that the customer
UI does not currently rely on (all reads go through server services with the admin client), but they
are not part of the write bypass and should not be dropped by accident.

### F4 — NEW: `.gitignore` blocks the RFC-1 env deliverable

`.gitignore:34` is `.env*` with **no `!.env.example` negation**. `.env.example` is therefore
untracked and ignored: the RFC-1 item "document `APP_BASE_URL` and `REDIS_URL` in `.env.example`"
was executed on disk but **the change cannot be committed** in the current repo configuration.
Fixing this means editing `.gitignore` (adding `!.env.example`) — outside RFC-1's read-only scope
and a repo-policy call, so it is flagged rather than done. Until it is resolved, the env
documentation exists only on the local working copy.

### F5 — Stale plan claim: the real `npm run check` baseline

The plan and validate-contract both state the baseline is RED at `lib/useAddresses.test.tsx`. That
is not what the command does today. `"check"` is
`format:check && lint && type-check && test` (`package.json:13`), and it **halts at step 1**:

```
Code style issues found in 1303 files. Run Prettier with --write to fix.
EXIT_CODE=1
```

Lint, type-check, and test never run under `npm run check`. Verbatim output:
`rfc1-baseline-npm-check_06-09-26.txt`. Because the short-circuit hides the true state, that file
also carries a clearly-labelled supplemental section with the steps run individually:

| Step | Result |
|---|---|
| `prettier --check .` | FAIL — 1303 files, exit 1 |
| `tsc --noEmit` | FAIL, exit 2 — 2 errors, both in **generated** `.next/dev/types/validator.ts(244,8)` / `(245,1)`, i.e. build artefacts, not source |
| `npx vitest run` | FAIL, exit 1 — **1 failed suite / 64 passed (65); 429 tests passed, 0 test assertions failed.** The single failure is `lib/useAddresses.test.tsx`, failing at import: `@supabase/ssr: Your project's URL and API key are required` via `lib/supabase-browser.ts:9` |
| `npm run lint` | NOT RUN — not reached; not run separately in this pass |

So the plan's described failure is real but is *only* reachable by running vitest directly. Two
consequences for later RFCs: (1) `npm run check` cannot serve as a regression gate at all until the
prettier debt is dealt with — it fails identically before and after any change; (2) the vitest
failure is environmental (no Supabase env vars in the test process), not a product defect.

### Other trigger-level findings worth carrying into RFC-2

- **Multiline restock defect — re-confirmed and slightly worse than stated.** T3's `UPDATE ... FROM`
  updates one arbitrary matching `order_items` row. `order.repository.ts:206` writes the constant
  `NUTEIN_PRODUCT_DB_ID` as `product_id` for **every** line, so every multi-line order under-restocks.
  Mandatory-minimum fixture in the plan is correct.
- **Coupon leak — re-confirmed.** T1 increments `used_count` at `init_schema.sql:623`; grep across
  all migrations finds **no decrement anywhere**. The compensating `orders.delete()`
  (`order.repository.ts:217`) therefore permanently burns one coupon use on every partially-failed
  create. Removing the compensating path (plan's stated fix) is right.
- **T3 has no `payment_status` guard.** Cancelling a PAID order restocks it today. Plan AC09 covers
  the intent; the trigger is the mechanism that must change.
- **All `SECURITY DEFINER` functions (T1, T2, T3, T5, T6) lack a pinned `search_path`.** This matches
  the plan's stated RFC-2 requirement (fixed empty `search_path`, schema-qualified names,
  `REVOKE ... FROM PUBLIC`) — noting here that the requirement applies to the *existing* functions
  too, not only to the new RPC.
- **`"Staff/Admin update orders"` (`init_schema.sql:274`)** lets any user whose `public.users.role`
  is STAFF/ADMIN update **any** order column directly via PostgREST — including
  `payment_status → PAID` — with no transition allowlist and no audit beyond T5. The app-layer
  transition guard at `admin-orders.repository.ts:271` is bypassable by a staff account. Not named
  in the plan; RFC-2's ACL work should decide explicitly whether to keep it.

---

## (c) NOT PROBED — requires live infrastructure unavailable in this environment

None of the following were attempted, and no result is inferred for any of them.

| Item | Status | Why |
|---|---|---|
| Deployed schema / triggers / RLS on staging | **NOT PROBED — no staging credentials available in this environment** | Findings in section (b) are from migration files only. Whether the deployed database matches those files is unverified; migrations are applied manually ("Apply 1 lần… bởi owner"), so drift is plausible. |
| RPC / table ACL probe with `anon`, `authenticated`, `service_role` | **NOT PROBED — no staging credentials** | This is the gate that makes AC01 real. F1+F3 mean it must be run before any enforcement ships. |
| App JWT vs Supabase `auth.uid()` divergence (live) | **NOT PROBED live; confirmed structurally from source** | Two independent identity layers exist (`nutein_access_token` app JWT vs Supabase session). The bypass in F1 turns on `auth.uid()` being valid independently of the app JWT — true by construction, but not empirically demonstrated here. |
| Redis provisioning / TLS / reachability | **NOT PROBED — no provisioned Redis** | Only verifiable fact: `src/cache/redis.ts:4` reads `REDIS_URL` and logs "Redis caching and rate limiting are disabled" when unset (`:24`). Whether one is provisioned in deployment is unknown. |
| Trusted ingress IP / `x-forwarded-for` overwrite behaviour | **NOT PROBED — no deployed ingress** | Requires a request through the real edge. Until proven, the IP limiter is a soft signal only. |
| Real scheduler / cron host | **CONFIRMED ABSENT in-repo, NOT PROBED for the platform** | No `.github/workflows/`, no `vercel.json`, no Docker, no worker entrypoint. The hosting platform may still offer cron — that is the owner's to answer. |
| Named staff actor and real reconciliation coverage hours | **NOT PROBED — organisational, not technical** | The 4h review SLA cannot be promised without a named on-duty person. |
| `.env` contents (`REDIS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` presence) | **NOT CONFIRMED — blocked by the privacy guard** | `.env` exists (visible in the directory listing) but reading it was blocked by `.claude/hooks/privacy-block.cjs`. Per RFC-1 constraints the guard was not worked around. Which variables are set is therefore unknown. Weak indirect signal only: `npx vitest run` fails because `NEXT_PUBLIC_SUPABASE_URL` is absent *in the vitest process* — vitest does not load `.env` by default, so this says nothing about the file. |
| Staging fixture creation (multiline same-product, last-use coupon, paid/legacy orders) | **NOT DONE — requires a staging database** | Would require INSERTs, which RFC-1 forbids. The fixture *shapes* are specified in the plan's Verification Evidence table and are ready for RFC-2 to implement as integration-test fixtures against a local test Postgres instead. |

---

## (d) Owner decisions — still pending, not locked by this pass

An agent cannot ratify business policy. The values below are **the plan's proposals, unchanged and
still unconfirmed**. Each is reproduced from the plan's "Chính sách đề xuất cần chốt tại VALIDATE"
table so the owner has one place to sign off.

| # | Decision | Plan's proposed default | Status |
|---|---|---|---|
| 1 | COD active cap | 2 per user (PENDING/PROCESSING) | **PENDING OWNER** — proposed only |
| 2 | Per-user unpaid-units limit (AC14) | not proposed — deliberately blank pending a real stock snapshot | **PENDING OWNER** — AC14 is NOT satisfied; rollout guard stays OFF |
| 3 | Global reserve ceiling (AC14) | not proposed — same reason | **PENDING OWNER** — same |
| 4 | Review SLA | 4h in business hours; next opening shift outside them | **PENDING OWNER** — unachievable without a named on-duty actor |

Two adjacent items are also unratified and should be signed off in the same round: the audit /
rate-limit data retention policy (proposed: 30 days for operational events), and the scheduler host
choice (platform cron / external scheduler / manual staff sweep) which the plan already gates RFC-3
on.

**Nothing above was decided in this pass.** No threshold was invented.

---

## (e) RFC-1 Gate verdict

**RFC-2 may start. RFC-1 does not block it.**

Rationale: RFC-2's deliverables are a migration, a ledger, an RPC, an ACL change, and integration
tests against a *local* test Postgres. Every input RFC-2 needs is either confirmed from migration
files (schema, triggers, policies, the two defects) or is a test-fixture shape that can be built
locally. The unprobed items — staging ACL state, Redis, ingress, scheduler — are all preconditions
for *enabling enforcement*, which is RFC-2's cutover step and RFC-3's job, not for designing and
writing the migration.

Conditions carried forward (these are gates on later steps, not on starting RFC-2):

1. **Do not run the ACL/trigger cutover against any deployed database** until the staging ACL probe
   has actually been run and recorded. F1 + F3 are live bypasses; shipping the account cap while
   either policy stands produces false safety. This is already hard-stop #1 in the plan's Autonomous
   Goal Block and it still holds, unchanged.
2. **RFC-2 must drop BOTH policies** — `"Users create own orders"` (orders INSERT) **and** `"Users
   insert own order items"` (order_items INSERT, F3). The plan currently names only the first.
   Recommend the plan text be corrected during RFC-2's own plan-supplement rather than now.
3. **`npm run check` is not a usable regression gate** until the 1303-file prettier debt is
   addressed. Use `npx vitest run` + `npx tsc --noEmit` as the working gates and compare against the
   captured baseline (1 failed suite / 64 passed; 429 tests passing).
4. **The `.env.example` documentation is on disk but uncommittable** (F4). Either add
   `!.env.example` to `.gitignore` or accept that the two variables stay undocumented in version
   control — an owner call.
5. **The four owner thresholds remain open.** RFC-2 does not depend on them (they are enforcement
   values, not schema), but RFC-3's limiter and AC14's guard do.

Deployment-readiness is **not** declared: the scheduler host is unchosen and no staff reconciliation
actor is named, exactly as the plan's RFC-1 gate requires.
