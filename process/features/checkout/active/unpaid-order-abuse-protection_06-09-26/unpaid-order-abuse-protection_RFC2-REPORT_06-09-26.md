---
name: report:unpaid-order-abuse-protection-rfc2
description: "RFC-2 execute report — atomic checkout RPC, reservation ledger, write ACL, vitest project split, DB-backed evidence"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-2
---

# RFC-2 — Atomic persistence và lifecycle (EXECUTE report)

**Date**: 06-09-26
**Phase state**: PLANNED → **CODE DONE → TESTING**. KHÔNG phải VERIFIED.
**Plan**: `unpaid-order-abuse-protection_PLAN_06-09-26.md`

## TL;DR

Đường ghi đơn hai-write cộng `orders.delete()` bù trừ đã bị xoá hẳn và thay bằng một RPC
transaction duy nhất. Hai lỗi dữ liệu mà plan chỉ đích danh — rò rỉ lượt coupon và hoàn kho thiếu
với đơn nhiều dòng — đều đã được chứng minh là THẬT trên schema cũ và đã được chứng minh là ĐÃ SỬA
trên schema mới, bằng 25 test chạy trên Postgres thật với connection độc lập.

Chưa VERIFIED vì hai lý do ngoài tầm EXECUTE: migration chưa được owner apply lên Supabase, và ACL
probe của RFC-1 vẫn chưa chạy. Mọi enforcement khách hàng thấy được vẫn TẮT.

## 1. Migration có sẵn — những gì đã review và sửa

File `supabase/migrations/20260906000000_checkout_abuse_protection.sql` đã tồn tại trong working tree
(untracked, chưa ai review). Đọc đối chiếu với plan: phần lớn đúng — thứ tự khoá user → idempotency
→ coupon → product id tăng dần, idempotency đứng trước cap, `search_path = ''` + schema-qualified,
invoker rights, REVOKE EXECUTE khỏi PUBLIC, SUM theo `product_id` trước khi hoàn kho, drop cả hai
policy F1/F3.

Ba sửa đổi đã áp dụng:

| # | Vấn đề | Sửa |
|---|---|---|
| M1 | `CREATE TEMP TABLE ... ON COMMIT DROP` bên trong `checkout_create_order_atomic`. plpgsql cache plan theo OID; temp table đổi OID mỗi transaction → lần gọi thứ hai trong cùng session ném `relation with OID ... does not exist`. Đây là bug thật, không phải style. | Bỏ temp table, gộp dòng ngay trong query bằng `jsonb_array_elements(...) GROUP BY 1 ORDER BY 1` ở cả hai vòng lặp (kiểm tồn và trừ kho). |
| M2 | Replay trỏ tới `order_id` không còn tồn tại thì `SELECT ... INTO v_existing_order` trả NULL và RPC trả về một object toàn null — im lặng, không lỗi. | Thêm guard `IF NOT FOUND THEN RAISE ... NTIDM`. |
| M3 | Không kiểm `quantity <= 0` trong items → dòng đơn số lượng 0/âm có thể lọt tới CHECK cấp bảng với mã lỗi khó đọc. | Thêm precheck `NTPLD` trước khi khoá products. |

Đã xác nhận KHÔNG phải lỗi (đọc kỹ trước khi kết luận): trigger release ở §6.4 không đệ quy vô hạn
(nested UPDATE không đụng cột `status` nên WHEN clause false); `resolve_no_transfer` gọi release hai
lần nhưng lần hai là no-op nhờ ledger; backfill §8 chạy dưới quyền owner nên không bị guard §5.2 chặn.

## 2. Đã implement

| File | Thay đổi |
|---|---|
| `supabase/migrations/20260906000000_checkout_abuse_protection.sql` | Review + 3 sửa ở trên. Sửa TẠI CHỖ, không tạo migration thứ hai. |
| `features/checkout/services/order.repository.ts` | Thêm `createAtomic()` / `findReplay()` / `transition()` + `translateRpcError()`. **Xoá 151 dòng** của đường hai-write, gồm `client.from("orders").delete()`. Audit `CREATE` chỉ ghi khi `!replayed`. |
| `features/checkout/services/checkout.service.ts` | Replay lookup TRƯỚC pricing; quote snapshot bất biến; một lời gọi RPC; `buildReplayResult()` dựng response từ snapshot bất biến; email chỉ chạy cho đơn mới; xử lý cả race replay xảy ra giữa lookup và RPC. |
| `features/checkout/services/checkout-protection.service.ts` (mới) | CHỈ canonical hash: gộp/sắp dòng, chuẩn hoá email/coupon/tên/`+84`→`0`, loại giá + timestamp + token. Không có limiter/quota — đó là RFC-3. |
| `features/checkout/constants.ts` | `CHECKOUT_DB_ERROR_MAP` (NTCAP/NTIDM/NTVER/NTCPN/NTSTK/NTQTA/NTSTA), `resolveCheckoutProtectionPolicy()`, `isCheckoutEnforcementEnabled()`. |
| `features/checkout/schemas/checkout.schema.ts` | `idempotencyKeySchema` (UUID) + type. |
| `features/checkout/types/index.ts` | `PaymentReviewState`; `replayed?` / `paymentExpiresAt?` / `reviewState?` trên `CreateOrderResult`. |
| `vitest.config.ts`, `package.json` | Project split `unit` / `integration` + script `test:integration`. |
| `tests/integration/checkout-protection.db.test.ts` (mới) | 25 test trên Postgres thật. |
| `tests/integration/fixtures/bootstrap-schema.sql` (mới) | Dựng lại schema cho test. KHÔNG phải migration, không nằm trong `supabase/migrations/`. |

### E2 — enforcement vẫn TẮT

`resolveCheckoutProtectionPolicy()` đọc `CHECKOUT_PROTECTION_ENFORCED`; mặc định `false` →
`bankActiveCap` là sentinel 1.000.000 và `paymentTtlSeconds` là `null`. Cơ chế atomic chạy đủ (và
integration test truyền cap thật để kiểm chứng), nhưng không khách nào bị chặn và không đơn nào có
hạn thanh toán cho tới khi owner bật. `codActiveCap` và `dailyQuota` là `null` cứng — đó là quyết
định ngưỡng của owner, agent không tự chốt.

## 3. Lệnh đã chạy và kết quả THẬT

Baseline (RFC-1, trước mọi thay đổi): 1 failed suite / 64 passed (65), 429/429 test pass — failure
duy nhất là `lib/useAddresses.test.tsx` fail ở import do thiếu Supabase env.

```
$ npm test                     # vitest run --project unit
 Test Files  1 failed | 65 passed (66)
      Tests  459 passed (459)
```
Vẫn ĐÚNG một suite đỏ, vẫn đúng suite cũ đó, 0 test fail. +30 test mới. Không có regression.

```
$ npm run test:integration      # KHÔNG có TEST_DATABASE_URL
 Test Files  1 skipped (1)
      Tests  25 skipped (25)
 EXIT=0
```
E4 đạt: máy không có Postgres không bị đỏ.

```
$ docker run -d --name nutein-rfc2-pg -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=nutein_test -p 55432:5432 postgres:16-alpine
$ TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/nutein_test \
    npx vitest run --project integration --maxWorkers=1
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  4.72s
```

```
$ npx tsc --noEmit
.next/dev/types/validator.ts(244,8): error TS1005: ';' expected.
.next/dev/types/validator.ts(245,1): error TS1128: Declaration or statement expected.
```
Đúng 2 lỗi của baseline, đều trong file generated. Không có lỗi mới.

```
$ npx eslint features/checkout tests/integration vitest.config.ts --max-warnings=0
(exit 0)
```

`npm run check` vẫn KHÔNG dùng được làm gate: nó dừng ở `format:check` với nợ prettier toàn repo
(RFC-1 F5). Đã chạy `prettier --write` trên đúng các file RFC-2 chạm vào, không đụng phần còn lại.

Container `nutein-rfc2-pg` được CỐ Ý để lại đang chạy để EVL có thể chạy lại gate. Dọn bằng
`docker rm -f nutein-rfc2-pg`.

## 4. Bằng chứng cho từng AC

| AC | Bằng chứng |
|---|---|
| AC01 | 50 create đồng thời, mỗi cái một connection riêng → `COUNT(*) = 2`; 2 thành công, 48 thất bại với SQLSTATE `NTCAP` (không phải deadlock). Huỷ một đơn trả lại đúng một slot. |
| AC03 | 20 request đồng thời cùng key → 1 đơn, đúng 1 non-replay. Lost-response retry → cùng `order_id`. Payload đổi cùng key → `NTIDM`. Replay không trừ kho/coupon lần hai. Đơn đã huỷ vẫn replay về đơn cũ. |
| AC04 | Hết hàng → `orders`/`order_items`/ledger/`checkout_requests` đều rỗng, stock nguyên vẹn. Coupon hết lượt → `NTCPN`, `used_count` không đổi. Khai khống số tiền → `NTVER`. |
| AC07 | Đơn 2 dòng cùng `product_id` (3+7) → huỷ hoàn đủ 10. Release lần hai no-op. Coupon trả đúng một lượt. Đơn PAID không bao giờ bị hoàn kho. Confirm trên CANCELLED → `NTSTA`. `expected_version` lệch → `NTSTA`. Claim không PAID/không đổi deadline/không trả slot. |
| AC08 (một phần) | Trên DB test: hai policy bypass đã biến mất, anon/authenticated mất INSERT/UPDATE trên `orders`/`order_items`, PUBLIC/anon/authenticated mất EXECUTE trên RPC. **Chưa** chứng minh trên Supabase đã deploy — đó là ACL probe RFC-1. |

### Chống test xanh rỗng

Hai lỗi trọng tâm đều có test red-before chạy trên database chỉ-bootstrap (trigger cũ còn sống,
chưa apply migration):

- `[red-before] đường hai-write CŨ thực sự làm rò rỉ một lượt coupon` — insert orders → insert
  order_items lỗi → delete orders; `used_count` vẫn là 1 dù đơn đã bị xoá sạch.
- `[red-before] trigger restock CŨ hoàn THIẾU với đơn nhiều dòng cùng product_id` — đơn 3+7 trừ đủ
  10 nhưng huỷ chỉ hoàn lại 3 hoặc 7.

Nếu hai test này không đỏ trên schema cũ thì hai test xanh tương ứng trên schema mới là vô nghĩa.

## 5. Deviation so với plan

| # | Deviation | Lý do |
|---|---|---|
| D1 | Type mới đặt ở `features/checkout/types/index.ts`, không phải `types/index.ts` như Touchpoints ghi. | `types/index.ts` là type dùng chung toàn repo (pagination/sorting); convention của repo là type riêng của feature nằm trong `features/<name>/types/`. Đi theo convention thay vì theo chữ trong bảng. |
| D2 | `replayed` là OPTIONAL trên `CreateOrderResult`. | Bắt buộc sẽ phá 4 consumer đang dựng `CreateOrderResult` bằng tay (page, component, 2 test file). `checkoutService` luôn set. Additive thật. |
| D3 | Thêm `displaySummary` vào snapshot JSONB `shipping_address`. | Plan yêu cầu "response dựng từ immutable order snapshot", nhưng `quantity`/`unitPrice`/`discountPercent` không có cột nào lưu. Nếu tính lại từ catalog thì khách bấm F5 sau khi staff đổi giá sẽ thấy số khác. Dùng đúng cột JSONB sẵn có, cùng cách `couponCode` đã làm — không cần migration mới. |
| D4 | Migration §5.1/§5.2 siết thêm policy `"Staff/Admin update orders"` bằng trigger guard. | Có sẵn trong file chưa review. Giữ lại vì nó cùng họ lỗ hổng F1/F3 (một session STAFF bất kỳ đặt `payment_status='PAID'` thẳng qua PostgREST). Có miễn trừ service_role nên back-office không gãy; nhánh miễn trừ đó là TODO của RFC-3. |
| D5 | Không thêm `lock_timeout`/`statement_timeout` trong RPC dù plan §Kiến trúc đề xuất 2s/5s. | 50 transaction serialize trên cùng một user lock: timeout 2s sẽ gây fail giả trong chính test chứng minh cap. Đây là giá trị config, để RFC-3 đặt ở tầng connection. |
| D6 | `order_payment_events` chặn cả DELETE, nên order không xoá được (cascade sẽ lỗi). | Đúng ý plan ("append-only"). An toàn hiện tại: đường `orders.delete()` duy nhất trong repo vừa bị xoá; grep xác nhận không còn caller nào. Nếu sau này cần xoá đơn thì phải nới trigger có chủ đích. |

## 6. Test infra gaps found

- **Schema test là bản DỰNG LẠI.** `bootstrap-schema.sql` copy DDL từ `init_schema.sql` +
  `20260721...` + `20260724...` để khớp cột/kiểu/CHECK/trigger, nhưng nó không phải schema đã
  deploy. Test chứng minh logic RPC, khoá, atomicity, ledger — KHÔNG chứng minh Supabase production
  giống hệt. Không thể sửa gap này nếu không có staging (RFC-1 known-gap).
- **Không có `auth.uid()` trên Postgres trần**, nên `is_staff_or_admin()` bị stub thành `FALSE`.
  Các test RLS ở đây kiểm GRANT và sự VẮNG MẶT của policy, không kiểm hành vi policy dựa trên danh tính.
- **`npm run check` vẫn không dùng được làm regression gate** cho tới khi nợ prettier toàn repo được
  trả (RFC-1 F5). Hiện phải chạy `lint` / `type-check` / `test` riêng lẻ.
- **Connection pooling khác production.** Test dùng connection trực tiếp; Supabase đi qua PgBouncer.
  Hành vi advisory/row lock ở transaction mode chưa được kiểm chứng.

## 7. Còn lại trước khi RFC-2 được coi là VERIFIED

1. Owner apply migration lên Supabase (thủ công, theo header của file), trong maintenance window —
   code và migration phải cùng lúc, không rolling deploy.
2. Chạy ACL probe RFC-1 trên database thật sau khi apply; ghi kết quả.
3. Chỉ sau đó mới cân nhắc bật `CHECKOUT_PROTECTION_ENFORCED=true`.

Không mục nào trong ba mục trên thuộc phạm vi EXECUTE của RFC-2.

## 8. Không proceed sang RFC-3

Ranh giới được giữ đúng: không đụng `src/middlewares/checkout-rate-limit.middleware.ts`,
`src/security/trusted-client-ip.ts`, CSRF/header trong `app/api/checkout/route.ts`,
`features/admin-orders/**`, hay bất kỳ component UI nào. `orderRepository.transition()` đã sẵn sàng
nhưng chưa có caller — việc nối vào `admin-orders.repository.ts` là RFC-3, đúng như comment trong
chính migration đã ghi.
