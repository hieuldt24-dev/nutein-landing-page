---
name: report:unpaid-order-abuse-protection-rfc3
description: "RFC-3 execute report — checkout limiter fail-closed, trusted IP HMAC, CSRF Origin, account/staff order routes, confirmPayment CANCELLED fix"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-3
---

# RFC-3 — API và throttling (EXECUTE report)

**Date**: 06-09-26
**Phase state**: PLANNED → **CODE DONE → TESTING**. KHÔNG phải VERIFIED.
**Plan**: `unpaid-order-abuse-protection_PLAN_06-09-26.md`

## TL;DR

Lớp HTTP của cơ chế chống spam đã xong: limiter checkout riêng **fail-closed**, IP chỉ đọc từ header
ingress đã khai báo và luôn được HMAC, kiểm Origin chính xác, bốn route mới cho khách và staff, và
`Idempotency-Key` được gửi + đọc nhưng **chưa enforce** đúng cửa sổ tương thích E3.

Lỗi thật mà plan chỉ đích danh đã được sửa và có bằng chứng: `confirmPayment()` trước đây chấp nhận
một đơn **CANCELLED** và đánh dấu PAID. Test red-before tái hiện guard cũ và chứng minh nó chấp
nhận; guard mới từ chối bằng 409 ở cả đường RPC lẫn đường tương thích.

`POST /api/internal/orders/review-expired` **không được implement** — owner chưa chọn scheduler host
(E5). Chưa VERIFIED vì bốn điều kiện ngoài tầm EXECUTE: migration chưa apply, ACL probe chưa chạy,
Redis production chưa có, hành vi header IP của ingress chưa probe.

## 1. Đã implement

| File | Thay đổi |
|---|---|
| `src/middlewares/checkout-rate-limit.middleware.ts` (mới) | Limiter RIÊNG cho checkout. Script Lua `INCR` + `PEXPIRE` (chỉ ở hit đầu) + `PTTL` trong MỘT lệnh. Fail-CLOSED 503 `CHECKOUT_PROTECTION_UNAVAILABLE` khi Redis null/lỗi/reply lạ. 429 `CHECKOUT_RATE_LIMITED` kèm `retryAfterSeconds` = PTTL thật. Client tiêm được (test). |
| `src/security/trusted-client-ip.ts` (mới) | Chỉ tin header khi `TRUSTED_CLIENT_IP_HEADER` được cấu hình; lấy hop CUỐI; canonical IPv4 / IPv4-mapped / IPv6 cắt /64; HMAC-SHA256 bằng `CLIENT_IP_HASH_SECRET`, thiếu secret trả `null` chứ KHÔNG hash trần. |
| `src/security/csrf.ts` (mới) | `assertTrustedOrigin()` — allowlist đúng origin của `APP_BASE_URL`/`NEXT_PUBLIC_APP_URL`; thiếu Origin cũng từ chối; có cờ `enforce` để chạy chế độ chỉ-cảnh-báo (E2). |
| `src/api/read-json-body.ts` (mới) | Đọc body JSON có thể vắng mặt mà không biến POST-không-body thành 500. |
| `app/api/checkout/route.ts` | Origin → giới hạn body 32 KiB → throttle IP → authenticate → throttle account → đọc `Idempotency-Key` → parse → service. Replay trả 200, đơn mới trả 201. |
| `app/api/account/orders/[id]/route.ts` (mới, GET) | Auth + ownership, DTO tối thiểu + QR khi còn thanh toán được, `Cache-Control: no-store`. |
| `app/api/account/orders/[id]/payment-claim/route.ts` (mới, POST) | Auth + ownership + CSRF; gọi `transition('claim_payment')`. Không có logic trạng thái nào trong route. |
| `app/api/account/orders/[id]/cancel/route.ts` (mới, POST) | Tạo yêu cầu hủy; bấm lại khi đã `CANCEL_REQUESTED`/đã hủy → no-op `changed:false`, không gọi RPC lần hai. |
| `app/api/staff/orders/[id]/resolve-payment-review/route.ts` (mới, POST) | STAFF; `no-transfer` → `resolve_no_transfer` (đường DUY NHẤT release), `needs-investigation` → `mark_review_required`; `expectedVersion` + `reason` BẮT BUỘC; evidence vào `order_payment_events.reference`. |
| `features/admin-orders/services/admin-orders.repository.ts` | `confirmPayment()` — guard terminal status mới + chuyển sang `orderRepository.transition()` với `expectedVersion`; đường tương thích khi RPC chưa apply cũng mang guard status trong chính câu UPDATE. |
| `features/admin-orders/schemas/admin-orders.schema.ts` | `resolvePaymentReviewSchema` (strict). |
| `features/account/services/account-order.service.ts` | `getOwnedOrderDetail()` + `allowedActions` + QR theo `canStillPay` + fallback SQLSTATE 42703. |
| `features/account/types/index.ts`, `features/account/schemas/account-order.schema.ts` (mới) | `AccountOrderDetail`, `AccountOrderAction`; schema claim/cancel strict. |
| `features/checkout/constants.ts` | `CHECKOUT_RATE_LIMIT` (10/10 phút account, 60/10 phút IP). |
| `features/checkout/services/order.repository.ts` | `CheckoutRpcUnavailableError` + nhận diện PGRST202/42883 để caller phân biệt "RPC từ chối" với "RPC chưa có". |
| `src/api/response.ts`, `src/middlewares/error-handler.middleware.ts` | `errorResponse` nhận headers; error-handler tự gắn `Retry-After` khi `details.retryAfterSeconds` có mặt. |
| `lib/useCheckoutSubmit.ts` | Sinh + GIỮ idempotency key theo hash payload trong `sessionStorage`; chỉ đổi khi business payload đổi thật. |
| `.env.example` | `CHECKOUT_PROTECTION_ENFORCED`, `TRUSTED_CLIENT_IP_HEADER`, `CLIENT_IP_HASH_SECRET`, `TEST_REDIS_URL` kèm giải thích. |

### E2 — enforcement vẫn TẮT

Cả limiter, CSRF và bucket IP đều gate bằng `isCheckoutEnforcementEnabled()` (mặc định `false`).
Khi tắt: Origin lạ chỉ ghi log, vượt hạn mức chỉ ghi log, Redis chết không chặn ai. Test bật cờ để
chứng minh cơ chế. Không có giá trị production nào bị đổi. `codActiveCap` giữ nguyên `null` (AC14).

## 2. Lệnh đã chạy và kết quả THẬT

```
$ npm test                     # vitest run --project unit
 Test Files  1 failed | 73 passed (74)
      Tests  548 passed (548)
```
Baseline giữ nguyên: ĐÚNG một suite đỏ và vẫn là suite cũ `lib/useAddresses.test.tsx`
(`@supabase/ssr: Your project's URL and API key are required`), 0 test fail. RFC-2 kết thúc ở
459 test → +89 test mới, 0 regression.

```
$ docker run -d --name nutein-rfc3-redis -p 56379:6379 redis:7-alpine
$ TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/nutein_test \
  TEST_REDIS_URL=redis://localhost:56379 \
  npx vitest run --project integration --maxWorkers=1
 Test Files  2 passed (2)
      Tests  33 passed (33)
   Duration  9.37s
```
(25 test DB của RFC-2 + 8 test Redis mới; DB dùng lại container `nutein-rfc2-pg` sẵn có.)

```
$ npm run test:integration      # KHÔNG có TEST_DATABASE_URL / TEST_REDIS_URL
 Test Files  2 skipped (2)
      Tests  33 skipped (33)
```

```
$ npx tsc --noEmit
.next/dev/types/validator.ts(244,8): error TS1005: ';' expected.
.next/dev/types/validator.ts(245,1): error TS1128: Declaration or statement expected.
```
Đúng 2 lỗi baseline, đều trong file generated. Không lỗi mới.

```
$ npx eslint app/api features/checkout features/account features/admin-orders \
    src/middlewares src/security src/api lib/useCheckoutSubmit.ts \
    lib/useCheckoutSubmit.test.ts tests/integration --max-warnings=0
ESLINT EXIT=0
```
Lưu ý: `npx eslint src` (toàn bộ) vẫn đỏ 44 lỗi, tất cả trong `src/components/charts/**` — nợ
có sẵn, không do RFC-3 chạm vào.

`npm run check` vẫn KHÔNG dùng được làm gate: dừng ở `format:check` vì nợ prettier toàn repo
(RFC-1 F5). Đã chạy `prettier --write` trên đúng các file RFC-3 chạm vào.

Container để lại cho EVL: `nutein-rfc3-redis` (Redis, cổng 56379) và `nutein-rfc2-pg` (Postgres,
cổng 55432). Dọn: `docker rm -f nutein-rfc3-redis nutein-rfc2-pg`.

## 3. Bằng chứng cho từng AC

| AC | Bằng chứng |
|---|---|
| AC02 | **Redis thật**: TTL được đặt ngay ở hit đầu (`PTTL > 0`); request bị chặn KHÔNG gia hạn TTL (cửa sổ cố định, không thành cấm vĩnh viễn); `Retry-After` giảm dần theo thời gian thật và luôn ≤ cửa sổ; hết cửa sổ thì bucket reset; 50 request song song đếm ĐÚNG 50 (không mất hit → INCR+PEXPIRE atomic); account/ip là hai bucket độc lập; Redis không kết nối được → **503**, không fail-open. **Route**: vượt hạn mức → 429 kèm header `Retry-After: 42` lấy từ PTTL (không phải hằng số); Redis lỗi → 503 và `createOrder` KHÔNG được gọi. |
| AC08 (IDOR) | `getOwnedOrderDetail` khẳng định đúng thứ tự `.eq("id")` rồi `.eq("user_id")` trong CÙNG một query; không khớp → **404 NOT_FOUND** (không phải 403). Claim/cancel gọi hàm này trước khi chạm RPC — đơn của người khác → 404 và `transition` không hề được gọi. |
| AC08 (CSRF) | Origin lạ, Origin thiếu, và subdomain của origin hợp lệ đều → 403 `CSRF_ORIGIN_REJECTED`; ở route staff/claim thì `authenticate` còn chưa được gọi. Enforcement tắt → chỉ cảnh báo (E2). |
| AC08 (forged IP) | Header không được khai báo trusted → không dùng làm căn cứ chặn; hop ĐẦU của `x-forwarded-for` (do client gửi) bị bỏ qua, chỉ lấy hop cuối; header lạ do client bịa không được đọc; key bucket không bao giờ chứa IP thô. |
| AC03/AC10 | `resolveIdempotencyKey`: cùng payload → cùng key kể cả sau reload; thứ tự field khác nhau vẫn cùng key; payload đổi thật → key mới; `sessionStorage` hỏng vẫn trả key hợp lệ, không chặn đặt hàng. |
| AC05/AC06 | Claim đi đúng `action: 'claim_payment'`, `actorType: 'CUSTOMER'`; payload gửi RPC không chứa `PAID`/`payment_expires_at`/`release`; response sau claim vẫn `paymentStatus: UNPAID`, `reviewState: PAYMENT_CLAIMED`; claim lần hai → 409. Cancel dừng ở `CANCEL_REQUESTED`, không nhánh nào gọi `resolve_no_transfer`. Staff `needs-investigation` không release; không nhánh nào của route review đặt PAID. Ba bất biến gốc đã được chứng minh ở tầng DB từ RFC-2. |
| AC09 | **Red-before**: test tái hiện guard CŨ (chỉ `payment_method` + `payment_status`) và khẳng định nó **chấp nhận** đơn CANCELLED — nếu khẳng định này sai thì test xanh bên dưới là rỗng. **Green-after**: `confirmPayment()` trên đơn CANCELLED → 409 `ORDER_STATE_CONFLICT`, `transition` KHÔNG được gọi, không có UPDATE nào chạy; RETURNED cũng bị từ chối. Đường tương thích khẳng định `.not("status","in","(CANCELLED,RETURNED)")` nằm TRONG câu UPDATE (đơn có thể bị hủy giữa lúc đọc và lúc ghi). Tầng DB đã có `NTSTA` từ RFC-2. |
| AC11/AC12 | `codActiveCap` vẫn `null` — không có cap COD nào được thêm. Đơn legacy `PAYOS` đọc được qua route chi tiết mới: không QR, `stateVersion` fallback 0, `reviewState` null, mapper không vỡ. Đơn thiếu cột RFC-2 (SQLSTATE 42703) có đường đọc dự phòng, không 500. |

### Chống test xanh rỗng

- AC09 có cặp red-before/green-after như RFC-2 đã làm với coupon leak và restock SUM.
- Test limiter chạy trên **Redis thật**, không phải mock: mock chứng minh nhánh code, không chứng
  minh script Lua chạy được, TTL có thật, hay 50 lệnh song song không mất hit.
- Các route test khẳng định **side effect KHÔNG xảy ra** (`transition`/`createOrder` không được gọi),
  không chỉ khẳng định status code.

## 4. Deviation so với plan

| # | Deviation | Lý do |
|---|---|---|
| D1 | Type mới đặt ở `features/account/types/index.ts`, schema mới ở `features/account/schemas/`, không phải `types/index.ts` repo-wide. | Tiếp tục deviation D1 của RFC-2 cho nhất quán: type riêng của feature nằm trong feature. |
| D2 | Thêm `src/security/csrf.ts` và `src/api/read-json-body.ts` — hai file Touchpoints không liệt kê. | Touchpoints ghi "CSRF" như một phần công việc của route. Nhét kiểm Origin vào từng route sẽ nhân bản logic bảo mật ở 5 chỗ; `read-json-body` tránh việc POST-không-body thành 500 ở cả ba route có body optional. |
| D3 | Sửa `errorResponse` + `error-handler.middleware.ts` để gắn `Retry-After`. | `Retry-After` là header HTTP chuẩn, không thể để trong body mà vẫn đúng contract. Thay đổi additive: chỉ kích hoạt khi `details.retryAfterSeconds` là số dương, mọi lỗi hiện hữu không đổi hành vi. |
| D4 | `confirmPayment()` có đường tương thích khi RPC chưa tồn tại, thay vì chỉ gọi `transition()`. | Migration RFC-2 **chưa được apply**. Nếu chỉ gọi RPC thì back-office gãy ngay khi deploy code RFC-3 trước cutover. Cả hai đường đều mang guard AC09 — nếu chỉ vá đường RPC thì lỗi vẫn sống nguyên trong cửa sổ trước cutover. |
| D5 | Giới hạn body dựa trên `Content-Length` thay vì đọc-rồi-đếm. | Cắt trước khi đọc thân request là điểm duy nhất còn tiết kiệm được chi phí. `createOrderRequestSchema` (tối đa 10 dòng, các field đều có max) mới là ràng buộc thật; header chỉ là hàng rào rẻ tiền phía trước. |
| D6 | `CheckoutProtectionUnavailableError` / `CheckoutRateLimitedError` / `CsrfOriginError` phải tự gọi `Object.setPrototypeOf` trong constructor. | `AppError` ép prototype về `AppError.prototype`, làm mọi `instanceof` với lớp con trả false. Sửa cục bộ ở ba lớp mới thay vì đổi `AppError` — đổi lớp cha là thay đổi ngữ nghĩa dùng chung, ngoài phạm vi RFC-3. Đã ghi lại như một nợ nhỏ. |
| D7 | Bucket IP chỉ CHẶN khi `TRUSTED_CLIENT_IP_HEADER` được cấu hình; chưa cấu hình thì chỉ đo. | Plan §Security: "chỉ tin header ingress xác nhận đã overwrite". Chặn theo header client giả mạo được nghĩa là chặn nhầm khách thật trong khi bot chỉ cần đổi header. |

## 5. Test infra gaps found

- **Không có test HTTP end-to-end thật.** Route test gọi thẳng hàm `POST` với `NextRequest` dựng
  tay. Nó chứng minh logic handler, KHÔNG chứng minh Next.js routing, middleware `proxy.ts`, hay
  hành vi của ingress. `Retry-After` được khẳng định trên đối tượng `NextResponse`, chưa phải trên
  response đi qua dây thật.
- **CSRF chưa được kiểm với browser thật.** Test đặt header `Origin` bằng tay. Việc browser thật có
  gửi Origin trong mọi kịch bản của app hay không (đặc biệt sau redirect OAuth) chưa được xác minh —
  đây chính là rủi ro khi bật `CHECKOUT_PROTECTION_ENFORCED`.
- **Hành vi ingress với header IP vẫn chưa probe** (known-gap RFC-1). Cho tới lúc đó throttle theo IP
  là tín hiệu mềm; hạn mức 60/10 phút chưa từng chạy với NAT thật.
- **Redis test là instance trần**, không TLS, không auth, không cluster. Không chứng minh Redis
  production (chưa tồn tại) chịu được tải hay reachable qua TLS.
- **`npm run check` vẫn không dùng được làm regression gate** cho tới khi trả nợ prettier toàn repo.
- **Nợ nhỏ mới**: `AppError` phá prototype của lớp con (D6). Nên sửa ở lớp cha bằng
  `new.target.prototype` trong một task riêng.

## 6. Còn lại trước khi RFC-3 được coi là VERIFIED

1. Owner apply migration RFC-2 lên Supabase — tới lúc đó `transition()` chạy đường tương thích và
   các route mới chỉ hoạt động một phần (cột `payment_review_state`/`state_version` chưa tồn tại).
2. Chạy ACL probe RFC-1 trên database thật. **AC08 chưa được chứng minh end-to-end trong production**
   — RFC-3 chỉ chứng minh các kiểm tra ở tầng code (ownership query, CSRF, IDOR) bằng test.
3. Provision Redis production TRƯỚC khi bật `CHECKOUT_PROTECTION_ENFORCED=true`. Limiter fail-closed
   nghĩa là Redis chết = checkout chết.
4. Probe hành vi ghi đè header IP của ingress, rồi mới đặt `TRUSTED_CLIENT_IP_HEADER` và
   `CLIENT_IP_HASH_SECRET`.
5. Cửa sổ tương thích `Idempotency-Key`: cần ≥24h log cho thấy 0 request thiếu header trước khi bàn
   tới enforce 400/409. **Không thể xác nhận trong phiên này.**

Không mục nào trong năm mục trên thuộc phạm vi EXECUTE của RFC-3.

## 7. Hoãn có chủ đích (E5) — không phải bỏ sót

`POST /api/internal/orders/review-expired` KHÔNG được implement. Owner chưa chọn scheduler host
(platform cron / external scheduler / manual staff sweep), và RFC-1 đã gate RFC-3 trên quyết định đó.
Một route không có caller không gate được AC05, và mở thêm một bề mặt có secret mà không ai gọi chỉ
làm tăng rủi ro. Hệ quả: sub-case "missing cron secret" của AC08 KHÔNG được kiểm trong RFC-3, và
AC05 (thi hành hết hạn theo lịch) vẫn là known-gap D nguyên vẹn từ validate-contract.

Ngưỡng AC14 (cap COD, trần reserve toàn cửa hàng, review SLA, audit retention) cũng không được tự
chốt: `codActiveCap` vẫn `null`.

## 8. Không proceed sang RFC-4

Ranh giới được giữ đúng. KHÔNG đụng: `components/checkout/**`, `components/account/**`,
`components/admin/orders/**`, `app/checkout/success/page.tsx`, hay bất kỳ trang nào. Không làm
cutover/rollback/benchmark (RFC-5). Thay đổi client duy nhất là `lib/useCheckoutSubmit.ts` — được
Touchpoints xếp vào RFC-3 và bắt buộc phải đi trước theo cửa sổ tương thích E3 (client gửi header
TRƯỚC, server enforce sau); nó không đổi UI nào.

Route chi tiết đơn và các action đã sẵn sàng nhưng CHƯA có UI gọi — việc nối vào
`AccountOrderDetail`/`CheckoutSuccessView` là RFC-4.
