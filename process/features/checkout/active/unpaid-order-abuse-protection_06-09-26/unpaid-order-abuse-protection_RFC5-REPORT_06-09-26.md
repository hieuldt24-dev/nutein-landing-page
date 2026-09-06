---
name: report:unpaid-order-abuse-protection-rfc5
description: "RFC-5 — cutover, regression và runbook: build gate thật, diễn tập cutover/rollback cục bộ, rà quét log/secret, runbook và evidence pack; 3 khiếm khuyết chặn được phát hiện và sửa"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-5
---

# RFC-5 — Cutover, regression và runbook

**Ngày**: 06-09-26 · **Plan**: `unpaid-order-abuse-protection_PLAN_06-09-26.md`
**Trạng thái**: CODE DONE, một phần — nhiều hạng mục PENDING có tên rõ ràng.

---

## TL;DR

Chạy `npm run build` lần đầu tiên trong cả chương trình và nó **phát hiện ba
khiếm khuyết chặn mà RFC-2/3/4 đều bỏ lọt**:

1. **Một file generated bị hỏng đã che giấu TOÀN BỘ kiểm tra type của repo.**
   Cái gọi là "baseline 2 lỗi trong `.next/dev/types/validator.ts`" thực chất là
   lỗi CÚ PHÁP, mà TypeScript thì ngừng kiểm tra ngữ nghĩa khi còn lỗi cú pháp.
   Nghĩa là suốt RFC-2/3/4 **chưa từng có lần kiểm tra type nào thực sự chạy**.
   Dọn artifact xong lộ ra 11 lỗi thật, tất cả nằm trong code RFC-3/4. Đã sửa;
   `tsc --noEmit` giờ về **0 lỗi**.

2. **Migration sẽ ABORT trên bất kỳ database nào có đơn CANCELLED.**
   `guard_sensitive_order_columns()` viết `pg_catalog.current_user`, nhưng
   `current_user` là từ khoá SQL chứ không phải đối tượng schema. Test RFC-2
   không bắt được vì nó apply migration lên database RỖNG — câu `UPDATE orders`
   của §8 khớp 0 dòng nên trigger không bao giờ chạy. Database thật chắc chắn có
   đơn CANCELLED. Đã sửa.

3. **Migration không chạy lại được lần hai** (thiếu một `DROP POLICY IF EXISTS`).
   Đã sửa.

Ngoài ra: build xanh exit 0, 610/610 unit test, 64/64 integration test trên
Postgres + Redis thật, rà quét log/secret **không tìm thấy rò rỉ nào**, runbook
và evidence pack 5 artifact đã viết xong (validator: 0 failures, 0 warnings).

**Không có gì được VERIFIED, không có gì được commit, không enforcement nào được
bật.** Cutover vẫn bị chặn bởi 6 quyết định owner và 4 probe hạ tầng.

---

## Làm được gì / còn treo gì

| # | Hạng mục RFC-5 | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `npm run build` | **DONE** — exit 0 sau khi sửa 2 vấn đề | §2 |
| 1b | `npx tsc --noEmit` | **DONE** — 0 lỗi (lần đầu tiên thực sự chạy) | §2 |
| 1c | `npm run check` | **PENDING** — nợ prettier toàn repo (RFC-1 F5), ngoài phạm vi | — |
| 2 | Baseline stock/coupon/legacy discrepancy | **DONE cục bộ** — snapshot trước/sau + truy vấn R5 phát hiện chênh lệch thật | §3 |
| 2b | Dry-run migration + backfill | **DONE cục bộ** — 31/31 test | §3 |
| 2c | Diễn tập rollback | **DONE cục bộ** — forward-fix + kill-switch, không drop bảng | §3 |
| 2d | Diễn tập cutover trên **staging** | **PENDING** — không có Supabase staging — owner: chủ sở hữu | — |
| 3 | Rà quét log/secret/audit | **DONE** — không tìm thấy rò rỉ, không cần sửa | §4 |
| 4 | Diễn tập worker chạy chồng lấn | **PENDING** — owner đặt tên scheduler host → route RFC-3 E5 → rồi mới diễn tập — owner: chủ sở hữu | §6 |
| 5 | Runbook | **DONE** | `unpaid-order-abuse-protection_RUNBOOK_06-09-26.md` |
| 6 | Evidence pack (E6) | **DONE** — 5 artifact, validator sạch | `harness/` |
| 7 | ACL probe trên DB đã deploy (AC08) | **PENDING** — không có credentials; thủ tục 7 lệnh curl đã viết sẵn — owner: chủ sở hữu | RUNBOOK §5 |
| 8 | Benchmark AC13 (100k EXPLAIN, 20 rps p95) | **PENDING** — không có staging — owner: chủ sở hữu | §5 |
| 9 | Gate RFC-5 (owner xác nhận SOP/ngưỡng/known-gap) | **PENDING** — checkbox giữ nguyên chưa tick — owner: chủ sở hữu | — |

---

## 2. `npm run build` — output thật

### Lần chạy 1 — FAIL

```
▲ Next.js 16.2.10 (Turbopack)
✓ Compiled successfully in 10.0s
  Running TypeScript ...
Failed to type check.

.next/dev/types/validator.ts:242:9
Type error: Cannot find name 'handler'.

  240 |   type __Unused = __Check
  241 | }
> 242 | <typeof handler>
      |         ^
  243 |   // @ts-ignore
  244 |   type __Unused = __Check
  245 | }
Next.js build worker exited with code: 1
```

File này là **artifact do dev server sinh ra**, bị cắt cụt giữa chừng — nó kết
thúc bằng mảnh `<typeof handler>` lơ lửng, không thuộc khối nào. `tsconfig.json`
có `".next/dev/types/**/*.ts"` trong `include` nên nó được biên dịch.

**Đây chính là "2 lỗi baseline" mà RFC-1 ghi nhận** (khi đó ở dòng 244-245).
Nhưng nó là lỗi **cú pháp**, và TypeScript bỏ qua kiểm tra ngữ nghĩa khi chương
trình còn lỗi cú pháp. Hệ quả: mọi lần `npx tsc --noEmit` trong RFC-2/3/4 đều
chỉ báo đúng file đó và **không hề kiểm tra phần còn lại của repo**.

Đã xoá `.next/dev` (artifact build, không phải mã nguồn).

### Lần chạy 2 — FAIL, lần này là lỗi THẬT của RFC-3/4

```
./features/admin-orders/services/admin-orders.repository.ts:280:17
Type error: Conversion of type 'GenericStringError[] | null' to type 'OrderRow[]'
may be a mistake because neither type sufficiently overlaps with the other.
```

`npx tsc --noEmit` lúc này báo **11 lỗi**, tất cả trong file do RFC-3/4 chạm:

| File | Lỗi | Nguyên nhân |
|---|---|---|
| `features/admin-orders/services/admin-orders.repository.ts:280,311,312` | 3 × TS2352 | `.select()` nhận selectClause **động** (đường fallback 42703 của RFC-4) nên supabase-js mất khả năng suy luận row type |
| `tests/integration/checkout-rate-limit.test.ts:104-106` | 8 × TS18047 + TS2339 | `.catch(e => e as X)` tạo union với giá trị resolve, nên `.retryAfterSeconds` không tồn tại khi type-check |

**Sửa** (giữ nguyên hành vi runtime):
- Ép kiểu qua `unknown` ở 2 chỗ trong repository, kèm chú thích nêu lý do.
- Thêm helper `expectRateLimited()` thu hẹp kiểu đúng cách thay cho `.catch(...)`.

### Lần chạy cuối — PASS

```
✓ Compiled successfully in 10.3s
✓ Generating static pages using 7 workers (52/52) in 1631ms
├ ○ /account/orders
├ ƒ /account/orders/[id]
├ ƒ /api/account/orders
├ ƒ /api/account/orders/[id]
├ ƒ /api/account/orders/[id]/cancel
├ ƒ /api/account/orders/[id]/payment-claim
├ ƒ /api/staff/orders/[id]/resolve-payment-review
BUILD_EXIT=0
```

Cả 4 route API mới của RFC-3 và trang account mới của RFC-4 đều compile.
Không có `"server-only"` nào lọt vào bundle client; không lệch runtime edge/node.

`npx tsc --noEmit` → **exit 0, không còn lỗi nào** (kể cả 2 lỗi "baseline").
`npm test` → `Test Files 1 failed | 79 passed (80)`, `Tests 610 passed (610)` —
đúng một suite đỏ của baseline, **0 hồi quy**.

---

## 3. Diễn tập cutover / backfill / rollback (AC12, cấp cục bộ)

File mới: **`tests/integration/checkout-cutover-rehearsal.db.test.ts`** — chạy
lại được, gate bằng `TEST_DATABASE_URL` đúng như hai file integration hiện có,
nên `npm test` mặc định không bao giờ chạm tới.

> **Nói thẳng phạm vi:** file này chứng minh **SQL của migration chạy đúng trên
> một schema DỰNG LẠI BẰNG TAY** (`tests/integration/fixtures/bootstrap-schema.sql`)
> với dữ liệu giả. Nó **KHÔNG** chứng minh bất cứ điều gì về database Supabase đã
> deploy. Diễn tập staging mà AC12 yêu cầu vẫn là **PENDING**.

### Dataset legacy "khó chịu" có chủ đích

đơn 2 dòng cùng `product_id` (3+7) · coupon ở **lượt cuối** (`usage_limit=1`) ·
đơn PAID · đơn CANCELLED (tạo sống rồi UPDATE để **trigger restock cũ chạy
thật**) · đơn DELIVERED · mọi đơn đều `protection_version` NULL.

### Hai khiếm khuyết chặn mà diễn tập này phát hiện

**(A) Migration ABORT khi database có đơn CANCELLED**

```
error: missing FROM-clause entry for table "pg_catalog"
 ❯ tests/integration/checkout-cutover-rehearsal.db.test.ts:223:5
```

`guard_sensitive_order_columns()` viết `pg_catalog.current_user`. `current_user`
là **từ khoá SQL**, không phải đối tượng schema — nên Postgres parse nó thành
cột `current_user` của bảng `pg_catalog`.

Trigger này chạy `BEFORE UPDATE ON orders`, và §8 backfill có:

```sql
UPDATE public.orders SET released_at = updated_at
WHERE released_at IS NULL AND status IN ('CANCELLED','RETURNED');
```

Test RFC-2 apply migration lên database **rỗng** → câu UPDATE khớp **0 dòng** →
trigger không bao giờ chạy → lỗi không bao giờ lộ. Database thật chắc chắn có
đơn CANCELLED, nên migration sẽ **abort toàn bộ**. Một transaction nên dữ liệu
không hỏng, nhưng cutover thất bại.

Sửa: bỏ tiền tố → `current_user` (từ khoá không bị ảnh hưởng bởi `search_path=''`).

**(B) Migration không chạy lại được**

```
error: policy "Staff/Admin update non-sensitive order fields" for table "orders" already exists
```

Mọi object khác trong file đều idempotent; riêng `CREATE POLICY` này thiếu
`DROP ... IF EXISTS`. Đã thêm.

### Kết quả sau khi sửa: 31/31 PASS

```
 Test Files  1 passed (1)
      Tests  31 passed (31)
```

| Nhóm | Khẳng định được chứng minh |
|---|---|
| (a) §8 không đụng số liệu | `products.stock`, `coupons.used_count`, số đơn, số dòng đơn — **không đổi một con số**; migration là một `BEGIN...COMMIT` |
| (b) Ledger backfill | Mỗi đơn **đúng 1** dòng reservation; RESERVED / CONSUMED / RELEASED đúng theo trạng thái; coupon_id giữ đúng; đơn không coupon → NONE; mọi đơn legacy `protection_version` NULL |
| (c) `released_at` | CANCELLED có; PAID/DELIVERED **không** (đúng như migration viết); cap đếm đúng **2** đơn giữ chỗ |
| (d) Cutover | 3 trigger cũ và 2 policy bypass đã biến mất; insert `order_items` **không còn tự trừ kho** → không có giai đoạn vừa trigger vừa RPC |
| (e) ACL | 2 RPC tồn tại; EXECUTE bị REVOKE khỏi `public`/`anon`/`authenticated`; anon/authenticated không INSERT/UPDATE được 4 bảng |
| (f) Rollback | Chạy lại backfill → không sinh dòng trùng; apply lại toàn bộ migration → số liệu không đổi; đường đọc + đối soát staff vẫn sống khi ngừng nhận đơn mới; `trg_restock_on_cancel_or_return` **không** được dựng lại |
| (g) Đối soát R1-R5 | R1-R4 sạch; **R5 chủ động phát hiện chênh lệch thật** |
| (h) EXPLAIN | Ghi lại plan, **không** assert index (xem §5) |

### R5 — chênh lệch thật do trigger cũ để lại

Đơn CANCELLED [4,6] đáng lẽ hoàn **10** đơn vị, nhưng trigger cũ dùng
`UPDATE ... FROM` nên chỉ hoàn được **4 hoặc 6**. Migration **cố ý không tự sửa**
(§8 cam kết không đụng số liệu). Truy vấn đối soát đã đưa vào runbook cho owner.

### Phát hiện mới đưa vào runbook (R6)

§8 chỉ set `orders.released_at` cho CANCELLED/RETURNED. Một đơn `BANK_TRANSFER`
ở trạng thái **DELIVERED mà vẫn UNPAID** sẽ có `released_at` NULL và **lọt vào
predicate cap vĩnh viễn**, chiếm slot của khách. Không tự sửa dữ liệu; đã thêm
truy vấn R6 liệt kê đúng nhóm này để owner quyết định.

### Không hồi quy

```
Test Files  3 passed (3)
     Tests  64 passed (64)      # 25 RFC-2 + 8 RFC-3 + 31 RFC-5
```
Không có env → `3 skipped (3) / 64 skipped (64)`, exit 0.

---

## 4. Rà quét log / secret / audit output

**Kết quả: không tìm thấy rò rỉ nào. Không phải sửa gì.**

Bề mặt đã quét: `features/checkout`, `features/account`, `features/admin-orders`,
`app/api/checkout`, `app/api/account`, `app/api/staff`,
`src/middlewares/checkout-rate-limit.middleware.ts`, `src/security/trusted-client-ip.ts`.

| Tìm gì | Cách tìm | Kết quả |
|---|---|---|
| Mọi điểm ghi log | `grep -E "logger\.(info\|warn\|error\|debug)\|console\.(log\|warn\|error)"` (bỏ file test) | **Đúng 4 điểm**: `app/api/checkout/route.ts:59`; `checkout-rate-limit.middleware.ts:127,142,160`. Không điểm nào ghi identifier — chỉ `route` / `scope` / `hits` / `max` / `mode` |
| IP thô | `grep -niE "x-forwarded-for\|x-real-ip\|remoteAddress\|rawIp\|clientIp"` | Chỉ trong `trusted-client-ip.ts`. `resolveHashedClientIp()` **chỉ trả `ipHash`** — không nhánh nào trả IP thô ra ngoài |
| JWT / cookie / secret | `grep -niE "accessToken\|nutein_access_token\|authorization\|jwt\|HASH_SECRET\|CRON_SECRET\|SERVICE_ROLE"` | Chỉ là chú thích, và đọc `process.env`. Thông báo thiếu env chỉ nêu **TÊN** biến, không nêu giá trị |
| Địa chỉ / chứng từ ngân hàng trong log | `grep -niE "shipping_address\|bankRef\|reference\|accountNo"` lọc theo dòng có `logger`/`console` | **0 kết quả** — không trường nào nằm trong một lời gọi log |
| Lỗi lộ SQL/stack ra client | Đọc tay `error-handler.middleware.ts` | Nhánh lỗi ngoài dự kiến trả **message cố định** `"Đã xảy ra lỗi máy chủ nội bộ"` + 500. **Không** echo `error.message`, **không** stack |

Vì sao `error.message` của Postgres an toàn: `translateRpcError()`
(`order.repository.ts:149-180`) chỉ biến SQLSTATE **nằm trong allowlist**
`CHECKOUT_DB_ERROR_MAP` thành `AppError` có message hiển thị (đó là chuỗi tiếng
Việt do chính RPC raise). Mọi lỗi khác trở thành `Error` thường → 500 với message
chung. Chi tiết chỉ đi vào log phía server.

---

## 5. Bằng chứng theo AC — tách bạch cục bộ vs đã-deploy

### AC12 — cutover, backfill, reconciliation, rollback

| | Cục bộ (phiên này) | Đã deploy / staging |
|---|---|---|
| Dry-run migration | ✅ 31/31 trên Postgres dùng-rồi-bỏ | ❌ **PENDING** — chưa có staging |
| Backfill không đổi số liệu | ✅ snapshot trước/sau | ❌ PENDING |
| Truy vấn đối soát | ✅ R1-R5 chạy được, R5 phát hiện chênh lệch thật | ❌ PENDING |
| Diễn tập rollback | ✅ forward-fix + kill-switch, không drop bảng | ❌ PENDING |
| Legacy PAYOS hiển thị | ✅ có đường đọc riêng + test (RFC-3) | ❌ PENDING |

**AC12 chưa đạt.** Bằng chứng cục bộ là bằng chứng thay thế, không phải gate.

### AC13 — hiệu năng và log không chứa dữ liệu nhạy cảm

| | Trạng thái |
|---|---|
| Log không chứa IP thô / JWT / chứng từ ngân hàng | ✅ **ĐẠT** — §4 |
| EXPLAIN 100k dòng dùng partial index | ❌ **PENDING** — cần staging |
| checkout p95 < 1s ở 20 rps | ❌ **PENDING** — cần staging |
| lock wait p95 < 200ms | ❌ **PENDING** — cần staging |

EXPLAIN cục bộ đã chạy và ghi lại — **KHÔNG phải gate AC13**:

```
[RFC-5 EXPLAIN — cục bộ, 5 dòng, KHÔNG phải gate AC13]
Aggregate  (cost=1.10..1.11 rows=1 width=8)
  ->  Seq Scan on orders o  (cost=0.00..1.10 rows=1 width=0)
        Filter: ((released_at IS NULL) AND (status <> ALL ('{CANCELLED,RETURNED}'...
```

Với 5 dòng dữ liệu, planner chọn **seq scan** — và đó là lựa chọn ĐÚNG, index
đắt hơn. Vì vậy test **cố ý không assert index được dùng**: assert như thế sẽ là
bằng chứng giả. Chỉ khẳng định `idx_orders_active_unpaid_bank` **tồn tại**.

### AC08 — ACL / quyền truy cập

| | Cục bộ | Đã deploy |
|---|---|---|
| `anon`/`authenticated` không ghi được orders/order_items/ledger | ✅ `has_table_privilege` trên Postgres thật | ❌ **PENDING** — cần anon key + user JWT |
| EXECUTE RPC bị REVOKE khỏi PUBLIC/anon/authenticated | ✅ `has_function_privilege` | ❌ PENDING |
| 2 policy bypass (F1+F3) đã drop | ✅ `pg_policies` trống | ❌ PENDING |
| IDOR → 404; CSRF Origin lạ → 403 | ✅ test route (Supabase đã mock) | ❌ PENDING |

**AC08 chưa đạt trên database đã deploy.** Thủ tục probe 7 lệnh curl kèm mã
trạng thái kỳ vọng đã viết sẵn ở **RUNBOOK §5** để owner chạy.

---

## 6. Diễn tập worker chạy chồng lấn — KHÔNG THỰC HIỆN ĐƯỢC

**PENDING — điều kiện tiên quyết: owner đặt tên scheduler host → implement route
theo RFC-3 E5 → khi đó mới diễn tập được. Owner: chủ sở hữu Nutein.**

Không có worker nào tồn tại. `POST /api/internal/orders/review-expired` bị hoãn
**có chủ đích** ở RFC-3 (execute-instruction E5) vì owner chưa chọn scheduler
host. RFC-5 **không viết worker** — goal block cấm.

Hệ quả vận hành phải nói rõ: **đơn quá hạn hiện KHÔNG tự chuyển sang review.**
Logic chuyển trạng thái đã được chứng minh (RFC-2), nhưng không có gì gọi nó.

---

## 7. Deviation so với plan

| # | Deviation | Lý do | Đánh giá ảnh hưởng |
|---|---|---|---|
| D1 | Xoá thư mục `.next/dev` | Artifact build hỏng chặn `npm run build`; không phải mã nguồn | Không ảnh hưởng. Đã bộc lộ 11 lỗi type thật bị che giấu |
| D2 | Sửa 3 chỗ ép kiểu ở `admin-orders.repository.ts` + thêm helper trong `checkout-rate-limit.test.ts` | Lỗi type thật do RFC-3/4 tạo ra, lộ ra ở D1. Trong phạm vi (hồi quy trên code của chính feature này) | Hành vi runtime **không đổi** — chỉ ép kiểu và thu hẹp kiểu. 610/610 test vẫn xanh |
| D3 | Sửa `pg_catalog.current_user` → `current_user` trong migration RFC-2 | Lỗi chặn: migration abort trên mọi database có đơn CANCELLED | Sửa lỗi thuần tuý. 25 test RFC-2 vẫn xanh |
| D4 | Thêm `DROP POLICY IF EXISTS` vào migration | Mọi object khác trong file đều idempotent; riêng cái này thiếu | Cho phép chạy lại an toàn sau khi apply hỏng. Không đổi ngữ nghĩa |
| D5 | Đặt diễn tập vào `tests/integration/` chứ không phải `scripts/` | **Không có thư mục `scripts/`** trong repo (dù `package.json` có tham chiếu — script chết). `tests/integration/` là nơi đúng theo convention và đã có sẵn cơ chế gate `TEST_DATABASE_URL` | Nhất quán với repo; không chạy trong `npm test` mặc định |

Không có deviation nào thuộc nhóm dừng-cứng (không đụng auth/billing/schema
ngoài phạm vi validate-contract; D3/D4 là sửa lỗi bên trong chính migration đã
được plan phê duyệt).

---

## 8. Khoảng trống hạ tầng test tìm được

| # | Khoảng trống | Phân loại | Ghi chú |
|---|---|---|---|
| G1 | Artifact generated hỏng làm `tsc` bỏ qua toàn bộ kiểm tra ngữ nghĩa | **harness-drift** | Nghiêm trọng nhất. Không có gate nào phát hiện; chỉ `npm run build` mới lộ. Cân nhắc dọn `.next` trước khi type-check trong CI (chưa có CI) |
| G2 | Test DB apply migration lên database RỖNG nên bỏ lọt lỗi chỉ xuất hiện khi có dữ liệu | **test-breakage** | Đã đóng bằng file diễn tập RFC-5 (có dataset legacy) |
| G3 | `npm run check` vẫn không dùng làm gate được (nợ prettier toàn repo) | **stale-command-drift** | RFC-1 F5, ngoài phạm vi |
| G4 | 3 lỗi `react-hooks` có sẵn trên dòng không bị sửa | **product-breakage** (có sẵn) | `app/checkout/success/page.tsx:34`, `components/checkout/CheckoutForm.tsx:201,220`. Việc theo dõi, không phải hồi quy |
| G5 | Không có CI nên không gate nào chạy tự động | **harness-drift** | Không có `.github/workflows/` |
| G6 | Không có staging → AC12/AC13 không thể chứng minh | **known-gap** | Quyết định của owner |

---

## 9. Phải xảy ra gì trước khi VERIFIED / trước khi bật enforcement — cả 5 RFC

### 9.1 Quyết định của owner (6) — không hạng mục nào agent được tự chốt

| # | Quyết định | Chặn |
|---|---|---|
| 1 | **Scheduler host** (platform cron / scheduler ngoài / staff quét tay) | RFC-3 E5 route; AC05 end-to-end. Hiện đơn quá hạn KHÔNG tự vào review |
| 2 | **COD cap** (đề xuất 2/user) | AC11; khách né cap bằng cách chuyển sang COD |
| 3 | **Trần reserve toàn cửa hàng + hạn units chưa trả/user** | **AC14 — hiện KHÔNG đạt**; rollout guard giữ OFF |
| 4 | **Review SLA + tên người trực** (đề xuất 4h giờ hành chính) | AC05/AC06; không hứa SLA khi chưa có người thật |
| 5 | **Chính sách lưu audit** | `order_payment_events` append-only |
| 6 | **`.gitignore` `!.env.example`** (RFC-1 F4) | Biến env mới không commit được |

### 9.2 Probe hạ tầng (4)

| # | Probe | Chặn |
|---|---|---|
| 7 | **ACL probe** trên Supabase đã deploy (RUNBOOK §5) | **Toàn bộ cutover.** Đây là cổng làm cho cap trở thành thật (F1) |
| 8 | **Provision Redis production** (+TLS) | Bật limiter fail-closed. Redis chết = checkout chết |
| 9 | **Hành vi ghi đè header IP của ingress** | Đặt `TRUSTED_CLIENT_IP_HEADER`; hiện limiter IP chỉ là tín hiệu mềm |
| 10 | **Supabase staging** | Diễn tập cutover AC12 + benchmark AC13 |

### 9.3 Hành động của con người (2)

| # | Hành động | Chặn |
|---|---|---|
| 11 | **Owner apply migration** trong cửa sổ bảo trì, cùng lúc với code | RFC-2/3/4 chuyển từ TESTING sang VERIFIED |
| 12 | **Người thật đi thử UI** khách + staff, desktop + mobile, có tên người xác nhận và ảnh chụp màn hình | Gate RFC-4 (AC10). Agent KHÔNG làm được — Google-OAuth-only |

### 9.4 Đóng cửa sổ tương thích (1)

| # | Việc | Tiêu chí |
|---|---|---|
| 13 | Siết `Idempotency-Key` thành bắt buộc (400/409) | **≥24 giờ liên tục không có log thiếu header nào** trên traffic thật. Log phát ở `checkout.service.ts:205` qua `logger.warn` của pino → stdout của ứng dụng |

### 9.5 Tiêu chí cuối

**Không RFC nào được đánh dấu VERIFIED cho tới khi:** migration đã apply lên
Supabase thật, ACL probe sạch, và người có tên xác nhận đã đi thử UI. Build và
typecheck xanh **không đủ** để VERIFIED (§Phase Completion Rules của plan).

---

## 10. Trạng thái container

Hai container dùng-rồi-bỏ **vẫn đang chạy có chủ đích** — orchestrator dọn sau
lần EVL cuối:

- `nutein-rfc2-pg` — `postgres://postgres:postgres@localhost:55432/nutein_test`
- `nutein-rfc3-redis` — `redis://localhost:56379`

Không tạo thêm container nào; không `docker exec` vào bất cứ thứ gì khác.

---

## 11. Closeout

- **Plan**: `unpaid-order-abuse-protection_PLAN_06-09-26.md`
- **Đã xong**: `npm run build` (gate thật, lần đầu chạy), `tsc --noEmit` 0 lỗi,
  diễn tập cutover/backfill/rollback cục bộ (31 test mới), rà quét log/secret,
  runbook, evidence pack 5 artifact.
- **Đã sửa**: 3 khiếm khuyết chặn (che giấu type check; migration abort trên
  đơn CANCELLED; migration không chạy lại được) + 11 lỗi type.
- **Chưa xác minh**: mọi thứ liên quan database đã deploy, staging, người thật,
  và scheduler.
- **Phân loại**: **Keep in active/testing** — 5/5 RFC CODE DONE, không RFC nào
  VERIFIED, chưa commit gì.
- **Bước tiếp theo**: EVL độc lập trên các gate của RFC-5, rồi owner giải quyết
  §9 trước khi bàn tới cutover.
