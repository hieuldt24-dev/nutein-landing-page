---
name: report:unpaid-order-abuse-protection-runbook
description: "Runbook vận hành cho cutover chống spam đơn chưa chuyển khoản — 9 bước rollout, kill-switch, truy vấn đối soát, ACL probe, quyết định owner còn thiếu"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-5
---

# Runbook — Cutover chống spam đơn chưa chuyển khoản

**TL;DR — chưa được phép chạy.** Runbook này đã sẵn sàng về mặt thao tác, nhưng
cutover BỊ CHẶN bởi 6 quyết định của owner và 4 lần probe hạ tầng chưa làm (xem
§7 và §8). Không bật enforcement nào cho tới khi tất cả được giải quyết.

**Điều nguy hiểm nhất trong tài liệu này:** migration và code phải lên CÙNG LÚC
trong một cửa sổ bảo trì. Deploy cuốn chiếu (rolling) sẽ âm thầm làm sai tồn kho
và số lượt coupon — xem §2.

---

## 1. Trạng thái hiện tại (tính đến 06-09-26)

| Hạng mục | Trạng thái |
|---|---|
| RFC-1 preflight | Một phần — ACL probe, Redis, ingress IP, scheduler CHƯA probe |
| RFC-2 migration + RPC + ledger | CODE DONE, có test trên Postgres cục bộ. **CHƯA apply lên Supabase** |
| RFC-3 API + limiter | CODE DONE, có test trên Redis thật. Route cron cố ý KHÔNG làm |
| RFC-4 UI khách + staff | CODE DONE. Chưa có ai đi thử bằng tay |
| RFC-5 cutover/runbook | Một phần — build xanh, diễn tập cục bộ xong, diễn tập staging PENDING |
| Enforcement | **TẮT** — `CHECKOUT_PROTECTION_ENFORCED` mặc định `false` |

Không hạng mục nào ở trạng thái VERIFIED.

---

## 2. Yêu cầu cửa sổ bảo trì (đọc trước mọi thứ khác)

Migration `supabase/migrations/20260906000000_checkout_abuse_protection.sql`
chuyển quyền trừ kho và tăng `coupons.used_count` từ **trigger** sang **RPC**.
Header của chính file migration nói rõ:

> Code ứng dụng tương ứng (`features/checkout/services/order.repository.ts`)
> PHẢI được deploy CÙNG LÚC. Nếu apply migration mà chạy code cũ: đơn vẫn tạo
> được nhưng KHÔNG trừ kho và KHÔNG tính lượt coupon. Nếu deploy code mới mà
> chưa apply migration: RPC không tồn tại -> checkout lỗi.
> => Cần maintenance window ngắn, không rolling deploy.

Nghĩa là: trong lúc cuốn chiếu, một phần traffic chạy code cũ trên schema mới sẽ
tạo đơn **không trừ kho** — bán quá số hàng có thật, và không ai nhận ra cho tới
khi đối soát. Đây là lý do bước 5 dưới đây bắt buộc chặn checkout.

---

## 3. Checklist 9 bước cho người vận hành

### Bước 1 — Chụp số liệu read-only TRƯỚC khi đụng gì

```sql
-- 1.1 Đơn đang giữ chỗ theo phương thức
SELECT payment_method, status, payment_status, COUNT(*)
FROM public.orders GROUP BY 1,2,3 ORDER BY 1,2,3;

-- 1.2 Tuổi đơn bank chưa trả tiền
SELECT date_trunc('day', created_at) AS ngay, COUNT(*)
FROM public.orders
WHERE payment_method = 'BANK_TRANSFER' AND payment_status = 'UNPAID'
  AND status NOT IN ('CANCELLED','RETURNED')
GROUP BY 1 ORDER BY 1 DESC;

-- 1.3 Đơn KHÔNG có dòng items (bất thường, phải xử lý tay)
SELECT o.id, o.order_code, o.status FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);

-- 1.4 Coupon: đối chiếu used_count với số đơn thực tế đã dùng
SELECT c.code, c.used_count, c.usage_limit,
       COUNT(o.id) FILTER (WHERE o.status NOT IN ('CANCELLED','RETURNED')) AS don_con_song
FROM public.coupons c LEFT JOIN public.orders o ON o.coupon_id = c.id
GROUP BY c.id, c.code, c.used_count, c.usage_limit
HAVING c.used_count <> COUNT(o.id) FILTER (WHERE o.status NOT IN ('CANCELLED','RETURNED'));

-- 1.5 Tồn kho hiện tại
SELECT id, sku, stock FROM public.products;

-- 1.6 Người dùng đang có >2 đơn bank giữ chỗ (sẽ bị chặn tạo thêm sau cutover)
SELECT user_id, COUNT(*) AS n FROM public.orders
WHERE payment_method = 'BANK_TRANSFER' AND payment_status = 'UNPAID'
  AND status NOT IN ('CANCELLED','RETURNED')
GROUP BY user_id HAVING COUNT(*) > 2 ORDER BY n DESC;
```

Lưu toàn bộ output vào task folder. Đây là mốc so sánh duy nhất sau này.

**Chênh lệch bạn CHẮC CHẮN sẽ thấy ở 1.4/1.5:** trigger restock cũ dùng
`UPDATE ... FROM` nên với đơn nhiều dòng cùng `product_id` nó chỉ hoàn được MỘT
dòng. Mọi đơn nhiều dòng đã huỷ trong quá khứ đều hoàn kho THIẾU. Migration cố ý
KHÔNG tự sửa (§8 của migration). Đây là việc đối soát thủ công của owner.

### Bước 2 — Migration là additive về schema

Không cần thao tác riêng. Toàn bộ cột/bảng mới đều nullable hoặc có DEFAULT.
Không đặt deadline cho đơn lịch sử.

### Bước 3 — Hiểu cách đơn legacy được đối xử

- `protection_version IS NULL` = đơn legacy. Vẫn hiển thị bình thường.
- Đơn bank chưa trả tiền của legacy **vẫn tính vào cap** để khách không né được.
- Khách đang có >2 đơn (truy vấn 1.6): giữ nguyên đơn cũ, chặn tạo thêm. Xử lý
  bằng staff review, KHÔNG huỷ hàng loạt cho đẹp chỉ số.

### Bước 4 — Backfill ledger (nằm trong chính migration, §8)

Backfill chỉ GHI LẠI trạng thái đang có, không đổi một con số nào. Đã diễn tập
cục bộ: `products.stock`, `coupons.used_count`, số đơn và số dòng đơn đều không
đổi (bằng chứng: `tests/integration/checkout-cutover-rehearsal.db.test.ts` §(a)).

### Bước 5 — Cửa sổ bảo trì: deploy code + migration CÙNG LÚC

```
5.1  Bật trang bảo trì / chặn POST /api/checkout ở ingress.
5.2  Dừng mọi tiến trình nền chạm orders (hiện tại: KHÔNG có — chưa có scheduler).
5.3  Xác nhận không còn request checkout nào đang bay (theo dõi log ~60s).
5.4  Apply migration (một transaction — tự rollback toàn bộ nếu lỗi):
       supabase db push
     hoặc dán nguyên file vào SQL Editor.
5.5  Deploy build ứng dụng có RFC-2/3/4.
5.6  Chạy các truy vấn đối soát ở §4 — TẤT CẢ phải trả 0 dòng.
5.7  Chạy ACL probe ở §5 — mọi thao tác ghi phải bị từ chối.
5.8  Mở lại checkout.
```

**KHÔNG cuốn chiếu.** Xem §2.

Nếu bước 5.4 lỗi: migration là một transaction duy nhất nên database quay về
nguyên trạng. Đọc lỗi, sửa, chạy lại. Migration idempotent — chạy lại an toàn
(đã diễn tập: apply lần hai thành công, số liệu không đổi).

### Bước 6 — Validate trước khi mở checkout

Chạy §4 (đối soát) và §5 (ACL). Chỉ mở checkout khi cả hai sạch. Deadline chỉ áp
cho đơn TẠO MỚI từ mốc cutover; đơn cũ không bị gán deadline hồi tố.

### Bước 7 — Theo dõi 24–48h

Xem §6 (danh sách metric và alert).

### Bước 8 — Rollback ứng dụng + kill-switch

**Rollback ở đây KHÔNG phải là drop bảng hay hồi sinh trigger cũ.**

```
8.1  Chỉ rollback về bản build TƯƠNG THÍCH với RPC/ledger.
8.2  Kill-switch: đặt CHECKOUT_PROTECTION_ENFORCED=false.
8.3  Nếu cần nặng hơn: chặn POST /api/checkout ở ingress (dừng nhận đơn mới),
     vẫn để nguyên đường đọc đơn và đường đối soát của staff.
```

`CHECKOUT_PROTECTION_ENFORCED=false` **có** làm những việc sau:
- Limiter chuyển từ fail-closed sang chỉ ghi log; Redis chết không làm chết checkout.
- Vượt hạn mức chỉ warn, không trả 429.
- Thiếu `Idempotency-Key` vẫn được chấp nhận (vốn đã như vậy — xem §6.3).

`CHECKOUT_PROTECTION_ENFORCED=false` **KHÔNG** làm những việc sau — đây là phần
hay bị hiểu nhầm:
- **KHÔNG** phục hồi trigger cũ. Kho và coupon vẫn do RPC/ledger quản lý.
- **KHÔNG** mở lại quyền ghi trực tiếp cho `anon`/`authenticated`. REVOKE nằm ở
  cấp GRANT trong database, biến môi trường không đụng tới được.
- **KHÔNG** tắt cap trong RPC. Cap được cưỡng chế ở tầng database.
- **KHÔNG** xoá deadline đã ghi trên đơn.

Nói cách khác: kill-switch giảm áp lực ở tầng ứng dụng, KHÔNG đưa hệ thống về
trạng thái trước cutover.

### Bước 9 — Rollback dữ liệu = forward-fix, có owner duyệt

- KHÔNG `DROP TABLE`, KHÔNG xoá audit, KHÔNG xoá idempotency key đã dùng.
- Sửa sai bằng giao dịch bù trừ dựa trên ledger, có người duyệt.
- Sau rollback, replay cùng một `Idempotency-Key` vẫn phải trả về ĐÚNG đơn cũ.
- Không bao giờ dựng lại `trg_restock_on_cancel_or_return` — chạy song song với
  release routine sẽ hoàn kho hai lần.

---

## 4. Truy vấn đối soát (chạy sau bước 5.4 và bất cứ lúc nào nghi ngờ)

Cả 5 truy vấn phải trả **0 dòng**. Bản chạy được nằm ở
`tests/integration/checkout-cutover-rehearsal.db.test.ts` §(g).

```sql
-- R1: đơn thiếu dòng ledger
SELECT o.id, o.order_code FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_resource_reservations r WHERE r.order_id = o.id);

-- R2: ledger mồ côi
SELECT r.order_id FROM public.order_resource_reservations r
WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = r.order_id);

-- R3: ledger mâu thuẫn trạng thái đơn
SELECT o.order_code, o.status, o.payment_status, r.stock_state
FROM public.orders o JOIN public.order_resource_reservations r ON r.order_id = o.id
WHERE (o.status IN ('CANCELLED','RETURNED') AND r.stock_state <> 'RELEASED')
   OR (o.payment_status = 'PAID'            AND r.stock_state  = 'RELEASED');

-- R4: coupon âm hoặc vượt hạn mức  (used_count âm = SỰ CỐ DỪNG-GHI,
--     tuyệt đối không "sửa" bằng cách kẹp về 0)
SELECT code, used_count, usage_limit FROM public.coupons
WHERE used_count < 0 OR (usage_limit IS NOT NULL AND used_count > usage_limit);

-- R5: đơn đã huỷ bị trigger CŨ hoàn kho THIẾU (đơn nhiều dòng)
SELECT o.order_code, SUM(oi.quantity) AS le_ra_phai_hoan
FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.status IN ('CANCELLED','RETURNED')
GROUP BY o.id, o.order_code HAVING COUNT(oi.id) > 1;

-- R6: đơn BANK_TRANSFER đã DELIVERED nhưng vẫn UNPAID -> BỊ ĐẾM VÀO CAP
--     Migration §8 chỉ set released_at cho CANCELLED/RETURNED, nên nhóm này
--     giữ chỗ vĩnh viễn. Owner phải quyết: đánh dấu PAID hay set released_at.
SELECT id, order_code, created_at FROM public.orders
WHERE payment_method = 'BANK_TRANSFER' AND payment_status = 'UNPAID'
  AND status = 'DELIVERED' AND released_at IS NULL;
```

---

## 5. Thủ tục ACL probe của RFC-1 (owner chạy — agent KHÔNG chạy được)

Chưa từng chạy: phiên làm việc này không có credentials Supabase. Đây là cổng
làm cho cap trở thành thật; **không bật enforcement trước khi probe sạch.**

Cần: `NEXT_PUBLIC_SUPABASE_URL`, anon key, và một access token của người dùng đã
đăng nhập thật (role `authenticated`).

```bash
export URL="https://<project>.supabase.co"
export ANON="<anon key>"
export USER_JWT="<access_token của user đã login>"

# P1 — anon INSERT orders   => KỲ VỌNG 401/403
curl -s -o /dev/null -w "P1 %{http_code}\n" -X POST "$URL/rest/v1/orders" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{"order_code":"PROBE-1"}'

# P2 — authenticated INSERT orders (lỗ hổng F1)  => KỲ VỌNG 401/403
curl -s -o /dev/null -w "P2 %{http_code}\n" -X POST "$URL/rest/v1/orders" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"order_code":"PROBE-2"}'

# P3 — authenticated INSERT order_items (lỗ hổng F3)  => KỲ VỌNG 401/403
curl -s -o /dev/null -w "P3 %{http_code}\n" -X POST "$URL/rest/v1/order_items" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"product_name":"probe","price":1,"quantity":1}'

# P4 — authenticated UPDATE orders -> PAID  => KỲ VỌNG 401/403/0 dòng
curl -s -o /dev/null -w "P4 %{http_code}\n" -X PATCH "$URL/rest/v1/orders?order_code=eq.PROBE" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"payment_status":"PAID"}'

# P5 — authenticated gọi RPC đặc quyền  => KỲ VỌNG 401/403/404
curl -s -o /dev/null -w "P5 %{http_code}\n" -X POST "$URL/rest/v1/rpc/checkout_create_order_atomic" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"payload":{}}'

# P6 — anon/authenticated ghi bảng ledger  => KỲ VỌNG 401/403
curl -s -o /dev/null -w "P6 %{http_code}\n" -X POST "$URL/rest/v1/order_resource_reservations" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"stock_state":"RESERVED"}'

# P7 — IDOR: đọc đơn của người khác  => KỲ VỌNG 0 dòng
curl -s "$URL/rest/v1/orders?select=id&id=eq.<id-đơn-người-khác>" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT"
```

Bất kỳ probe nào trả 2xx kèm ghi được dữ liệu = **DỪNG CUTOVER**. Lưu toàn bộ
output vào task folder; đây là artifact `security-acl-probe` của evidence pack.

---

## 6. Giám sát và cảnh báo

### 6.1 Metric cần thu
attempts / accepted / replay / 429 / 409 / 503; idempotency conflicts; cap hits;
tuổi hàng đợi review + kích thước hàng đợi; stock reserved/released; coupon
delta; deadlock + số lần retry; worker lag/errors (chưa áp dụng — chưa có worker).

### 6.2 Alert
- Hàng đợi review vượt SLA (SLA chưa được chốt — xem §7).
- Có lần thử confirm-payment trên đơn đã CANCELLED.
- Lệch giữa release và ledger, hoặc `coupons.used_count` âm → **sự cố dừng-ghi**.
  Không "sửa" bằng cách kẹp giá trị âm về 0.
- Worker không heartbeat > 5 phút — **chưa áp dụng**, chưa có worker.

### 6.3 Đóng cửa sổ tương thích `Idempotency-Key`
Hiện tại server **đọc** header nhưng thiếu header vẫn trả 201, chỉ warn + ghi
log — cố ý (execute-instruction E3).

- Log được phát ở `features/checkout/services/checkout.service.ts:205`, qua
  `logger.warn` của pino (`src/logging/logger.ts`), nên nó nằm ở stdout của
  ứng dụng, cùng nơi với mọi log khác.
- **Tiêu chí đóng cửa sổ:** ≥ 24 giờ liên tục KHÔNG có log thiếu header nào,
  đo trên traffic thật sau khi client đã deploy.
- Chỉ khi đó mới chuyển sang trả 400/409 cho request thiếu header.
- Chưa đủ 24h sạch thì không được siết — sẽ chặn nhầm khách đang dùng bản cũ.

---

## 7. Quyết định của owner còn thiếu — BẮT BUỘC trước khi bật enforcement

Không hạng mục nào dưới đây được agent tự chốt.

| # | Quyết định | Chặn cái gì | Nguồn |
|---|---|---|---|
| 1 | **Scheduler host** — platform cron / scheduler ngoài / staff quét tay | `POST /api/internal/orders/review-expired` (RFC-3 E5 hoãn). Không có nó, đơn quá hạn KHÔNG tự vào review | RFC-1 §(c) |
| 2 | **COD cap** (đề xuất 2/user) | Khách chuyển sang COD để né cap bank | RFC-1 §(d) |
| 3 | **Trần reserve toàn cửa hàng + hạn units chưa trả/user** | AC14. Chưa có thì AC14 KHÔNG đạt; rollout guard giữ OFF | Validate contract §Open gaps |
| 4 | **Review SLA + tên người trực** (đề xuất 4h giờ hành chính) | Không hứa được SLA khi chưa có người thật và lịch thật | RFC-1 §(d) |
| 5 | **Chính sách lưu audit** | `order_payment_events` là append-only, cần chính sách lưu giữ | RFC-1 §(d) |
| 6 | **`.gitignore` `!.env.example`** — `.gitignore:34` là `.env*` không có negation, nên `.env.example` đang bị ignore và các biến mới KHÔNG commit được | Người deploy không thấy `APP_BASE_URL`, `REDIS_URL`, `CLIENT_IP_HASH_SECRET` | RFC-1 F4 |

### Probe hạ tầng còn thiếu (không phải quyết định chính sách, nhưng cũng chặn)

| # | Probe | Chặn cái gì |
|---|---|---|
| 7 | ACL probe §5 trên Supabase thật | Toàn bộ cutover |
| 8 | Provision Redis production (+TLS) | Bật limiter fail-closed. Redis chết = checkout chết |
| 9 | Hành vi ghi đè header IP của ingress | Đặt `TRUSTED_CLIENT_IP_HEADER`. Chưa probe thì limiter IP chỉ là tín hiệu mềm |
| 10 | Supabase staging | Diễn tập cutover thật + benchmark AC13 |

---

## 8. Cái gì đã được chứng minh, cái gì chưa

**Đã chứng minh (cục bộ, phiên 06-09-26):**
- `npm run build` xanh, exit 0 — 4 route API mới + trang account mới đều compile.
- `npx tsc --noEmit` — 0 lỗi.
- Diễn tập cutover/backfill/rollback: 31/31 test trên Postgres dùng-rồi-bỏ.
- Bất biến cap/idempotency/ledger: 25 test DB (RFC-2).
- Limiter: 8 test trên Redis thật (RFC-3).
- Rà quét log: không có IP thô / JWT / địa chỉ / chứng từ ngân hàng / secret nào
  bị ghi log; lỗi 500 không lộ SQL hay stack ra client.

**Chưa chứng minh:**
- Mọi thứ liên quan tới database đã deploy (migration chưa từng chạy ở đó).
- ACL probe (§5) — cần credentials.
- Benchmark AC13 (EXPLAIN 100k dòng, p95 20 rps) — cần staging.
- Có người thật đi thử UI — cần người xác nhận có tên (Google-OAuth-only).
- Đơn quá hạn có tự vào review đúng giờ hay không — chưa có scheduler.
- AC14 — chưa có ngưỡng.
