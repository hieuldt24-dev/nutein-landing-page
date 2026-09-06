---
name: plan:unpaid-order-abuse-protection
description: "Chống spam đơn BANK_TRANSFER chưa chuyển khoản — cap đơn giữ chỗ, idempotency, atomic reservation, expiry review"
date: 06-09-26
feature: checkout
---

# Chống spam đặt hàng chưa chuyển khoản

**Date**: 06-09-26
**Status**: RFC-1 IN PROGRESS (probe pending owner) · **RFC-2 TESTING (EVL PASS)** ·
**RFC-3 TESTING (EVL PASS)** · **RFC-4 TESTING (EVL PASS)** · **RFC-5 CODE DONE, một phần**
(report + runbook + evidence pack viết xong; EVL độc lập CHƯA chạy; checklist bên dưới CHƯA tick).
**5/5 RFC đã code xong. Không RFC nào VERIFIED. Chưa commit gì.**

RFC-5 chạy `npm run build` lần đầu tiên trong cả chương trình và tự phát hiện + tự sửa 3 khiếm
khuyết chặn mà RFC-2/3/4 bỏ lọt: (1) file generated `.next/dev/types/validator.ts` hỏng khiến
`tsc --noEmit` ngừng kiểm tra ngữ nghĩa suốt RFC-2/3/4 — dọn xong lộ 11 lỗi thật, đã sửa, `tsc`
giờ 0 lỗi; (2) migration RFC-2 sẽ ABORT trên bất kỳ DB nào có đơn CANCELLED (lỗi
`pg_catalog.current_user`) — đã sửa; (3) migration không chạy lại được lần hai (thiếu
`DROP POLICY IF EXISTS`) — đã sửa. Diễn tập cutover/backfill/rollback cục bộ (31 test mới, dataset
legacy cố tình khó) PASS và phát hiện thêm 2 chênh lệch dữ liệu THẬT do trigger cũ để lại (không
tự sửa, đã đưa vào runbook cho owner đối soát). Rà quét log/secret: không tìm thấy rò rỉ.
Chi tiết: `unpaid-order-abuse-protection_RFC5-REPORT_06-09-26.md`,
`unpaid-order-abuse-protection_RUNBOOK_06-09-26.md`.

**Sự kiện quan trọng ngoài luồng EXECUTE**: owner đã tự tay apply migration
(`supabase/migrations/20260906000000_checkout_abuse_protection.sql`) lên Supabase **production
thật** trong lúc RFC-5 đang chạy — trước khi code RFC-2/3/4 được commit/deploy. Đã xác minh qua 3
query: bản migration owner chạy KHÔNG dính bug `pg_catalog.current_user` (đã fix), 0 đơn rơi vào
cửa sổ lệch pha (không có đơn nào thiếu ledger row), và app hiện chưa có đường deploy (chạy local)
nên chưa có khách thật bị ảnh hưởng bởi lệch pha schema/code. Xem `results.tsv` cycle 9. Việc còn
lại: commit + deploy code RFC-2/3/4 sớm để đóng cửa sổ, sau đó chạy 2 truy vấn đối soát R5/R6 mà
RFC-5 phát hiện (runbook đã có sẵn câu SQL).

RFC-4 code hoàn tất (UI khách + staff trên các route RFC-3), +62 test, 0 regression. **CHƯA
VERIFIED**: gate của RFC-4 là human authenticated walkthrough có người xác nhận tên tuổi và
screenshot — chưa thực hiện, và không agent nào thực hiện được (Google-OAuth-only).
RFC-2 code hoàn tất và có bằng chứng DB thật (25/25 integration test trên Postgres disposable).
RFC-3 code hoàn tất: limiter fail-closed + trusted IP HMAC + CSRF Origin + 4 route mới + sửa lỗi
`confirmPayment()` cho phép confirm đơn CANCELLED; bằng chứng gồm 8/8 test trên Redis THẬT và
regression test có red-before. `POST /api/internal/orders/review-expired` **bị hoãn có chủ đích**
(E5 — owner chưa chọn scheduler host).
RFC-2/3/4 đều **CHƯA VERIFIED** (ACL probe RFC-1 trên DB thật chưa chạy — nay đã CÓ THỂ chạy vì
migration đã lên production; Redis production chưa provision; ingress IP header chưa probe).
Không có enforcement nào được bật (`CHECKOUT_PROTECTION_ENFORCED` mặc định `false`).
**Complexity**: COMPLEX — một feature tích hợp, một luồng triển khai với các bước phụ thuộc.
**Feature**: checkout
**Owner**: người vận hành Nutein duyệt chính sách; EXECUTE implement sau VALIDATE.

## Overview

Giới hạn đơn giữ chỗ, chống gửi lặp và đưa đơn quá hạn vào đối soát có kiểm soát.
Database là nơi bảo đảm số đơn, tồn kho và coupon nhất quán; Redis giảm tải request.
Chuyển khoản vẫn dùng VietQR và xác nhận thủ công, không thêm gateway/webhook.

Điểm cần duyệt rõ: **hạn thanh toán không đồng nghĩa đã xác minh khách chưa trả tiền**.
Mặc định đề xuất: quá hạn thì ẩn QR và vào hàng đợi đối soát; chỉ giải phóng hàng/coupon
khi staff xác nhận chưa nhận tiền. Cơ chế này không bảo đảm tồn được giải phóng sau đúng
một TTL cố định nếu staff chậm xử lý. Không thể vừa bảo đảm tự hoàn kho đúng giờ vừa bảo
đảm tuyệt đối không hủy nhầm giao dịch chuyển khoản khi không có nguồn dữ liệu ngân hàng.

Đây là requirements và lựa chọn kỹ thuật đề xuất trong PLAN, chưa phải SPEC đã khóa.
Các ngưỡng có thể chỉnh tại VALIDATE; phạm vi được người dùng yêu cầu gồm đủ bốn lớp bảo vệ.

## Context and Goals

Nguồn đã đọc: `process/context/all-context.md`, `payment/all-payment.md`,
`database/all-database.md`, `auth/all-auth.md`, `tests/all-tests.md` dưới `process/context/`.
Payment/database/auth hiện ghi rõ chưa có tài liệu sâu hơn; không giả định ví dụ router là file thật.
Nguồn kỹ thuật đối chiếu trực tiếp khi lập kế hoạch:

- `app/api/checkout/route.ts`: authenticate + parse + create; chưa có chống spam.
- `features/checkout/services/checkout.service.ts`: giá/coupon được tính server; precheck kho; email sau response.
- `features/checkout/services/order.repository.ts`: ghi orders và order_items bằng hai request;
  lỗi items thì xóa order bù trừ; không phải transaction đầy đủ.
- `src/middlewares/rate-limit.middleware.ts`: Redis fail-open; đọc header IP trực tiếp; INCR/EXPIRE tách rời.
- `supabase/migrations/20260724000000_reserve_stock_on_order_create.sql`: reserve theo items;
  restock UPDATE FROM chưa SUM các dòng cùng product, cần sửa để hoàn đúng nhiều gói.
- `supabase/migrations/20260718000000_init_schema.sql`: coupon dùng trigger lúc insert;
  phải đối chiếu toàn bộ trigger/policy thực tế trước chuyển quyền quản lý reservation.
- `features/admin-orders/services/admin-orders.repository.ts`: confirmPayment cập nhật UNPAID → PAID;
  cần guard status và dùng chung cơ chế khóa với cancel, claim, expiry.
- `features/account/services/account-order.service.ts`, `lib/useCheckoutSubmit.ts` và UI checkout/account:
  cần bổ sung đọc trạng thái thật, tiếp tục thanh toán và yêu cầu hủy đơn của chính khách.

Chỉ xác minh repository; chưa khẳng định schema deploy, ACL, scheduler hoặc Redis production hiện hữu.
Không dùng Prisma dù dependency có mặt: data layer hiện là Supabase + SQL.

## Acceptance Criteria

| ID | Yêu cầu nghiệm thu |
|---|---|
| AC01 | Tài khoản có tối đa 2 đơn BANK_TRANSFER đang giữ chỗ, gồm awaiting/claimed/review; 50 create đồng thời không vượt 2 |
| AC02 | Account và trusted-IP được throttle độc lập; 429 có Retry-After; Redis lỗi không tạo khe hở bỏ toàn bộ bảo vệ |
| AC03 | Cùng user + idempotency key + payload trả cùng order, kể cả mất response; đổi payload trả 409; không lặp coupon/stock/email dispatch |
| AC04 | Create ghi order/items/reservation/coupon/key trong một transaction; bất kỳ lỗi nào rollback toàn bộ |
| AC05 | Hạn thanh toán lưu bằng giờ DB; quá hạn chuyển review, không tự PAID và không tự cancel chỉ vì staff chưa xác nhận |
| AC06 | Claim chỉ là lời khai; không tăng hạn vô hạn, không trả slot; cancel/release cần đối soát và audit |
| AC07 | Cancel hợp lệ trả đúng tổng units và một lượt coupon đúng một lần; confirm/cancel/worker race có một kết quả nhất quán |
| AC08 | Khách chỉ xem/thao tác đơn của mình; USER không gọi RPC đặc quyền; staff/cron bị kiểm quyền rõ ràng |
| AC09 | Unpaid bank order không thể PROCESSING/SHIPPED; paid/cancelled không bị worker hoàn kho; late transfer có quy trình riêng |
| AC10 | UI còn giỏ khi bị chặn, dẫn về tối đa 2 đơn cũ; reload/retry phản ánh trạng thái server và giữ key hợp lệ |
| AC11 | COD có throttle + idempotency + atomic persistence; chính sách cap riêng và test hồi quy COD/legacy PAYOS |
| AC12 | Migration có cutoff legacy, dry-run, reconciliation; rollback không hồi sinh write path dễ sai hoặc hoàn kho hai lần |
| AC13 | Có số đo latency/lock/queue lag; worker có batch/index; log không chứa raw IP, JWT hay chứng từ ngân hàng |
| AC14 | Global stock exposure và multi-account abuse có giới hạn dự phòng; không tuyên bố cap tài khoản chặn toàn bộ bot |

## Chính sách đề xuất cần chốt tại VALIDATE

| Chính sách | Mặc định đề xuất | Lý do / giới hạn |
|---|---|---|
| Bank active cap | 2/user | Count mọi unpaid bank order chưa release/terminal, không chỉ status PENDING |
| COD active cap | 2/user với PENDING/PROCESSING | Chính sách bổ sung đề xuất để tránh chuyển sang COD né cap; duyệt trước bật |
| Account request limit | 10 POST checkout / 10 phút | Bao gồm replay; không tính các lần poll vào chung bucket |
| IP request limit | 60 POST checkout / 10 phút | Cao hơn account do NAT; trusted proxy bắt buộc |
| Account new-order quota | 5 create thành công / 24 giờ, mọi method | Chặn tạo-hủy xoay vòng; replay không tiêu thêm quota |
| Hạn chuyển tiền | 30 phút từ created_at | Hiển thị giờ hết hạn; không phụ thuộc đồng hồ trình duyệt |
| Review SLA | 4 giờ trong giờ làm việc; ca mở cửa tiếp theo ngoài giờ | Cần người trực và lịch thật trước launch; không hứa 24/7 |
| Claim | Một claim/user/order; sửa chú thích có audit, không đổi deadline | Không được tự gia hạn hoặc giải phóng slot |
| Worker | Mỗi 1 phút, batch 100, tối đa 5 batch/lần | Có thể điều chỉnh sau benchmark |
| Request body | 32 KiB; key UUID; tối đa 20 dòng chuẩn hóa | Đối chiếu schema hiện có, giữ giới hạn units đang áp dụng |
| Replay metadata | Giữ gắn order suốt vòng đời order | Không xóa key sau 24h rồi cho retry tạo đơn mới |
| Dữ liệu rate limit | TTL theo window; event vận hành 30 ngày | Chính sách lưu audit nghiệp vụ tách riêng, chốt với owner |

Account cap là cơ chế chính; IP là tín hiệu phụ vì NAT, VPN và IPv6 rotation.
Đề xuất hạn tổng units chưa trả theo user và trần reserve toàn cửa hàng cấu hình bằng số units.
Không tự chọn số units khi chưa biết tồn thực tế; rollout guard ở trạng thái OFF cho tới khi
owner đặt ngưỡng dựa trên snapshot tồn và nhu cầu thật. AC14 không đạt nếu bỏ qua quyết định này.
Khi queue quá SLA hoặc unpaid-reserved units chạm trần: dừng nhận reservation mới,
vẫn cho xem đơn/claim/đối soát; không tự hủy đơn cũ để làm đẹp chỉ số.

## Kiến trúc và bất biến

### Luồng tạo đơn

1. Giới hạn body, xác minh Origin/CSRF, throttle IP từ ingress đáng tin cậy.
2. Xác thực app JWT và tài khoản chưa bị khóa; throttle account; parse schema/key.
3. Chuẩn hóa request và hash business payload; lookup idempotency của user trước precheck kho/giá.
4. Replay hợp lệ trả snapshot và trạng thái hiện tại của cùng order, không chạy lại pricing hay gửi email.
5. Request mới: lấy catalog/coupon server; tạo quote snapshot immutable cho request, không dựa mutable module cache.
6. Gọi RPC atomic duy nhất; RPC kiểm tra lại key dưới lock trước cap và toàn bộ mutation.
7. RPC khóa user, kiểm tài khoản/quota/cap; khóa coupon rồi products theo ID tăng dần;
   đối chiếu quote version/giá hiện tại, coupon active/expiry/minimum/usage và stock.
8. Ghi order/items, reserve kho và coupon, durable key, audit event; commit hoặc rollback toàn bộ.
9. Response giữ contract cũ và thêm deadline/actions/replayed; side effect sau commit chỉ cho newlyCreated.

RPC có thể nhận số tiền đã tính từ trusted server theo kiến trúc hiện tại, nhưng phải kiểm
quote version và giới hạn số tiền ở DB để thay đổi giá/coupon giữa hai bước không gây sai giá.
Không nhận userId, total, role, paid hoặc deadline từ JSON của browser làm nguồn tin cậy.
Không nhân đôi logic discount tùy ý: định nghĩa snapshot/version và golden tests từ pricing hiện có.

### Khóa và quyền ghi

- Dùng row lock trên users cho mọi create và transition ảnh hưởng slot; chỉ khóa theo userId
  đã xác thực/truy ra từ order. Kiểm user.is_deleted ngay trong RPC.
- Thứ tự chung: user → idempotency/order → coupon → product IDs tăng dần.
- Confirm/claim/cancel lấy userId bằng đọc ban đầu, rồi khóa user trước khóa order và đọc lại điều kiện.
- Worker không giữ order lock trước user lock. Scan ID ứng viên không khóa rồi gọi transition từng order;
  transition recheck status/deadline sau khóa. Không dùng SKIP LOCKED order-first trái thứ tự.
- Account count dùng indexed predicate và user lock; không dùng SELECT COUNT rồi INSERT tách transaction.
- Mọi đường customer/staff/cron và direct authenticated DB mutation phải bị chặn hoặc đi qua invariant.
- Timeout lock đề xuất 2s, statement 5s; retry tối đa 2 lần với jitter cho deadlock/serialization,
  giữ nguyên idempotency key. Timeout response không có nghĩa rollback: tra key trước retry mới.

### Vòng đời chuyển khoản

| Tình trạng | Sự kiện hợp lệ | Kết quả và reservation |
|---|---|---|
| AWAITING_TRANSFER | Hết payment_expires_at | REVIEW_REQUIRED, vẫn giữ kho/coupon/slot, ẩn QR |
| AWAITING_TRANSFER | Khách bấm đã chuyển | PAYMENT_CLAIMED, giữ nguyên deadline và tài nguyên |
| PAYMENT_CLAIMED | Đến hạn review / quá deadline | REVIEW_REQUIRED, claim được giữ lại trong audit |
| Bất kỳ trạng thái chưa trả đang giữ chỗ | Staff đối chiếu nhận đủ tiền | PAID + CONFIRMED; không hoàn kho/coupon; giải phóng bank slot |
| Chưa trả, chưa fulfil | Customer yêu cầu hủy | CANCEL_REQUESTED/review; không release tức thì |
| Review/cancel requested | Staff xác minh chưa nhận tiền | CANCELLED + RELEASED atomically; trả kho/coupon và slot |
| CANCELLED/RELEASED | Báo có tiền đến muộn | LATE_TRANSFER_REVIEW; không hồi sinh đơn hoặc trừ kho tự động |
| PAID | Worker/claim/cancel yêu cầu | Reject hoặc trả trạng thái hiện tại, không downgrade |

Sử dụng order status hiện có cho fulfilment; thêm payment-review state riêng, không gán
EXPIRED vào enum hiện hữu mà chưa cập nhật mọi consumer. `payment_status` vẫn UNPAID/PAID.
Staff confirm phải kiểm bank method, order chưa terminal, reservation còn hợp lệ và amount khớp.
Confirm bank payment không tự chuyển PROCESSING; fulfillment transition riêng phải guard PAID.
COD giữ quy tắc đánh dấu PAID khi giao thành công hiện hữu, không áp bank payment deadline.

Đối soát chưa nhận tiền phải lưu staffId, checkedAt, cửa sổ sao kê đã kiểm, lý do và tham chiếu
nghiệp vụ; không coi checkbox/ảnh chuyển khoản của khách là chứng cứ ngân hàng.
Tại thời điểm hủy vẫn có thể xuất hiện chuyển khoản đến sau; staff tạo case late-transfer,
đối chiếu ngân hàng rồi liên hệ hoàn tiền hoặc tạo đơn thay thế có đồng ý của khách và kiểm tồn mới.
Không tự refund, không đánh dấu PAID cho đơn đã release rồi tiếp tục giao hàng.
Khách báo chuyển thiếu/thừa/sai nội dung cũng vào review; chưa có tự ghép transaction.

## Public Contracts

### API

| Endpoint | Contract đề xuất |
|---|---|
| `POST /api/checkout` | Bắt buộc `Idempotency-Key`; input business cũ; 201 mới / 200 replay; thêm paymentExpiresAt, reviewState, allowedActions |
| `GET /api/account/orders/[id]` (mới) | Auth + ownership; trả DTO tối thiểu + QR khi còn được thanh toán; no-store |
| `POST /api/account/orders/[id]/payment-claim` (mới) | Auth + ownership + CSRF; một claim, timestamp/amount/reference có giới hạn; không upload file ở V1 |
| `POST /api/account/orders/[id]/cancel` (mới) | Tạo yêu cầu hủy, không hứa đã hoàn kho; thao tác lặp idempotent |
| `POST /api/staff/orders/[id]/confirm-payment` | Dùng transition RPC, expectedVersion, reference/amount, audit; kiểm quyền staff hiện tại |
| `POST /api/staff/orders/[id]/resolve-payment-review` (mới) | outcome=no-transfer/needs-investigation; evidence metadata; expectedVersion; no-transfer mới cho release |
| `POST /api/internal/orders/review-expired` (mới) | Chỉ scheduler secret, không cookie user; chuyển review theo batch; không hủy hàng loạt |

409 `UNPAID_ORDER_LIMIT`: trả count, limit và link/ID chỉ những đơn của user hiện tại.
409 `IDEMPOTENCY_CONFLICT`, `ORDER_STATE_CONFLICT`, `PRICE_CHANGED`; 429 `CHECKOUT_RATE_LIMITED`;
503 `CHECKOUT_PROTECTION_UNAVAILABLE`; 401/403/404 theo conventions, không lộ đơn của user khác.
`Retry-After` là giây thực của bucket; 409 cap hướng dẫn xử lý đơn cũ, không mời retry liên tục.
Tất cả state-changing routes dùng Zod strict/whitelist; response error không chứa SQL/secret.

### Idempotency

- Scope `(user_id, key)` unique; hash SHA-256 của payload canonical có version.
- Canonical hóa thứ tự lines, gộp trùng variant, coupon/email normalization, trim các field;
  include buyer/address/note/method/shipping; không include giá hiện tại, timestamp hoặc token.
- Browser tạo UUID khi bắt đầu submit; giữ cùng key cho retry network/token refresh/reload.
- Chỉ đổi key khi đổi business payload hoặc khách chủ động bắt đầu đơn mới sau kết quả xác định.
- Không tạo key mới khi nhận timeout. Canceled/expired replay vẫn trỏ về đơn cũ.
- Durable row chỉ chứa hash/orderId/version/createdAt; response dựng từ immutable order snapshot.
- Không lưu snapshot đầy PII lần thứ hai; immutable receipt có thể dùng snapshot hiện hữu mở rộng.
- Email invocation chỉ từ newlyCreated; crash sau commit có thể thiếu email theo best-effort hiện tại.
  Không tuyên bố exactly-once email delivery; outbox bền vững là follow-up nếu owner yêu cầu bảo đảm gửi.

### Schema đề xuất

| Đối tượng | Thay đổi |
|---|---|
| orders | protection_version, payment_expires_at, payment_review_state, review_due_at, state_version, cancellation_reason, released_at |
| checkout_requests (mới) | user_id, idempotency_key, request_hash, hash_version, order_id, created_at; unique(user_id,key), FK order |
| order_resource_reservations (mới) | order_id PK, stock_state, coupon_state, coupon_id, reserved_at, released_at; một ledger/order |
| order_payment_events (mới) | order_id, actor_id/type, event_type, old/new state, reason, checked_at, reference metadata; append-only |
| checkout_daily_quota (mới) | user_id + UTC day PK, count; atomic successful-create quota kể cả COD |
| orders indexes | partial(user_id) cho active unpaid BANK_TRANSFER; (review_due_at,id) cho due review; account pagination index hiện hữu kiểm lại |

Stock ledger phải phân biệt reserve đang giữ và hàng đã giao: PAID không hoàn kho;
CANCELLED chưa giao trả reserve; RETURNED đã giao restock một lần theo quy tắc trả hàng hiện hữu.
Khi chuyển quyền stock/coupon từ triggers cũ sang RPC/ledger, thay trigger trong cùng migration
và chứng minh không có giai đoạn vừa trigger vừa RPC cùng trừ/hoàn.
Aggregate `SUM(order_items.quantity) GROUP BY product_id` trước reserve/release.
Coupon `used_count` V1 giữ nghĩa reserved + consumed để tương thích dashboard; hủy trước fulfil
trả lượt đúng một lần qua ledger. PAID/fulfilled/returned không tự trả coupon theo TTL.
Không sửa coupon_id của đơn đã tạo; không decrement khi không có reservation được chứng minh.

Rò rỉ đã xác nhận cần đóng ở RFC-2: coupon `used_count` tăng trong trigger BEFORE INSERT trên
`orders`, nhưng đường bù trừ `orders.delete()` khi insert `order_items` lỗi **không** trả lại lượt
coupon — mỗi lần create hỏng giữa chừng làm mất vĩnh viễn một lượt. RPC/ledger phải xóa hẳn đường
compensating delete này, không chỉ vá thêm decrement.

## Security và failure modes

| Mối đe dọa | Biện pháp / điều kiện chứng minh |
|---|---|
| Parallel POST, nhiều tab | User lock + atomic cap + durable unique key; test từ connection độc lập |
| Khách đổi userId/giá/PAID | Server derives identity; schema whitelist; pricing server; RPC grants đóng |
| Call Supabase trực tiếp | RLS/ACL cấm anon/authenticated insert/update ledger/orders/items và EXECUTE RPC đặc quyền |
| SECURITY DEFINER escalation | Ưu tiên invoker server-service RPC nếu đủ quyền; nếu definer thì owner tối thiểu, fixed empty search_path, schema-qualified names, REVOKE PUBLIC |
| Service-role bypass | Secret chỉ server-only; API auth ownership bắt buộc vì service-role không tự bảo vệ bằng RLS |
| JWT user bị khóa | RPC recheck users.is_deleted; staff role recheck DB cho mutation nhạy cảm, không chỉ proxy |
| IDOR/order enumeration | Query theo id AND user_id; 404 thống nhất; không lộ thông tin beneficiary/customer thừa |
| CSRF qua cookie | Exact Origin allowlist theo APP_BASE_URL + Fetch Metadata; reject missing Origin cho browser mutation; token cho ngoại lệ có tài liệu |
| Spoof x-forwarded-for | Chỉ tin header ingress xác nhận đã overwrite; không tự tin hop đầu/header tùy ý; probe deployment trước bật |
| Redis error/missing | Checkout limiter riêng fail-closed 503 cho create mới; replay authenticated đã tồn tại có đường bounded DB lookup |
| Replay flood khi Redis down | Ingress protection đã kiểm chứng hoặc tạm 503 cả replay; cap DB không thay thế network abuse protection |
| Fake claim | Không tự PAID, không reset deadline, không trả slot; một claim; nhân viên đối soát nguồn ngân hàng |
| Staff confirm/cancel race | Shared lock + expectedVersion + guarded state + event trong transaction |
| Cron bị gọi ngoài | Bearer secret độc lập, constant-time comparison, bounded payload, no-store; rotate không log secret |
| Distributed accounts/IPv6 | Per-IP + daily quota + trần reservation toàn cửa hàng; metrics; chặn account có review lặp sau staff kiểm |
| Leaking sensitive metadata | HMAC IP với key server; không log raw IP, JWT, địa chỉ đầy đủ, ảnh/số tài khoản người gửi |

Chi tiết xác nhận cho dòng "Call Supabase trực tiếp" (F1 — không còn là giả định):
`supabase/migrations/20260718000000_init_schema.sql:271` có policy
`"Users create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id)`, và
`handle_new_auth_user()` seed `public.users.id = auth.users.id`. Nghĩa là mọi khách đã đăng nhập
có thể gọi thẳng Supabase REST API bằng OAuth session của chính họ + anon key để chèn order,
bỏ qua app JWT, limiter, account cap và idempotency key. Đây là mục tiêu chính xác cho phần
RLS/ACL của RFC-2. Đã grep sạch: không có caller client-side nào ghi orders/order_items,
nên REVOKE quyền INSERT của role `authenticated` trên `orders`/`order_items` là an toàn để plan.

Không đổi fail-open của tất cả limiter hiện hữu trong feature này: thêm checkout-specific policy.
Redis token bucket/sliding window script phải atomic increment+TTL, bounded cardinality;
không tạo bucket tùy arbitrary id trước khi authenticate. IPv4/IPv6 canonicalization và NAT test bắt buộc.
IP hash vẫn là dữ liệu định danh gián tiếp; không gọi là ẩn danh hoàn toàn.

## Performance và vận hành

- Một mutation RPC/create thay hai writes cộng compensating delete; pre-read replay theo unique index.
- Không cache authoritative cap, stock, deadline hay payment status ở process memory.
- Count active rows bằng partial index; không scan toàn bộ lịch sử order; EXPLAIN trên dataset 100k đơn.
- Worker scan theo due_at/id có limit, mỗi order transaction ngắn; duplicate workers an toàn;
  không offset pagination gây bỏ sót khi trạng thái đổi, không external call trong transaction.
- Audit nghiệp vụ commit cùng mutation; email/notification ngoài transaction.
- Target đề xuất staging: checkout p95 < 1s ở 20 request/s, lock wait p95 < 200ms;
  compare cùng dataset và hạ tầng, chưa phải kết quả benchmark.
- Metrics: attempts/accepted/replay/429/409/503, idempotency conflicts, cap hits,
  review age/queue size, stock reserved/released, coupon delta, deadlock/retry, worker lag/errors.
- Alert khi worker không heartbeat > 5 phút; queue quá SLA; confirm trên cancelled attempted;
  release mismatch hoặc coupon_count âm là stop-write incident, không sửa bằng clamp âm thành 0.
- Ngân sách lock timeout/batch/retention là config server được validate; không cho client override.

## Touchpoints

| File / nhóm | Thay đổi dự kiến |
|---|---|
| `supabase/migrations/<timestamp>_checkout_abuse_protection.sql` (mới) | Schema, indexes, ACL, RPC, thay triggers; không sửa migration lịch sử |
| `features/checkout/services/order.repository.ts` | createAtomic/findReplay/transition wrappers + typed mappings |
| `features/checkout/services/checkout.service.ts` | Replay trước pricing; immutable quote; one RPC; only-new side effects |
| `features/checkout/schemas/checkout.schema.ts`, `types/index.ts`, `constants.ts` | Contract/errors/deadline/actions/policy boundaries |
| `features/checkout/services/checkout-protection.service.ts` (mới) | Canonical hash, quotas/limiter orchestration |
| `src/middlewares/checkout-rate-limit.middleware.ts` (mới), `src/cache/redis.ts` (đọc) | Checkout-only policy, atomic Redis operations |
| `src/security/trusted-client-ip.ts` (mới) | Deployment-specific IP extraction + HMAC |
| `app/api/checkout/route.ts`, account/staff/internal routes nêu trên | Auth, CSRF, input bounds, responses |
| `features/admin-orders/services/admin-orders.repository.ts`, `.service.ts`, schemas/types | Guard fulfill, confirm/review RPC, filters |
| `features/account/services/account-order.service.ts` | Owned detail/actions/status DTO |
| `lib/useCheckoutSubmit.ts`, `lib/api-client.ts` (đọc/retry sửa nếu cần) | Persist key per intent, refresh retry giữ header |
| `components/checkout/CheckoutSuccessView.tsx`, `CheckoutSubmitBlock.tsx` | Deadline, old orders CTA, current server state |
| `components/account/AccountOrderList.tsx`, `AccountOrderDetail.tsx` (mới) | Tiếp tục thanh toán, claim và cancel request |
| `components/admin/orders/AdminOrderDetail.tsx`, `AdminOrdersList.tsx` | Review queue, evidence, conflict refresh |
| `app/checkout/success/page.tsx`, account detail page mới | Fetch theo auth; không tin localStorage là trạng thái thật |
| `vitest.config.ts` | Tách project unit/integration hoặc exclude `tests/integration` khỏi run mặc định |
| `package.json` (scripts) | Thêm `test:integration` chạy riêng DB/Redis tests |
| `.env.example`, scheduler deployment config sau probe | Limiter/review config + documented scheduling; bổ sung `APP_BASE_URL`, `REDIS_URL` |
| `process/context/payment/all-payment.md`, `database/all-database.md`, `tests/all-tests.md` | UPDATE PROCESS sau execute, ghi routing và limitations thật |

Nếu đổi email payload/template hoặc `order-email.service.ts`, bắt buộc đọc skill
`order-confirmation-email` và context email trước sửa; V1 chỉ giữ invocation sau create mới.

## Blast Radius

Khoảng 25–40 source/config files cộng 10–15 tests và một migration, tùy reuse route/DTO.
Risk class: auth/authorization, database schema, payment, inventory và coupon accounting.
Không đổi gateway, không dựng hệ thống fraud scoring ML, không CAPTCHA toàn checkout,
không tự động hoàn tiền, không nhập liệu sao kê/ngân hàng trong V1.
Không xóa legacy PAYOS enums/cột hoặc thay role system.

## Implementation Checklist

### RFC-1 — Preflight và chốt invariant (IN PROGRESS — findings: `unpaid-order-abuse-protection_RFC1-REPORT_06-09-26.md`)

- [x] Ghi lại baseline: chạy `npm run check` **trước mọi thay đổi code**, lưu nguyên văn output vào
  task folder và commit. → `rfc1-baseline-npm-check_06-09-26.txt` (verbatim, exit 1).
  **Đính chính (F5)**: baseline KHÔNG fail ở `lib/useAddresses.test.tsx` như plan mô tả. `npm run check`
  dừng ngay ở bước 1 `format:check` (1303 files) và không bao giờ chạy tới lint/type-check/test.
  Chạy riêng từng bước: `tsc --noEmit` exit 2 (2 lỗi, đều trong file generated `.next/dev/types/validator.ts`);
  `npx vitest run` exit 1 — 1 failed suite / 64 passed (65), 429/429 test pass, failure duy nhất là
  `lib/useAddresses.test.tsx` fail ở import do thiếu Supabase env trong process vitest.
  → `npm run check` không dùng làm regression gate được cho tới khi trả nợ prettier.
- [x] Đọc schema/triggers/RLS bằng read-only, liệt kê mọi order mutation kể cả admin/seed.
  → RFC1-REPORT §(a): 8 app write sites, 7 triggers (T7 đã bị drop), 3 nhóm migration/seed mutation.
  **Đọc từ migration files, KHÔNG phải từ staging** (không có credentials — xem §(c)).
- [ ] Probe RPC ACL với anon/authenticated/service-role; xác minh app JWT khác Supabase auth.uid().
  → **NOT PROBED — không có staging credentials trong môi trường này.** F2 (0 GRANT/0 REVOKE trong
  cả 13 migration) đã re-confirm bằng grep. **F3 MỚI**: tồn tại policy bypass thứ hai
  `"Users insert own order items"` (`20260721000000_seed_product_order_code_cart_variant.sql:69`) —
  RFC-2 phải drop CẢ HAI policy, không chỉ `"Users create own orders"`.
- [ ] Probe Redis provision/TLS, trusted ingress IP, scheduler thực tế, actor trực đối soát.
  → **NOT PROBED** cho Redis/ingress/staff actor. Scheduler: **CONFIRMED ABSENT** trong repo.
  Nội dung `.env` không đọc được (privacy guard chặn, không bypass) → không xác nhận được biến nào đã set.
- [x] Bổ sung `APP_BASE_URL` và `REDIS_URL` vào `.env.example` — ĐÃ LÀM (có comment cho từng biến).
  **F4 MỚI**: `.gitignore:34` là `.env*` không có negation `!.env.example` → file đang bị git ignore,
  thay đổi này **không commit được** nếu không sửa `.gitignore` (quyết định của owner, ngoài scope RFC-1).
  Xác nhận deployment đã set cả hai: **chưa làm — cần deployment access.**
- [ ] Gate (scheduler host): owner phải chọn và ghi rõ nơi chạy scheduler — platform cron / external
  scheduler / manual staff sweep — **trước khi** RFC-3 implement `POST /api/internal/orders/review-expired`.
  → **PENDING OWNER.** Vắng mặt in-repo đã xác nhận lại (không `.github/workflows/`, không `vercel.json`,
  không Docker, không worker entrypoint); nền tảng hosting có cron hay không là câu hỏi cho owner.
- [ ] Chốt ngưỡng COD/units/global reserve/review SLA; ghi requirements delta trong plan.
  → **PENDING OWNER — agent không được tự chốt.** Bốn giá trị vẫn là đề xuất, liệt kê ở RFC1-REPORT §(d).
- [ ] Test Stage: tạo fixture staging gồm multiline cùng product, coupon lượt cuối, paid/legacy orders.
  → **NOT DONE — cần staging DB và INSERT, mà RFC-1 cấm.** Hình dạng fixture đã đặc tả sẵn;
  RFC-2 dựng chúng làm integration fixtures trên test Postgres cục bộ.
- [x] Gate: report topology/ACL và quyết định còn thiếu; không declare deployment-ready khi thiếu scheduler/staff.
  → RFC1-REPORT §(e): **RFC-2 được phép bắt đầu**; deployment-readiness KHÔNG được tuyên bố.

### RFC-2 — Atomic persistence và lifecycle (CODE DONE + TESTING; report: `unpaid-order-abuse-protection_RFC2-REPORT_06-09-26.md`)

- [x] Migration additive + ledger + RPC/ACL; remove conflicting triggers trong controlled cutover.
  → `supabase/migrations/20260906000000_checkout_abuse_protection.sql`: §1 cột orders + 3 partial index;
  §2 bốn bảng mới (`checkout_requests`/`order_resource_reservations`/`order_payment_events`/
  `checkout_daily_quota`); §3 RLS deny-by-default; §4 DROP 3 trigger cũ; §6 ba RPC + trigger
  release tương thích; §8 backfill ledger không đụng số liệu.
  **CHƯA APPLY** — file có header `APPLY 1 LẦN, THỦ CÔNG bởi owner`, và ACL probe (RFC-1) vẫn PENDING.
- [x] RLS/grant work có mục tiêu cụ thể: bỏ policy `"Users create own orders"` (INSERT trên `orders`)
  và REVOKE quyền INSERT/UPDATE của role `authenticated` trên `orders`/`order_items`/ledger mới.
  → migration §5: drop CẢ HAI policy (F1 `"Users create own orders"` + F3 `"Users insert own order items"`),
  siết `"Staff/Admin update orders"` bằng trigger `guard_sensitive_order_columns` (§5.2),
  REVOKE INSERT/UPDATE/DELETE khỏi anon+authenticated (§5.3), REVOKE EXECUTE khỏi PUBLIC (§7).
  Chứng minh: `tests/integration/checkout-protection.db.test.ts` §"cutover trigger + ACL" — 4 test
  đọc `pg_policies` / `has_table_privilege` / `has_function_privilege` trên Postgres thật.
- [x] Tách vitest thành project `unit` và `integration`; thêm script `test:integration`.
  → `vitest.config.ts` khai báo `test.projects` (`unit` exclude `tests/integration/**`; `integration`
  include chỉ `tests/integration/**`, `fileParallelism: false`); `package.json:14-17`
  `"test": "vitest run --project unit"` + `"test:integration": "vitest run --project integration --maxWorkers=1"`.
  Landed TRƯỚC file integration đầu tiên (E4). Bằng chứng: `npm run test:integration` KHÔNG có
  `TEST_DATABASE_URL` → `1 skipped (1) / 25 skipped (25)`, exit 0.
- [x] Đóng coupon leak: bỏ đường `orders.delete()` bù trừ; toàn bộ order + items + coupon reserve
  nằm trong một RPC transaction. Test khẳng định `coupons.used_count` không đổi khi create fail
  sau khi row `orders` đã insert.
  → `order.repository.ts`: `orders.delete()` XOÁ HẲN (không vá decrement); `createAtomic()` gọi đúng
  một RPC. Unit test khẳng định `supabaseAdmin.from` KHÔNG hề được gọi.
  DB test `"create hỏng SAU khi row orders đã được insert -> coupons.used_count KHÔNG ĐỔI"` dùng
  item `price: -1` để nổ CHECK 23514 tại bước INSERT order_items (sau orders insert).
  **Red-before đi kèm**: `"[red-before] đường hai-write CŨ thực sự làm rò rỉ một lượt coupon"` chạy
  đúng kịch bản đó trên database chỉ-bootstrap (trigger cũ còn sống) và khẳng định `used_count = 1`
  dù đơn đã bị xoá → test xanh ở trên KHÔNG rỗng.
- [x] Quote consistency, cap/quota/idempotency; create/release/confirm cùng lock protocol.
  → RPC §6.2 thứ tự khoá user → idempotency → coupon → product id tăng dần; idempotency check đứng
  TRƯỚC cap/quota nên replay không tiêu slot; kiểm `final_price = total + ship - discount` (NTVER) và
  trần giảm giá theo định nghĩa coupon; `checkout.service.ts` dựng `quote` bất biến rồi mới gọi RPC,
  replay lookup chạy TRƯỚC pricing, email chỉ chạy cho `newlyCreated`.
  §6.3 `checkout_transition_order_state` dùng CÙNG thứ tự khoá (user trước order) + `expected_version`.
  **Chưa làm ở RFC-2 (đúng phạm vi)**: `admin-orders.repository.ts` chưa chuyển sang wrapper
  `orderRepository.transition()` — migration §6.4 để lại trigger tương thích cho đường UPDATE cũ; RFC-3.
- [x] Tests `tests/integration/checkout-protection.db.test.ts` (mới): nhiều pg connections, committed race fixtures.
  → 25 test, mỗi call đồng thời dùng một `pg.Client` riêng. Schema dựng từ
  `tests/integration/fixtures/bootstrap-schema.sql` (bản DỰNG LẠI của init_schema, KHÔNG phải migration).
- [x] Test Stage: `npm run test:integration` với `TEST_DATABASE_URL` trỏ Postgres disposable.
  → `Test Files 1 passed (1) / Tests 25 passed (25)`, Duration 4.72s (postgres:16-alpine, port 55432).
- [x] Gate: 50 same-user calls ≤2 orders; same-key →1 order; stock/coupon rollback; cancel-confirm race;
  coupon used_count không đổi khi create fail giữa chừng; query DB xác nhận totals và ledger.
  → 50 concurrent → `COUNT(*) = 2`, 48 lỗi đều là `NTCAP`; 20 concurrent same-key → 1 order,
  đúng 1 non-replay; multiline 3+7 cùng `product_id` → hoàn đủ 10 (+ red-before chứng minh trigger cũ
  chỉ hoàn 3 hoặc 7); PAID không bị hoàn kho; confirm trên CANCELLED → NTSTA; release lần hai no-op.
  Không dùng mocked Supabase làm bằng chứng transaction.
- [ ] **CÒN LẠI (chặn VERIFIED)**: owner apply migration + chạy ACL probe RFC-1 trên Supabase thật.
  Bằng chứng hiện có là Postgres cục bộ trên schema DỰNG LẠI, không phải database đã deploy.

### RFC-3 — API và throttling (CODE DONE + TESTING; report: `unpaid-order-abuse-protection_RFC3-REPORT_06-09-26.md`)

- [x] Checkout dedicated limiter + canonical key + error map; customer/staff routes.
  → `src/middlewares/checkout-rate-limit.middleware.ts` (mới): script Lua INCR+PEXPIRE+PTTL atomic
  (`:32`), fail-CLOSED 503 khi Redis chết/không cấu hình (`:133`), `Retry-After` = PTTL thật làm
  tròn lên (`:158`). KHÔNG đụng fail-open của `rate-limit.middleware.ts` (E2).
  `src/security/trusted-client-ip.ts` (mới): chỉ tin header ingress đã khai báo, lấy hop CUỐI,
  canonical IPv4/IPv6(/64), HMAC bằng `CLIENT_IP_HASH_SECRET` — không nhánh nào trả IP thô.
  `src/security/csrf.ts` (mới): exact-Origin allowlist theo `APP_BASE_URL`, thiếu Origin cũng bị từ chối.
  Routes mới: `app/api/account/orders/[id]/{route,payment-claim,cancel}`,
  `app/api/staff/orders/[id]/resolve-payment-review`. Error map dùng lại `CHECKOUT_DB_ERROR_MAP`
  (RFC-2) + `Retry-After` header qua `error-handler.middleware.ts`.
  **Cron review-only: KHÔNG làm — xem mục deferred bên dưới.**
- [x] Cửa sổ tương thích cho `Idempotency-Key` (E3): client gửi header ở mọi submit/retry
  (`lib/useCheckoutSubmit.ts` — key giữ theo payload hash trong `sessionStorage`, chỉ đổi khi
  business payload đổi thật); server ĐỌC header (`app/api/checkout/route.ts:82`) nhưng THIẾU header
  vẫn 201 + chỉ warn+log (`checkout.service.ts:205`). Không có nhánh 400/409 cho header thiếu, kể cả
  khi `CHECKOUT_PROTECTION_ENFORCED=true` — có test khẳng định đúng điều đó.
- [x] Guard trạng thái order trong `confirmPayment()`:
  `admin-orders.repository.ts:375` `TERMINAL_ORDER_STATUSES`, guard TS ở `:417` (409
  `ORDER_STATE_CONFLICT`), chuyển sang `orderRepository.transition()` với `expectedVersion` ở `:425`.
  Đường tương thích khi RPC chưa apply (`:484`) vẫn có guard `.not("status","in","(CANCELLED,RETURNED)")`
  ở `:491` — guard nằm TRONG câu UPDATE, không chỉ pre-check.
  Regression test kèm **red-before**: `admin-orders.repository.test.ts` §"AC09" chứng minh guard CŨ
  chấp nhận đơn CANCELLED trước, rồi mới khẳng định guard MỚI từ chối.
- [x] Guard paid trước fulfil; isolate legacy bank handling; event audit trong transaction.
  → Guard PAID/terminal nằm trong RPC (migration §6.3) và được gọi từ mọi route mới; audit ghi vào
  `order_payment_events` CÙNG transaction với mutation. Legacy: `payment_method = 'PAYOS'` và đơn
  thiếu cột RFC-2 (SQLSTATE 42703) có đường đọc riêng, có test (AC12).
- [x] Tests route/service và Redis thật: `app/api/checkout/route.test.ts` (mới, 15),
  `app/api/account/orders/[id]/{route,payment-claim,cancel}/route.test.ts` (mới, 4+9+7),
  `app/api/staff/orders/[id]/resolve-payment-review/route.test.ts` (mới, 10),
  `src/security/trusted-client-ip.test.ts` (mới, 13),
  `src/middlewares/checkout-rate-limit.middleware.test.ts` (mới, 12),
  `lib/useCheckoutSubmit.test.ts` (mới, 7), `features/account/services/account-order.service.test.ts`
  (+8), `features/admin-orders/services/admin-orders.repository.test.ts` (+5 AC09).
  **Internal worker tests: KHÔNG làm — route bị hoãn (xem deferred).**
- [x] Test Stage: `npm test` → `Test Files 1 failed | 73 passed (74) / Tests 548 passed (548)` —
  đúng một suite đỏ của baseline (`lib/useAddresses.test.tsx`), 0 test fail, +89 test mới, 0 regression.
  `TEST_REDIS_URL=redis://localhost:56379 npx vitest run --project integration` →
  `tests/integration/checkout-rate-limit.test.ts` (mới) 8/8 pass trên Redis THẬT (redis:7-alpine
  disposable, port 56379); cùng lượt với DB test RFC-2 → `2 passed / 33 passed`.
  Không có env → `2 skipped (2) / 33 skipped (33)`, exit 0.
- [x] Gate: auth/IDOR/CSRF/forged IP/rate TTL/Redis outage/Retry-After có bằng chứng.
  → IDOR: query `id AND user_id` cùng một câu, không khớp → 404 (`account-order.service.ts:246,258`).
  CSRF: Origin lạ/thiếu → 403 `CSRF_ORIGIN_REJECTED`, subdomain KHÔNG được suy diễn hợp lệ.
  Forged IP: header không được khai báo trusted → chỉ đo, không chặn; hop đầu do client gửi bị bỏ qua.
  TTL + Retry-After + outage: chứng minh trên Redis thật, gồm test 50 request song song đếm đúng 50.
  **KHÔNG bao gồm "missing cron secret"** — route cron bị hoãn.
- [ ] **DEFERRED (E5) — `POST /api/internal/orders/review-expired` KHÔNG được implement.**
  Owner chưa chọn scheduler host (RFC-1 gate vẫn PENDING). Một route không có caller không gate được
  AC05, và không gate được thì mở thêm một bề mặt có secret mà không ai gọi. Đây là hoãn có chủ đích
  theo execute-instruction E5, không phải hạng mục bị bỏ sót.
- [ ] **CÒN LẠI (chặn VERIFIED)**: (a) owner apply migration RFC-2 lên Supabase — tới lúc đó
  `transition()` chạy đường tương thích; (b) ACL probe RFC-1; (c) provision Redis production trước
  khi bật `CHECKOUT_PROTECTION_ENFORCED=true` (limiter fail-closed: Redis chết = checkout chết);
  (d) probe hành vi ghi đè header IP của ingress rồi mới đặt `TRUSTED_CLIENT_IP_HEADER`.

### RFC-4 — Customer/staff UX (CODE DONE + TESTING; report: `unpaid-order-abuse-protection_RFC4-REPORT_06-09-26.md`)

- [x] Giữ giỏ/key khi timeout/cap; tiếp tục đơn cũ; refresh trạng thái auth-scoped no-store.
  → `features/checkout/checkout-error.ts:73` phân loại `cap` / `retryable` / `other`;
  `CheckoutForm.tsx:243` KHÔNG đụng giỏ ở nhánh lỗi (`removeFromCart()` chỉ chạy sau khi có đơn thật,
  `:236`) và KHÔNG sinh key mới — `resolveIdempotencyKey` neo theo hash payload
  (`lib/useCheckoutSubmit.ts:61`), có test khẳng định key giữ nguyên sau 429/503/timeout
  (`lib/useCheckoutSubmit.test.ts:87`).
  Cap → `CheckoutSubmitBlock.tsx:32` liệt kê đơn cũ CỦA CHÍNH khách kèm link
  `/account/orders/{id}`, KHÔNG có lời mời retry. Refresh no-store:
  `features/account/services/account-order.client.ts:29` (`cache: "no-store"`) dùng ở
  `app/checkout/success/page.tsx:39` và `components/account/AccountOrderDetail.tsx:47`.
- [x] Deadline dựa server time; ẩn QR sau hạn, text rõ claim chưa phải xác nhận thanh toán.
  → `features/account/payment-review.ts` — KHÔNG có nhánh nào tính hạn từ `createdAt`/đồng hồ
  trình duyệt; `paymentExpiresAt == null` → `formatPaymentDeadline` trả `null` → UI không vẽ
  đồng hồ nào. `describePaymentReview` quá hạn → `showQr: false` + "đơn CHƯA bị hủy" (không tự
  hết-hạn-hoá, E5). Copy claim: `AccountOrderDetail.tsx:216` + `CheckoutSuccessView.tsx` —
  "chưa phải xác nhận thanh toán".
  **Red-before đã chạy**: bỏ kiểm hạn trong `shouldShowPaymentQr` → 1 test đỏ; vô hiệu nhánh
  `deadlinePassed` của `describePaymentReview` → 2 test component đỏ (chi tiết ở report §3).
- [x] Queue staff theo overdue/claim; resolve evidence; version conflict refresh thay ghi đè.
  → `features/admin-orders/review-queue.ts` (overdue > claimed > review); `AdminOrdersList.tsx`
  thêm chip "Cần đối soát" + badge/row-sort. `AdminPaymentReviewPanel.tsx` thu đúng evidence
  của Zod schema RFC-3 (`outcome`/`reason` bắt buộc, `statementChecked{From,To}`, `reference`),
  KHÔNG có input file, KHÔNG có nhánh nào đặt PAID.
  Conflict: `AdminOrderDetail.tsx:109` `handleMutationError` → 409 `ORDER_STATE_CONFLICT` thì
  `mutate()` đọc lại, không ghi đè; `expectedVersion` lấy từ `order.stateVersion` cho cả
  confirm-payment lẫn resolve-review.
- [x] Test Stage: `npx vitest run lib/useCheckoutSubmit.test.tsx components/checkout/CheckoutSuccessView.test.tsx`;
  thêm account/staff component tests cho action visibility và payment state.
  → Tên file thật là `lib/useCheckoutSubmit.test.ts` (`.ts`, không phải `.tsx` — RFC-3 tạo).
  `npm test` → `Test Files 1 failed | 79 passed (80) / Tests 610 passed (610)`; đúng một suite đỏ
  của baseline (`lib/useAddresses.test.tsx`), 0 test fail, **+62 test mới, 0 regression**.
  File mới: `features/account/payment-review.test.ts`, `features/admin-orders/review-queue.test.ts`,
  `features/checkout/checkout-error.test.ts`, `components/checkout/CheckoutSubmitBlock.test.tsx`,
  `components/account/AccountOrderDetail.test.tsx`,
  `components/admin/orders/AdminPaymentReviewPanel.test.tsx`; mở rộng
  `CheckoutSuccessView.test.tsx`, `useCheckoutSubmit.test.ts`,
  `admin-orders.repository.test.ts`, `confirm-payment/route.test.ts`.
- [ ] Gate: human authenticated walkthrough desktop/mobile, reload/multi-tab/expired/claimed/paid;
  đối chiếu UI với database sau từng thao tác, screenshot và xác nhận người dùng.
  → **PENDING — cần người xác nhận có tên; agent KHÔNG thực hiện được** (auth là Google-OAuth-only,
  không có dev-login bypass và RFC-4 không thêm bypass nào). Phiên này KHÔNG render bất kỳ màn hình
  nào trong browser thật; bằng chứng duy nhất là component test với client/API đã mock.
  Đây là known-gap môi trường của plan, không phải hạng mục bị bỏ sót.

### RFC-5 — Cutover, regression và runbook (CODE DONE, một phần — report: `unpaid-order-abuse-protection_RFC5-REPORT_06-09-26.md`)

- [x] Baseline stock/coupon/legacy discrepancies; dry-run migration/backfill; rehearsal rollback.
  → Cục bộ (Postgres disposable): 31/31 test PASS, dataset legacy cố ý khó (đơn nhiều dòng cùng
  product_id, coupon lượt cuối, PAID/CANCELLED/DELIVERED). Phát hiện + sửa 2 lỗi migration chặn
  (pg_catalog.current_user abort trên đơn CANCELLED; thiếu DROP POLICY IF EXISTS khiến không chạy
  lại được lần hai). Phát hiện (không tự sửa) 2 chênh lệch dữ liệu thật do trigger cũ để lại (R5:
  đơn 2 dòng hoàn thiếu; R6: đơn DELIVERED+UNPAID kẹt vĩnh viễn trong cap) — đưa vào runbook cho
  owner đối soát. **Diễn tập trên staging thật vẫn PENDING — không có staging.**
- [x] Run security ACL probes (cục bộ) + concurrency + benchmark (cục bộ, không phải gate AC13) +
  `npm run check` + `npm run build`.
  → `npm run build` chạy lần ĐẦU TIÊN trong cả chương trình: exit 0 sau khi sửa artifact `.next/dev`
  hỏng (đã che giấu 11 lỗi type thật của RFC-3/4 suốt 3 RFC) + 3 lỗi ép kiểu thật. `tsc --noEmit`
  giờ 0 lỗi (trước đó "2 lỗi baseline" thực ra là lỗi cú pháp khiến tsc bỏ qua toàn bộ semantic
  check). `npm run check` vẫn KHÔNG dùng được làm gate (nợ prettier toàn repo, RFC-1 F5, ngoài
  phạm vi). ACL probe trên **DB đã deploy** vẫn PENDING (không có credentials trong session này) —
  thủ tục 7 lệnh curl đã viết sẵn ở RUNBOOK §5. Benchmark AC13 (100k EXPLAIN, 20rps) PENDING — cần
  staging.
- [x] Giới hạn audit output, log secret scrub — không tìm thấy rò rỉ IP/JWT/địa chỉ/secret nào
  trên toàn bề mặt RFC-2/3/4, không cần sửa.
  Worker overlapping execution rehearsal: **PENDING — không thể thực hiện**, chưa có worker (E5
  hoãn có chủ đích, owner chưa chọn scheduler host).
- [ ] Gate: evidence pack + owner xác nhận review SOP, threshold và known gaps; rollout có monitoring.
  → Evidence pack 5-artifact (`harness/`) đã viết, validator sạch (0 failures/warnings). Gate item
  giữ nguyên CHƯA tick — cần owner xác nhận SOP/ngưỡng/known-gap, đây không phải việc agent tự chốt.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Same user 50 creates, cap race với cancel/confirm | Fully-Automated — real Postgres independent connections | AC01, AC04, AC07 |
| Same key đồng thời/lost response/reprice/stock exhausted/cancel replay | Fully-Automated — DB + service tests | AC03, AC04 |
| Invalid item after order insert (coupon used_count phải không đổi); coupon lượt cuối; multiline SUM — fixture **bắt buộc tối thiểu** là đơn 2 dòng cùng `product_id`, không phải case tùy chọn: `order.repository.ts` ghi cùng product_id cho mọi dòng trong catalog single-SKU này, nên lỗi restock SUM ảnh hưởng **mọi** đơn nhiều dòng | Fully-Automated — DB snapshot before/after | AC04, AC07 |
| Redis down/no config/script TTL; NAT/IPv6/spoof headers | Hybrid — Redis tests + deployed ingress probe | AC02, AC08 |
| Customer claim không PAID/extend slot; no-transfer resolve | Fully-Automated + human bank SOP review | AC05, AC06 |
| Cron confirm/cancel interleaving, paid and late transfer; confirmPayment trên đơn CANCELLED bị reject | Fully-Automated — real DB | AC07, AC09 |
| Anon/authenticated RPC/table access, foreign order, CSRF | Hybrid — HTTP and DB role probes | AC08 |
| COD cap/quota/retry, legacy PAYOS display | Fully-Automated — services/routes/DB | AC11, AC12 |
| Customer mobile flow/cap CTA/reload/claim/cancel, staff review | Hybrid — component tests + human OAuth walkthrough | AC06, AC09, AC10 |
| 100k-row EXPLAIN, 20rps latency, global reserve circuit | Hybrid — isolated staging benchmark + owner thresholds | AC13, AC14 |
| Dry-run cutover/backfill and rollback replay | Hybrid — staging rehearsal + SQL reconciliation | AC12 |

IDs tham chiếu bảng Acceptance Criteria trong PLAN này; chưa có locked SPEC riêng.
Proposed new integration scripts/tests phải được tạo ở EXECUTE; lệnh trên chưa chạy và không
được báo PASS chỉ vì test file tồn tại. Database fixture dùng DB test riêng và cleanup theo run ID;
không reset/mutate production, không chạy integration mặc định khi URL chưa được xác minh.

## Test Infra Improvement Notes

- Baseline `npm run check` phải được chạy và commit nguyên văn **trước** thay đổi code đầu tiên
  (RFC-1 item 1). Hiện baseline đã RED — `lib/useAddresses.test.tsx` fail ở import, xác nhận bằng
  cách chạy thật. Không gate nào được tuyên bố xanh cho tới khi tập failure có sẵn được ghi lại.
- `vitest.config.ts` hiện không khai báo `include`/`exclude`/project split; DB integration tests mới
  sẽ lọt vào `npm test` mặc định và fail ở môi trường không có test Postgres. Phải tách project +
  thêm script `test:integration` trong RFC-2 trước khi thêm file dưới `tests/integration/`.
- Cần bộ real Postgres concurrency tests và Redis isolated tests; Vitest mock hiện hữu không chứng minh lock.
- Có `pg`/Vitest sẵn trong package.json; ưu tiên reuse, chưa cần cài framework E2E mới để chứng minh DB invariant.
- Test context ghi OAuth-only cản authenticated browser automation: dùng human walkthrough có evidence;
  không thêm dev-login bypass vào production để hoàn thành plan.
- Known-Gap: chưa xác minh database deployed, Redis, ingress và scheduler; RFC-1 phải giải quyết trước bật enforcement.
- Nếu baseline `npm run check` lỗi ngoài phạm vi, ghi exact output và phân biệt failure mới; không claim full gate xanh.

## Rollout, migration và rollback

1. Chụp số liệu read-only: tổng active bank/COD, tuổi đơn, đơn missing items, stock/coupon discrepancy.
2. Migration expand thêm nullable version/columns/tables; chưa tự đặt deadline cho mọi đơn lịch sử.
3. Legacy có `protection_version IS NULL`: vẫn hiển thị; các unpaid bank active tính vào cap để không né;
   user đã có >2 giữ nguyên đơn nhưng chặn tạo thêm, giải quyết bằng staff review.
4. Backfill ledger chỉ khi xác minh reservation lịch sử; không decrement/reincrement stock/coupon hàng loạt.
   Unknown/orphan orders vào danh sách reconcile riêng; không tự release coupon không có chứng cứ consume.
5. Deploy code hỗ trợ schema mới; trong cửa sổ maintenance ngắn chặn new checkout và ngừng worker,
   cutover mutation routes/RPC/triggers cùng release; không chạy old writers song song sau ledger enforcement.
6. Validate counts/ACL và smoke tests trước mở checkout; bật deadline cho đơn mới từ cutoff DB lưu cố định.
7. Theo dõi 24–48h: cap hits, false positives NAT, queue SLA, resource deltas; chỉnh config có audit.
8. Rollback ứng dụng chỉ về bản tương thích RPC/ledger; kill switch dừng new checkout/worker khi cần,
   vẫn mở đọc và staff reconciliation. Không khôi phục two-write path hoặc trigger cũ giữa live traffic.
9. Data rollback là forward-fix có owner duyệt theo ledger, không DROP tables/xóa audit/key đã dùng;
   replay vẫn phải cùng order sau rollback. Test code/schema compatibility trước phát hành.

Runbook manual-first evidence pack lưu cùng task folder khi EXECUTE: migration snapshot/diff,
security ACL probe, race/concurrency report, user/staff walkthrough, reconciliation/rollback report.
Không gửi email thật hoặc đổi database production trong giai đoạn lập PLAN.

## Phase Completion Rules

PLANNED → CODE DONE → TESTING → VERIFIED; build/typecheck không đủ để VERIFIED.
Mỗi RFC cần integration, error handling, DB state verification và manual test phù hợp.
User Confirmation/human authenticated walkthrough phải ghi rõ người xác nhận và evidence;
nếu chưa có thì giữ TESTING/known-gap, không tự ghi người dùng đã xác nhận.

## Validate Contract

Status: CONDITIONAL
Date: 06-09-26
date: 2026-09-06
generated-by: outer-pvl
supersedes: 2026-09-06 (outer-pvl) — cycle-1-informed re-validation; the prior contract was the
first-pass baseline (0 FAIL / 9 CONCERN / 8 known-gap). All 9 CONCERNs were re-checked against the
supplemented plan text AND against real source files in this pass; all 9 are closed.

PVL history: `results.tsv` — cycle 0 VALIDATE (CONDITIONAL, 9 CONCERN) → cycle 1 PLAN-SUPPLEMENT
(SUPPLEMENT_APPLIED, 9 gaps) → cycle 2 VALIDATE (this contract). One recorded fix cycle, so this
CONDITIONAL is a terminal, EXECUTE-eligible verdict under `orchestration.md` §PVL/EVL Loop Routing —
it is NOT a first-pass CONDITIONAL and must NOT be routed back for another supplement cycle.

Parallel strategy: sequential (forced) — recommended was parallel-subagents
Rationale: 5/7 signals present (S1 multi-area scope, S2 schema/API/auth surface, S5 user requested
depth, S6 high-risk classes, S7 5+ blast-radius files) = HIGH band. The recommended V2 fan-out was
9 parallel subagents (4 Layer 1 dimensions + 5 Layer 2 RFC sections, sonnet). The validate-agent had
no Agent tool grant in this session, so all 9 role specs from `vc-validate-findings` were executed
sequentially inline against real source files. Same deviation as cycle 0; recorded so it stays
auditable. Coverage is equivalent, wall-clock cost is higher.

### Cycle-1 supplement verification (the 9 cycle-0 CONCERNs)

Each row was checked twice: does the plan text actually CLOSE the concern, and is the underlying
claim true against the repo as it stands today? Nothing has been implemented yet — these verify the
PLAN is now correct, not that the code is fixed.

| # | Cycle-0 CONCERN | Where it is now closed in the plan | Independent source check | Verdict |
|---|---|---|---|---|
| 1 | DB integration tests would run in default `npm test` | RFC-2 checklist (project split + `"test:integration"` script), Touchpoints rows for `vitest.config.ts` / `package.json` | Confirmed: `vitest.config.ts` declares no `include`/`exclude`/`projects`; `"test": "vitest run"` is unfiltered and `check` runs it; no `test:integration` script exists. Installed vitest is 4.1.10, so `test.projects` + `--project integration` is a valid API on this version, and the plan also offers the `exclude` fallback | CLOSED |
| 2 | Coupon `used_count` leak on the `orders.delete()` compensating path | Schema section states the leak explicitly; RFC-2 checklist removes the compensating-delete path into one RPC transaction and adds a regression test asserting `used_count` is unchanged | Confirmed: `order.repository.ts:217` performs `client.from("orders").delete().eq("id", row.id)`; `init_schema.sql:623` increments `used_count` in a trigger on order insert; grep shows NO decrement path anywhere in any migration. The leak is real and permanent, and the plan's "delete the path, do not patch a decrement" is the correct fix | CLOSED |
| 3 | `Idempotency-Key` mandatory = breaking change, no rollout ordering | RFC-3 checklist: three-stage window — client ships the header first, server warns+logs only, enforce 400/409 only after logs show 0 missing headers for ≥24h; explicitly forbids flipping the contract in one deploy | Ordering is concrete and has a measurable cutover criterion, not a vague "roll out carefully" | CLOSED |
| 4 | `APP_BASE_URL` / `REDIS_URL` undocumented but needed for CSRF allowlist | RFC-1 checklist adds both to `.env.example` AND requires deployment confirmation before CSRF/limiter enable; Touchpoints updated | Confirmed both are read by live code: `src/middlewares/rate-limit.middleware.ts:111` (`APP_BASE_URL`) and `src/cache/redis.ts:4` (`REDIS_URL`). The plan cites the first line number exactly | CLOSED |
| 5 | No scheduler/cron/worker host exists for the expiry route | RFC-1 adds an explicit owner-decision gate (platform cron / external scheduler / manual staff sweep) that must be answered BEFORE RFC-3 implements `POST /api/internal/orders/review-expired` | The absence is real and remains. What changed is that the plan no longer assumes a caller — it blocks the dependent work on the decision. The residual is now an owner decision, not a plan defect | CLOSED as a plan defect; residual carried as a named known-gap |
| 6 | Multiline SUM restock defect undersold as an edge case | Verification Evidence reclassifies the 2-line same-`product_id` fixture as a mandatory minimum, not optional; the AC04/AC07 test-gate row repeats MUST | Confirmed and stronger than the plan states was needed: `order.repository.ts:206` sets `product_id: NUTEIN_PRODUCT_DB_ID` — a constant — for EVERY line, and `20260724000000_reserve_stock_on_order_create.sql` restocks with `UPDATE products p SET stock = p.stock + oi.quantity FROM order_items oi`, which applies exactly one arbitrary matching row. Every multi-line order under-restocks. "Norm, not edge case" is accurate | CLOSED |
| 7 | `confirmPayment()` has no order-status guard, so a CANCELLED order can be marked PAID | RFC-3 checklist names the file, the exact defect, and requires a guard plus a CANCELLED-rejected regression test; Verification Evidence row updated | Confirmed: `admin-orders.repository.ts:359-390` selects `status` but only guards `payment_method` and `payment_status`. A CANCELLED order still holding `payment_status = 'UNPAID'` passes every check and the conditional UPDATE sets it PAID | CLOSED |
| 8 | Baseline `npm run check` is already red, so no gate can be called green | RFC-1 item 1 requires running it before the first code change, saving the verbatim output to the task folder and committing it; Test Infra Notes repeat it with the specific failing file | The requirement is a hard prerequisite ordered before all other work, and it names the known failure (`lib/useAddresses.test.tsx` import failure) so new failures are separable | CLOSED |
| 9 | No YAML frontmatter, so `vc-plan-discovery` could not route to the plan | Frontmatter present with `name`, `description`, `date`, `feature: checkout` | Structural validator passes: 0 failures, 0 warnings | CLOSED |

Two cycle-0 findings that were folded into existing sections rather than raised as separate gaps
were also re-verified in this pass:

- **F1** — `supabase/migrations/20260718000000_init_schema.sql:271` contains
  `CREATE POLICY "Users create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  verbatim as cited. Combined with `handle_new_auth_user()` seeding `public.users.id = auth.users.id`,
  any logged-in customer can insert orders straight through the Supabase REST API with their own
  OAuth session, bypassing the app JWT, the limiter, the account cap and idempotency entirely. The
  plan's remediation (drop the policy, REVOKE INSERT/UPDATE from `authenticated` on
  `orders`/`order_items`/the new ledger) is safe: an independent grep confirms every write to
  `orders`/`order_items` lives in server-side services using the admin client — the browser Supabase
  client is used only for auth.
- **F2** — confirmed by grep across all 13 migrations: zero `GRANT` and zero `REVOKE` statements
  exist. The RFC-1 ACL probe correctly starts from undocumented Supabase defaults.

### Test gates

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC01, AC04, AC07 | Bank active cap holds under concurrent creates; cancel/confirm race converges to one result | Fully-Automated | `npx vitest run tests/integration/checkout-protection.db.test.ts --maxWorkers=1` (NEW file, RFC-2) — 50 concurrent same-user creates from independent `pg` connections against a real Postgres, then SQL-assert order count ≤ 2 | B |
| AC03, AC04 | Same idempotency key returns one order; changed payload returns 409; no duplicate coupon/stock/email | Fully-Automated | Same integration file — concurrent same-key creates, lost-response replay, reprice, stock-exhausted, cancel-then-replay cases | B |
| AC04, AC07 | Multi-line SUM restock returns the correct total units; coupon last-use returns exactly one slot; a create that fails after the `orders` insert leaves `used_count` unchanged | Fully-Automated | Same integration file — DB snapshot of `products.stock` and `coupons.used_count` before/after. The 2-line same-`product_id` case is a MANDATORY minimum fixture, not optional: `order.repository.ts:206` writes a constant `product_id` for every line | B |
| AC02 | Checkout limiter is fail-CLOSED (503) for new creates when Redis is down; TTL applied atomically; Retry-After is a real bucket second count | Hybrid | `npx vitest run tests/integration/checkout-rate-limit.test.ts` (NEW file, RFC-3) — precondition: an isolated Redis reachable via a test-only `REDIS_URL`; NOT the production Redis | B |
| AC08 | anon / authenticated / service-role cannot insert or update orders, order_items, or the new ledger tables; privileged RPC EXECUTE is revoked from PUBLIC | Hybrid | Deployed-DB role probe: connect with the anon key and the authenticated key, attempt `INSERT INTO orders`, `UPDATE orders`, `SELECT rpc(...)`; each must be rejected. Precondition: a staging Supabase project. This is the gate that makes AC01 real (F1) — enforcement must not ship before it | B |
| AC08 (IDOR/CSRF) | Foreign-order access 404s; missing/foreign Origin rejected; missing cron secret rejected | Fully-Automated | `npx vitest run app/api/checkout features/checkout features/admin-orders` — route-handler tests following the `app/api/staff/uploads/route.test.ts` pattern | B |
| AC05, AC06 | Customer claim does not set PAID, does not extend the deadline, does not return the bank slot | Fully-Automated | `npx vitest run features/checkout features/account` — service tests asserting state transitions; plus DB-level transition tests in the RFC-2 integration file | B |
| AC09 | Unpaid bank order cannot reach PROCESSING/SHIPPED; paid/cancelled orders are never restocked by the worker; confirm on a CANCELLED order is rejected | Fully-Automated | `npx vitest run features/admin-orders` + the RFC-2 integration file. The CANCELLED-rejected case is mandatory: `admin-orders.repository.ts:359` guards only `payment_method` and `payment_status` today | B |
| AC11, AC12 | COD cap/quota/retry behave; legacy PAYOS rows still display | Fully-Automated | `npx vitest run features/checkout features/account features/admin-orders` | B |
| Baseline | The pre-existing failure set is recorded before any code change, so new regressions are separable from old red | Fully-Automated | `npm run check` captured verbatim into `unpaid-order-abuse-protection_REPORT_baseline-check_<date>.md` and committed BEFORE the first edit (RFC-1 item 1). Currently RED at `lib/useAddresses.test.tsx` | B |
| AC10, AC06 | Customer keeps the cart when capped, is routed to existing unpaid orders, and sees true server state after reload / in a second tab | Agent-Probe | HUMAN walkthrough only — desktop + mobile, authenticated, comparing UI against a DB read after each action, with screenshots and a named confirmer. Agent browser automation cannot do this: Google-OAuth-only, no dev-login bypass | C — deferred to the RFC-4 gate, human-run |
| AC13 | 100k-row EXPLAIN uses the partial index; checkout p95 < 1s at 20 rps; lock wait p95 < 200ms | Hybrid | Isolated staging benchmark against a seeded 100k-order dataset | C — deferred to RFC-5; requires a staging environment that is not confirmed to exist |
| AC12 | Dry-run cutover, backfill, and rollback replay produce a reconciled ledger | Hybrid | Staging rehearsal + SQL reconciliation queries | C — deferred to RFC-5, same staging precondition |
| AC05 (expiry execution) | Overdue orders actually move to REVIEW_REQUIRED on a schedule | — | No proving test can be written: no scheduler exists in this repo (no `.github/workflows/`, no `vercel.json`, no cron, no Docker, no worker host). The transition logic itself IS proven by the RFC-2 integration file; what is unproven is that anything calls it on time. RFC-1 now gates RFC-3 on the owner picking a host | D — named residual; owner decision |
| AC14 | Global stock exposure and multi-account abuse are bounded | — | No proving test can be written: the thresholds do not exist. The rollout guard stays OFF and AC14 is NOT satisfied by this contract | D — named residual; owner decision |

gap-resolution legend: A — proven now. B — gate added by this plan's checklist. C — deferred to a
named later RFC. D — named residual, keep-active, continue.

Failing stub (AC01/AC04/AC07 cap race):
```
test("should hold the bank active cap at 2 under 50 concurrent same-user creates", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Same user 50 creates, cap race with cancel/confirm")
})
```

Failing stub (AC03/AC04 idempotency):
```
test("should return the same order for a repeated idempotency key and 409 on a changed payload", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Same key concurrent / lost response / reprice / stock exhausted / cancel replay")
})
```

Failing stub (AC04/AC07 ledger correctness):
```
test("should restock the summed quantity of all order_items lines sharing one product_id", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Multiline SUM restock, mandatory 2-line same-product_id fixture")
})
```

Failing stub (AC04/AC07 coupon leak):
```
test("should leave coupons.used_count unchanged when a create fails after the orders row is inserted", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Invalid item after order insert; coupon used_count must not leak")
})
```

Failing stub (AC08 IDOR/CSRF/cron-secret):
```
test("should 404 a foreign order, reject a foreign Origin, and reject a missing cron secret", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Anon/authenticated RPC/table access, foreign order, CSRF")
})
```

Failing stub (AC05/AC06 claim semantics):
```
test("should not mark PAID, not extend the deadline, and not release the slot on a customer claim", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: Customer claim does not PAID/extend slot; no-transfer resolve")
})
```

Failing stub (AC09 fulfilment guard):
```
test("should reject confirm-payment on a CANCELLED order and never restock a PAID order", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: confirmPayment order-status guard; cron confirm/cancel interleaving")
})
```

Failing stub (AC11/AC12 COD + legacy):
```
test("should apply the COD cap and quota while still displaying legacy PAYOS orders", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: COD cap/quota/retry, legacy PAYOS display")
})
```

Legacy line form (retained for existing validate-contract consumers):
- Cap / idempotency / ledger atomicity (AC01, AC03, AC04, AC07): Fully-automated: `npx vitest run tests/integration/checkout-protection.db.test.ts --maxWorkers=1` (file to be created in RFC-2, after the vitest project split lands)
- Routes, services, transitions (AC05, AC06, AC08, AC09, AC11, AC12): Fully-automated: `npx vitest run app/api/checkout features/checkout features/admin-orders features/account`
- Redis limiter behavior (AC02): hybrid: `npx vitest run tests/integration/checkout-rate-limit.test.ts` + precondition: isolated test Redis reachable via a test-only `REDIS_URL`
- Database role/ACL enforcement (AC08): hybrid: anon-key and authenticated-key insert/update/RPC probes + precondition: a staging Supabase project
- Baseline repo gate: Fully-automated: `npm run check` — ALREADY RED before any work starts; record the exact pre-existing failure set first (RFC-1 item 1) and only treat NEW failures as regressions
- Customer/staff UI walkthrough (AC10): agent-probe: human authenticated walkthrough, desktop + mobile, UI-vs-DB comparison after each action, named confirmer required
- Scheduler execution of expiry (AC05): known-gap: documented — no scheduler exists in this repo; owner must pick a host before RFC-3
- Global reserve ceiling / multi-account abuse (AC14): known-gap: documented — blocked on an owner threshold decision

### Dimension findings

- Infra fit: PASS — all three cycle-0 sub-concerns are closed in plan text and re-verified against
  source: the vitest project split is in RFC-2 with a version-valid API (vitest 4.1.10) plus an
  `exclude` fallback; `APP_BASE_URL` and `REDIS_URL` are added to `.env.example` in RFC-1 with a
  deployment-confirmation gate before CSRF/limiter enable, and both are confirmed read by live code;
  the missing scheduler is now an explicit owner-decision gate that blocks RFC-3 rather than a silent
  assumption. Residual: the scheduler host itself is still an owner decision (carried as a known-gap,
  not a plan defect).
- Test coverage: PASS — RFC-1 item 1 now makes capturing the red baseline verbatim a hard
  prerequisite ordered before the first code change, which was the exact ask. Tiering across the
  Verification Evidence table is correct and unchanged. Residual: the component layer stays thin
  (2 test files across 105 components), handled honestly by the RFC-4 Agent-Probe rather than
  overclaimed.
- Breaking changes: PASS — RFC-3 now carries a real compatibility window with a measurable cutover
  criterion (client ships the header, server warns+logs, enforce only after ≥24h of zero missing
  headers). Response-shape additions remain additive and safe. One documentation nit, carried as an
  execute-agent instruction rather than a concern: the Public Contracts table still reads "Bắt buộc
  `Idempotency-Key`" as the end-state contract without pointing at the window; the RFC-3 checklist
  explicitly overrides it ("Không đổi contract thành bắt buộc trong cùng một lần deploy").
- Security surface: PASS — F1 is now cited with the exact file:line and the exact mechanism, with the
  remediation named (drop the policy, REVOKE INSERT/UPDATE from `authenticated`) and its safety
  independently verified (no client-side writer exists). F2 is folded into the RFC-1 ACL probe so the
  probe starts from an undocumented grant state rather than an assumed-safe one. The cycle-0 risk —
  shipping the cap without the ACL work and creating false confidence — is now blocked by an explicit
  hard stop in the Autonomous Goal Block.
- RFC-1 (Preflight and invariants): PASS — mechanically feasible (read-only probing). The section now
  separates genuinely-unprobed infra (Redis/TLS, ingress IP, RPC ACL, staff actor) from the
  confirmed-absent scheduler, and adds the baseline-capture and env-documentation items. Highest-risk
  item is unchanged: declaring the gate passed without the ACL probe result, since every later cap
  guarantee rests on it.
- RFC-2 (Atomic persistence and lifecycle): PASS — all three cycle-0 gaps closed. The restock defect
  is now stated at its true severity (verified: constant `product_id` per line means every multi-line
  order under-restocks), the coupon leak is called out with the correct fix shape (remove the
  compensating-delete path, do not patch a decrement), and the vitest split is in the checklist ahead
  of any file landing under `tests/integration/`. Highest-risk edit is unchanged: swapping the
  stock/coupon triggers for the RPC/ledger inside one migration with a proven no-overlap window.
- RFC-3 (API and throttling): PASS — the CSRF `APP_BASE_URL` dependency and the missing scheduler are
  both gated upstream in RFC-1; the `Idempotency-Key` rollout is ordered; and the new
  `confirmPayment()` order-status guard item names a real, verified defect. Highest-risk edit is
  unchanged: flipping the limiter to fail-closed, which must ship together with Redis provisioning.
- RFC-4 (Customer/staff UX): PASS — unchanged from cycle 0 and nothing got worse. The OAuth-only
  walkthrough constraint is environmental, not a plan defect, and the plan already handles it with an
  Agent-Probe requiring a named confirmer. Highest-risk edit: deadline display must derive from server
  time only.
- RFC-5 (Cutover, regression, runbook): PASS — unchanged. The staging dependency is routed through
  RFC-1's probes and the gates are correctly tiered Hybrid with C-deferral. Highest-risk edit: the
  trigger-to-ledger cutover under live traffic; the maintenance-window approach must not be softened
  into a rolling deploy.

**Totals: 0 FAILs / 0 unresolved CONCERNs / 9 PASSes** (4 Layer 1 dimensions + 5 Layer 2 sections).

### Why this is CONDITIONAL and not PASS

All nine cycle-0 CONCERNs are genuinely closed, and there are zero FAILs. The gate is still
CONDITIONAL for two reasons, neither of which is a plan defect and neither of which warrants another
supplement cycle:

1. **Vacuous-green classification gate.** Two criteria — AC05's end-to-end scheduled expiry and AC14 —
   have no Fully-Automated, Hybrid, or Agent-Probe row; their only coverage is a named Known-Gap
   residual (gap-resolution D). A net gate cannot be a terminal PASS while developed behaviour rests
   on Known-Gap alone. Naming the gap and continuing is the correct handling; calling it PASS is not.
2. **Four owner decisions are genuinely outstanding** and the plan itself gates on them: the scheduler
   host, the AC14 thresholds (global reserve ceiling and per-user unpaid-units limit), the COD cap,
   and the review SLA plus audit-retention policy. Marking PASS would assert that nothing is
   outstanding, which is false.

This CONDITIONAL is terminal and EXECUTE-eligible: one PVL fix cycle is recorded in `results.tsv`,
every named concern is closed, and the remaining items are owner sign-offs rather than fixable plan
text. No SUPPLEMENT REQUEST is issued — there is nothing left that a plan edit can fix, and
re-listing owner decisions as gaps would be double-counting.

### Execute-agent instructions

| # | Instruction | Trigger condition |
|---|---|---|
| E1 | Run `npm run check` and commit its verbatim output as the baseline report BEFORE the first code edit. It is already RED at `lib/useAddresses.test.tsx`. Treat only NEW failures as regressions; never report a gate green against an unrecorded baseline. | Before any RFC-1 work |
| E2 | Do not enable any enforcement (cap, limiter, deadline, worker, CSRF allowlist) until the RFC-1 database ACL probe has run and its result is recorded. The `"Users create own orders"` policy at `init_schema.sql:271` is a live bypass of every app-layer protection. | Before RFC-2 cutover |
| E3 | `Idempotency-Key` is the END-STATE contract in the Public Contracts table, not a day-one requirement. Follow the RFC-3 compatibility window: client header first, server warn+log only, enforce 400/409 only after ≥24h of zero missing headers. If the two sections appear to disagree, RFC-3 wins. | RFC-3 entry |
| E4 | Land the vitest project split and the `test:integration` script BEFORE creating any file under `tests/integration/`. Otherwise the new DB tests join the default `npm test` run and fail on every machine without a test Postgres. | RFC-2 entry |
| E5 | Do not implement `POST /api/internal/orders/review-expired` until the owner has named a scheduler host. A route with no caller cannot gate AC05. | RFC-3 entry |
| E6 | High-risk classes apply (auth/authorization, schema migration, payment, inventory and coupon accounting). Produce the 5-artifact evidence pack in the task folder before finalize. | Before reporting RFC-5 done |

### Open gaps

All entries below are known-gaps carried forward from cycle 0. None is a new finding, and none was
made worse by the cycle-1 supplement.

- Scheduler for the expiry/review worker: known-gap — CONFIRMED ABSENT (no CI, cron, Docker, or worker
  host in this repo). Owner must pick a host; RFC-1 now gates RFC-3 on this decision.
- AC14 global stock exposure and multi-account abuse thresholds: known-gap — owner decision required.
  AC14 is NOT satisfied by this contract. The rollout guard stays OFF. Do not mark AC14 done on the
  strength of the account cap alone.
- COD cap (2/user), review SLA (4h), and audit-retention policy: known-gap — owner sign-off required.
  The proposed values are reasonable defaults but are not accepted as policy.
- RPC/table ACL for anon, authenticated, and service-role: known-gap — RFC-1 probe. This is the gate
  that makes AC01 real; enforcement must not ship before it.
- Redis provisioning and TLS for production: known-gap — RFC-1 probe. The checkout limiter cannot go
  fail-closed until this exists.
- Trusted ingress IP / `x-forwarded-for` overwrite behaviour: known-gap — RFC-1 probe. Until proven,
  the IP limiter is a soft signal only.
- Staff review actor and real coverage hours: known-gap — owner decision. The 4-hour review SLA cannot
  be promised without a named on-duty person and a real schedule.
- Staging environment for the RFC-5 rehearsal, benchmark, and rollback replay: known-gap — existence
  not confirmed.
- Component-layer test coverage (2 test files across 105 components): known-gap — the RFC-4 gates rest
  on a human walkthrough rather than automated component coverage.

Resolved since cycle 0 and therefore removed from this list: the `Idempotency-Key` compatibility
window (now ordered in RFC-3) and the missing plan frontmatter (now present).

### What this coverage does NOT prove

- `npx vitest run tests/integration/checkout-protection.db.test.ts` proves the cap, idempotency, and
  ledger invariants hold against a test Postgres. It does NOT prove they hold in production —
  production ACL, connection pooling, and PgBouncer transaction-mode behaviour are all different and
  unverified. It does NOT prove the app-layer path is the only writer; that is the ACL gate's job. It
  proves nothing about Redis or the limiter.
- `npx vitest run tests/integration/checkout-rate-limit.test.ts` proves the limiter script is atomic
  and the TTL applies against an isolated Redis. It does NOT prove the production Redis exists, is
  reachable over TLS, or is sized for the traffic, and it does NOT prove the fail-closed path returns
  503 to a real browser through the real ingress.
- `npx vitest run app/api/checkout features/checkout features/admin-orders features/account` proves
  the route handlers and services enforce auth, ownership, state guards, and error mapping against a
  mocked Supabase client. It does NOT prove any transaction, lock, or race property — mocked Supabase
  cannot demonstrate a lock. It does not prove RLS or grants, which are database-side.
- The anon/authenticated role probe proves those two roles are rejected at the moment it runs. It does
  NOT prove no other path writes orders (seed scripts, the SQL editor, a future admin tool, or a
  leaked service-role key), and it does not prove Supabase's default grants stay revoked after a
  future migration or a dashboard change.
- The `npm run check` baseline capture proves what was already failing before this work started. It
  does NOT make the suite green, it does not cover the component layer meaningfully, and it enforces
  no coverage threshold.
- The vitest project split proves DB tests are excluded from the default run. It does NOT prove the
  integration tests themselves pass anywhere, because no test Postgres has been confirmed to exist.
- The human walkthrough proves the flows a person actually clicked, on the devices they used, at that
  moment. It does NOT prove multi-tab, slow-network, or back-button variants unless explicitly
  performed, and it cannot be re-run automatically as a regression gate.
- Nothing here proves the expiry worker runs on time, because there is no scheduler. Overdue orders
  will move to review only when something calls the route.
- Nothing here proves AC14. Global stock exposure and multi-account abuse remain unbounded until the
  owner sets thresholds.
- No gate here proves a customer actually did or did not send money. Every "unpaid" verdict in this
  system is a staff judgement against a bank statement, exactly as the plan's Overview states.
- This contract validates PLAN TEXT, not implemented code. Nothing in the blast radius has been
  implemented; every gate above is a commitment for EXECUTE, not evidence.

Gate: CONDITIONAL (0 FAILs; all 9 cycle-0 CONCERNs verified closed against real source; remaining
items are named owner-decision known-gaps and the AC05/AC14 Known-Gap-only residuals. Terminal and
EXECUTE-eligible — 1 PVL fix cycle recorded; do NOT route back for another supplement cycle.)
Accepted by: session (vc-validate-agent, PVL cycle 1 re-validation) — accepted as GATING known-gaps,
not as satisfied criteria. Accepted concerns, by name: scheduler host absent; AC14 thresholds unset
(AC14 explicitly NOT satisfied); COD cap unratified; review SLA unratified; audit-retention policy
unratified; RPC/table ACL unprobed; production Redis unprovisioned; trusted ingress IP unverified;
staff review actor unnamed; staging environment unconfirmed; component-layer coverage thin. Owner
sign-off is still required on the four policy items before the corresponding enforcement ships — the
plan's RFC-1 gates and the Autonomous Goal Block hard stops enforce this ordering, which is why
EXECUTE may begin on RFC-1 (read-only probing) without them.

## Autonomous Goal Block

```
SESSION GOAL: Chống spam đặt hàng chưa chuyển khoản — enforce a bank-transfer unpaid-order cap,
idempotent checkout, atomic stock/coupon reservation, and a staff-reviewed expiry path.
Charter + umbrella plan: N/A — single standalone COMPLEX plan.
Autonomy: Implement RFC-1 through RFC-5 in order; each RFC's Gate must pass before the next
starts. Reversible code and config changes proceed without asking. Write reports and update the
plan file autonomously.
Hard stop conditions / safety constraints:
- Do not enable any enforcement (cap, limiter, deadline, worker) until the RFC-1 database ACL
  probe has been run and the result recorded. The RLS policy "Users create own orders" is a live
  bypass of every app-layer protection; shipping the cap without closing it creates false safety.
- Do not turn the checkout limiter fail-closed until a production Redis is provisioned. Doing so
  turns a Redis outage into a checkout outage.
- Do not set AC14 thresholds yourself. The global reserve ceiling and per-user unpaid-units limit
  are owner decisions based on a real stock snapshot. The rollout guard stays OFF until then.
- Do not claim the expiry worker works. No scheduler exists in this repo; the owner must choose a
  host first.
- Do not run migrations, reconciliation, or benchmarks against the production database. Do not
  send real emails during implementation.
- Do not record a human walkthrough as done without a named confirmer and evidence. Google-OAuth-
  only auth means no agent can perform it.
- Do not run the trigger-to-ledger cutover as a rolling deploy. It needs the maintenance window.
Next phase: EXECUTE: process/features/checkout/active/unpaid-order-abuse-protection_06-09-26/unpaid-order-abuse-protection_PLAN_06-09-26.md
Validate contract: inline in plan (## Validate Contract)
Execute start: first record the pre-existing failure set with `npm run check` (it is already RED —
lib/useAddresses.test.tsx fails at import). Then RFC-1, which is read-only probing and writes no
code. Fully-auto gates once RFC-2 lands: `npx vitest run tests/integration/checkout-protection.db.test.ts --maxWorkers=1`
and `npx vitest run app/api/checkout features/checkout features/admin-orders features/account`.
Hybrid gates: isolated-Redis limiter test, staging ACL probe. Agent-probe: human walkthrough only.
High-risk pack: yes — auth/authorization, database schema migration, payment, inventory and coupon
accounting. The 5-artifact evidence pack is required in the task folder before finalize.
```


## Resume and Execution Handoff

1. **Selected plan file path**: `process/features/checkout/active/unpaid-order-abuse-protection_06-09-26/unpaid-order-abuse-protection_PLAN_06-09-26.md`.
2. **Last completed phase or step**: lập PLAN từ source repo; PVL cycle 1 supplement đã áp dụng (9 gaps); chưa implement bất kỳ RFC nào.
3. **Validate-contract status**: written (06-09-26) — Gate CONDITIONAL, chờ owner chấp nhận known-gaps.
4. **Supporting context files loaded**: `process/context/all-context.md`, `process/context/payment/all-payment.md`,
   `process/context/database/all-database.md`, `process/context/auth/all-auth.md`, `process/context/tests/all-tests.md`;
   `.claude/skills/vc-generate-plan/SKILL.md` và references generate-plan/example-complex-prd.
5. **Next step for a fresh agent**: đọc PLAN, git status, diff/migration mới nhất; chạy lại PVL trên đúng file này;
   giữ nguyên edits của tác vụ khác. Không suy diễn approval triển khai từ việc người dùng yêu cầu lập plan.

Next Step: duyệt chính sách và chạy VALIDATE; sau contract đạt và người dùng yêu cầu
`ENTER EXECUTE MODE`, thực hiện RFC-1 → RFC-5 trong cùng execution stream.

## UPDATE PROCESS Note (06-09-26)

**Classification: Keep in active/testing.** This is a documentation-reconciliation pass only —
the plan is NOT archived and stays in `active/`. All 5 RFCs are CODE DONE + independently
EVL-confirmed, but zero RFCs are VERIFIED (see RFC5-REPORT §9 for the full owner/infra checklist).
Nothing was committed. No enforcement is live (`CHECKOUT_PROTECTION_ENFORCED=false`).

### Context docs updated and why

- **`process/context/payment/all-payment.md`** — added a "Unpaid-order abuse protection" section:
  what actually changed (two-write path + triggers → single atomic RPC + reservation ledger +
  idempotency table + append-only audit), the new payment-review lifecycle states, the second
  RLS-policy bypass found (`"Users insert own order items"`), and the currently-open
  production migration-applied/code-not-deployed mismatch window fact.
- **`process/context/database/all-database.md`** — added a "Checkout abuse-protection migration"
  section: new columns/tables, the 3 dropped triggers + 2 dropped RLS policies and why that closes
  a real bypass, the new invoker-rights RPCs, and the still-open file/production parity risk (RFC-5
  found and fixed 2 real migration bugs — `pg_catalog.current_user` abort-on-CANCELLED-order and a
  missing `DROP POLICY IF EXISTS` — after the owner had already applied an earlier version to
  production). Also flagged that the integration-test fixtures are a hand-reconstructed schema, not
  the real deployed one.
- **`process/context/tests/all-tests.md`** — documented the new `unit`/`integration` vitest
  project split, the `TEST_DATABASE_URL`/`TEST_REDIS_URL` skip-clean convention, the
  disposable-Docker-container pattern for local integration testing, and the durable tooling-
  hygiene finding that a corrupted `.next/dev/types/validator.ts` silently disabled ALL
  `tsc --noEmit` semantic checking for 3 RFCs — `npm run build` is the gate that actually catches
  this class of failure.
- **Root `all-context.md`** — routing block regenerated mechanically (`--emit-routing`) to pick up
  the updated dates/keywords on the three group files above; no content or group-structure change.
- **Not touched**: `process/context/auth/all-auth.md`, `process/context/uxui/all-uxui.md`,
  `process/context/planning/all-planning.md` — nothing in this session changed the auth model,
  design system, or planning conventions; each was read-only per the task constraint.

### Outstanding owner/infra items

Not re-derived here — see `unpaid-order-abuse-protection_RFC5-REPORT_06-09-26.md` §9 for the
complete, categorized list (6 owner decisions, 4 infra probes, 2 human actions, 1 compatibility-
window closure criterion, plus the final VERIFIED bar).

### Single most important operational fact for the next person

**Production has the RFC-2 migration applied; the application code that depends on it is still
uncommitted and undeployed.** This is a live schema/code mismatch window on the real production
Supabase project (see `results.tsv` cycle 9). It is currently benign only because the app has no
deploy path yet (runs local only), per the owner's own verification. Closing this window — by
committing and deploying the RFC-2/3/4/5 code — is more urgent than any other item on this list,
because every day it stays open is a day the deployed schema and the deployed app code can silently
drift further apart. The reconciliation SQL for the two known pre-existing data discrepancies
(R5/R6) is already written and waiting in `unpaid-order-abuse-protection_RUNBOOK_06-09-26.md` §4.
