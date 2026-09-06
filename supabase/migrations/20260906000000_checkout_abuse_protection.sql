-- ============================================================================
-- RFC-2 — Atomic checkout persistence, reservation ledger, and write ACL
-- Plan: process/features/checkout/active/unpaid-order-abuse-protection_06-09-26/
--       unpaid-order-abuse-protection_PLAN_06-09-26.md
--
-- APPLY 1 LẦN, THỦ CÔNG bởi owner (CLI `supabase db push` hoặc SQL Editor) —
-- KHÔNG tự chạy trong runtime app. Cùng convention với
-- 20260724000000_reserve_stock_on_order_create.sql.
--
-- CẢNH BÁO CUTOVER (đọc trước khi apply):
--   Migration này CHUYỂN QUYỀN trừ kho / tăng used_count từ trigger sang RPC.
--   Code ứng dụng tương ứng (features/checkout/services/order.repository.ts)
--   PHẢI được deploy CÙNG LÚC. Nếu apply migration mà chạy code cũ:
--   đơn vẫn tạo được nhưng KHÔNG trừ kho và KHÔNG tính lượt coupon.
--   Nếu deploy code mới mà chưa apply migration: RPC không tồn tại -> checkout lỗi.
--   => Cần maintenance window ngắn, không rolling deploy (plan §Rollout bước 5).
--
-- Migration này là ADDITIVE về schema (thêm cột/bảng/hàm) nhưng KHÔNG additive
-- về hành vi: nó DROP 3 trigger ghi dữ liệu và 2 RLS policy. Đó là chủ đích —
-- xem §4 và §5.
-- ============================================================================

BEGIN;

-- ============================================================================
-- §1. ORDERS — cột bổ sung (tất cả nullable / có DEFAULT => additive, an toàn
--     với dữ liệu lịch sử; không backfill deadline cho đơn cũ)
-- ============================================================================

ALTER TABLE public.orders
  -- NULL = đơn legacy tạo trước cơ chế bảo vệ. Mọi code phải coi NULL là
  -- "legacy", không phải "chưa set".
  ADD COLUMN IF NOT EXISTS protection_version  INT,
  ADD COLUMN IF NOT EXISTS payment_expires_at  TIMESTAMPTZ,
  -- Cố ý KHÔNG dùng enum: thêm giá trị vào "OrderStatus"/"PaymentStatus" sẽ phá
  -- mọi consumer đang exhaustive-switch. TEXT + CHECK là additive thật.
  ADD COLUMN IF NOT EXISTS payment_review_state TEXT,
  ADD COLUMN IF NOT EXISTS review_due_at       TIMESTAMPTZ,
  -- Optimistic concurrency token cho mọi transition. Đơn legacy = NULL, RPC
  -- coi NULL tương đương 0.
  ADD COLUMN IF NOT EXISTS state_version       INT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  -- Thời điểm slot bank được giải phóng (kho/coupon đã trả). Đơn còn giữ chỗ
  -- luôn có released_at IS NULL — đây là predicate của cap.
  ADD COLUMN IF NOT EXISTS released_at         TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_review_state_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_review_state_check
      CHECK (payment_review_state IS NULL OR payment_review_state IN (
        'AWAITING_TRANSFER',
        'PAYMENT_CLAIMED',
        'REVIEW_REQUIRED',
        'CANCEL_REQUESTED',
        'RELEASED',
        'SETTLED',
        'LATE_TRANSFER_REVIEW'
      ));
  END IF;
END $$;

-- Cap predicate: đơn BANK_TRANSFER chưa trả tiền, chưa terminal, chưa release.
-- Partial index để COUNT không quét lịch sử (plan §Performance).
CREATE INDEX IF NOT EXISTS idx_orders_active_unpaid_bank
  ON public.orders (user_id)
  WHERE payment_method = 'BANK_TRANSFER'
    AND payment_status = 'UNPAID'
    AND released_at IS NULL
    AND status NOT IN ('CANCELLED', 'RETURNED');

-- Worker quét đơn tới hạn review theo (review_due_at, id) — keyset pagination,
-- không OFFSET (plan §Performance: OFFSET bỏ sót khi trạng thái đổi giữa batch).
CREATE INDEX IF NOT EXISTS idx_orders_review_due
  ON public.orders (review_due_at, id)
  WHERE review_due_at IS NOT NULL AND released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_expires_at
  ON public.orders (payment_expires_at)
  WHERE payment_expires_at IS NOT NULL AND released_at IS NULL;

-- ============================================================================
-- §2. BẢNG MỚI
-- ============================================================================

-- 2.1 Idempotency bền vững. Chỉ lưu hash + con trỏ tới order — KHÔNG lưu
-- snapshot PII lần thứ hai (plan §Idempotency).
CREATE TABLE IF NOT EXISTS public.checkout_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  idempotency_key  TEXT        NOT NULL,
  request_hash     TEXT        NOT NULL,
  hash_version     INT         NOT NULL DEFAULT 1,
  order_id         UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scope (user_id, key) — key của user A không bao giờ đụng key của user B.
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_requests_user_key
  ON public.checkout_requests (user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_order
  ON public.checkout_requests (order_id);

-- 2.2 Ledger giữ chỗ: MỘT dòng cho MỖI order. Đây là nguồn sự thật duy nhất
-- trả lời "đơn này còn đang giữ kho/lượt coupon không" — thay cho việc suy
-- diễn từ status (suy diễn là nguyên nhân của lỗi double-restock cũ).
CREATE TABLE IF NOT EXISTS public.order_resource_reservations (
  order_id     UUID        PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  -- RESERVED = đang giữ kho, có thể trả lại.
  -- RELEASED  = đã trả kho đúng một lần.
  -- CONSUMED  = hàng đã giao, KHÔNG bao giờ trả lại tự động.
  stock_state  TEXT        NOT NULL DEFAULT 'RESERVED'
                           CHECK (stock_state IN ('RESERVED', 'RELEASED', 'CONSUMED')),
  coupon_state TEXT        NOT NULL DEFAULT 'NONE'
                           CHECK (coupon_state IN ('NONE', 'RESERVED', 'RELEASED', 'CONSUMED')),
  coupon_id    UUID        REFERENCES public.coupons(id),
  reserved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at  TIMESTAMPTZ,
  CONSTRAINT order_resource_reservations_coupon_pairing
    CHECK ((coupon_state = 'NONE') = (coupon_id IS NULL))
);

-- 2.3 Audit append-only cho mọi chuyển trạng thái thanh toán. KHÔNG UPDATE,
-- KHÔNG DELETE (enforce bằng trigger §2.3b).
CREATE TABLE IF NOT EXISTS public.order_payment_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id    UUID        REFERENCES public.users(id),
  actor_type  TEXT        NOT NULL CHECK (actor_type IN ('CUSTOMER', 'STAFF', 'SYSTEM')),
  event_type  TEXT        NOT NULL,
  old_state   TEXT,
  new_state   TEXT,
  reason      TEXT,
  checked_at  TIMESTAMPTZ,
  -- Metadata đối soát (staffId, cửa sổ sao kê, reference). KHÔNG được chứa số
  -- tài khoản người gửi hay ảnh chứng từ (plan §Security: leaking metadata).
  reference   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_payment_events_order
  ON public.order_payment_events (order_id, created_at);

CREATE OR REPLACE FUNCTION public.order_payment_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'order_payment_events là append-only'
    USING ERRCODE = 'NTAPP';
END;
$$;

DROP TRIGGER IF EXISTS trg_order_payment_events_append_only ON public.order_payment_events;
CREATE TRIGGER trg_order_payment_events_append_only
  BEFORE UPDATE OR DELETE ON public.order_payment_events
  FOR EACH ROW EXECUTE FUNCTION public.order_payment_events_append_only();

-- 2.4 Quota tạo đơn thành công / ngày (UTC). Áp cho MỌI payment method, kể cả
-- COD — chặn xoay vòng tạo-hủy (plan AC11).
CREATE TABLE IF NOT EXISTS public.checkout_daily_quota (
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quota_day   DATE        NOT NULL,
  used_count  INT         NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, quota_day)
);

-- ============================================================================
-- §3. RLS TRÊN BẢNG MỚI — deny-by-default
--     RLS bật nhưng KHÔNG tạo policy nào => anon/authenticated không đọc/ghi
--     được gì. service_role bypass RLS nên server vẫn hoạt động bình thường.
-- ============================================================================

ALTER TABLE public.checkout_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_resource_reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_daily_quota         ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- §4. CUTOVER — GỠ CÁC TRIGGER GHI DỮ LIỆU XUNG ĐỘT
--
--     Phải nằm CÙNG migration với RPC thay thế (§6). Nếu để cả trigger cũ và
--     RPC mới cùng sống, mỗi đơn sẽ bị trừ kho HAI lần và tăng used_count HAI
--     lần (plan §Schema: "chứng minh không có giai đoạn vừa trigger vừa RPC").
-- ============================================================================

-- 4.1 Trừ kho theo từng dòng order_items -> chuyển vào RPC (aggregate SUM,
--     lock products theo id tăng dần).
DROP TRIGGER IF EXISTS trg_reduce_stock_on_order_item_insert ON public.order_items;
DROP FUNCTION IF EXISTS public.reduce_stock_on_order_item_insert();

-- 4.2 Validate + tăng coupon.used_count trên BEFORE INSERT orders -> chuyển vào
--     RPC. Đây là nguồn của coupon leak: trigger tăng used_count, còn đường bù
--     trừ `orders.delete()` ở order.repository.ts:217 KHÔNG giảm lại, và không
--     có decrement path nào trong toàn bộ schema.
DROP TRIGGER IF EXISTS trg_validate_coupon ON public.orders;
DROP FUNCTION IF EXISTS public.validate_and_apply_coupon();

-- 4.3 Hoàn kho khi CANCELLED/RETURNED. Bản cũ có HAI lỗi:
--     (a) `UPDATE products p ... FROM order_items oi` chỉ cập nhật MỘT dòng
--         khớp -> đơn nhiều dòng cùng product_id hoàn thiếu. Vì
--         order.repository.ts ghi product_id hằng số cho mọi dòng, mọi đơn
--         nhiều dòng đều bị.
--     (b) không guard payment_status -> hủy đơn ĐÃ GIAO vẫn hoàn kho.
--     Thay bằng release routine dựa trên ledger ở §6.1/§6.4.
DROP TRIGGER IF EXISTS trg_restock_on_cancel_or_return ON public.orders;
DROP FUNCTION IF EXISTS public.restock_on_order_cancelled_or_returned();

-- ============================================================================
-- §5. ACL — ĐÓNG ĐƯỜNG GHI TRỰC TIẾP QUA POSTGREST
--
--     F1 + F3 (RFC-1 report): hai policy dưới đây cho phép BẤT KỲ khách đã
--     đăng nhập nào dùng chính OAuth session + anon key gọi thẳng Supabase REST
--     API để tạo đơn hoàn chỉnh (header + lines) — bỏ qua app JWT, rate limit,
--     account cap và idempotency. Bỏ một mà giữ một thì bypass vẫn hở một nửa.
--
--     An toàn để gỡ: grep toàn repo xác nhận KHÔNG có caller client-side nào
--     ghi orders/order_items; `supabaseBrowser` chỉ dùng cho auth + đọc product.
--     Mọi ghi đều qua service-role client phía server.
-- ============================================================================

DROP POLICY IF EXISTS "Users create own orders"     ON public.orders;
DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;

-- 5.1 "Staff/Admin update orders" (init_schema.sql:274) cho phép mọi session
--     STAFF/ADMIN UPDATE BẤT KỲ cột nào của BẤT KỲ đơn nào qua PostgREST — kể
--     cả payment_status -> 'PAID' — bỏ qua hoàn toàn allowlist transition ở
--     admin-orders.repository.ts. Thay bằng policy hẹp: staff/admin chỉ được
--     UPDATE các cột không nhạy cảm, và các cột nhạy cảm (payment_status,
--     status, coupon_id, released_at, state_version, payment_expires_at) phải
--     giữ nguyên -> muốn đổi thì bắt buộc đi qua RPC ở §6.
--
--     Lưu ý kỹ thuật: RLS UPDATE policy không phân biệt theo cột, nên điều kiện
--     "cột nhạy cảm không đổi" được cài bằng WITH CHECK so sánh giá trị mới với
--     giá trị cũ qua một trigger guard (§5.2) — RLS một mình không làm được.
DROP POLICY IF EXISTS "Staff/Admin update orders" ON public.orders;
-- Idempotent như mọi object khác trong file này: thiếu dòng DROP dưới đây thì
-- chạy lại migration sẽ chết ở 42710 (phát hiện ở diễn tập cutover RFC-5).
DROP POLICY IF EXISTS "Staff/Admin update non-sensitive order fields" ON public.orders;

CREATE POLICY "Staff/Admin update non-sensitive order fields"
  ON public.orders FOR UPDATE
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- 5.2 Guard cấp trigger: chặn PostgREST session (anon/authenticated, kể cả tài
--     khoản STAFF/ADMIN) thay đổi cột nhạy cảm của orders.
--
--     PHẠM VI CÓ CHỦ ĐÍCH (đọc kỹ trước khi tưởng đây là bảo vệ tuyệt đối):
--       - Bỏ qua khi RPC đã set `nutein.allow_sensitive_order_write` = 'on'.
--       - Bỏ qua khi caller là `service_role` / owner. Lý do: toàn bộ ghi hợp lệ
--         hiện tại của app (admin-orders.repository.ts confirmPayment + status
--         transition) đi qua service-role client và RFC-2 KHÔNG được sửa file
--         đó — chặn service_role ở đây sẽ làm hỏng back-office ngay lập tức.
--       - Chặn mọi role khác. Đó chính xác là lỗ hổng RFC-1 báo: policy
--         "Staff/Admin update orders" cho phép một session STAFF bất kỳ đặt
--         payment_status='PAID' thẳng qua PostgREST, bỏ qua allowlist ở TS.
--
--     TODO(RFC-3): sau khi confirmPayment()/status transition được chuyển sang
--     checkout_transition_order_state, siết tiếp bằng cách bỏ nhánh miễn trừ
--     service_role -> lúc đó service-role key bị lộ cũng không flip được
--     payment_status. Chưa làm ở RFC-2 vì sẽ phá code chưa được phép sửa.
CREATE OR REPLACE FUNCTION public.guard_sensitive_order_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('nutein.allow_sensitive_order_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Kiểm tra qua pg_roles thay vì gọi thẳng pg_has_role('service_role', ...):
  -- trên Postgres cục bộ (test) role đó không tồn tại và pg_has_role sẽ NÉM
  -- LỖI, làm hỏng mọi UPDATE orders. Cách này an toàn ở cả hai môi trường.
  -- `current_user` là TỪ KHOÁ SQL, không phải đối tượng trong schema. Viết
  -- `pg_catalog.current_user` sẽ bị parse thành cột `current_user` của bảng
  -- `pg_catalog` -> lỗi "missing FROM-clause entry for table pg_catalog" ngay
  -- lần UPDATE orders đầu tiên. Từ khoá không bị ảnh hưởng bởi search_path = ''
  -- nên để trần là đúng và an toàn.
  -- (Phát hiện ở diễn tập cutover RFC-5: lỗi chỉ lộ ra khi §8 backfill thực sự
  --  UPDATE được ít nhất một đơn CANCELLED — trên database rỗng nó khớp 0 dòng
  --  nên trigger không bao giờ chạy.)
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname IN ('service_role', 'postgres', 'supabase_admin')
      AND pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status  IS DISTINCT FROM OLD.payment_status
     OR NEW.status       IS DISTINCT FROM OLD.status
     OR NEW.coupon_id    IS DISTINCT FROM OLD.coupon_id
     OR NEW.released_at  IS DISTINCT FROM OLD.released_at
     OR NEW.state_version IS DISTINCT FROM OLD.state_version
     OR NEW.payment_expires_at IS DISTINCT FROM OLD.payment_expires_at
     OR NEW.payment_review_state IS DISTINCT FROM OLD.payment_review_state
     OR NEW.user_id      IS DISTINCT FROM OLD.user_id
     OR NEW.final_price  IS DISTINCT FROM OLD.final_price
  THEN
    RAISE EXCEPTION
      'Cột nhạy cảm của orders chỉ được thay đổi qua RPC checkout_transition_order_state'
      USING ERRCODE = 'NTGRD';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sensitive_order_columns ON public.orders;
CREATE TRIGGER trg_guard_sensitive_order_columns
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_order_columns();

-- 5.3 Thu hồi quyền ghi ở cấp GRANT (lớp thứ hai, độc lập với RLS).
--     F2: toàn bộ 13 migration cũ có 0 GRANT / 0 REVOKE — quyền hiện tại hoàn
--     toàn là default của Supabase (anon/authenticated được cấp DML trên
--     public schema). REVOKE dưới đây là lần đầu tiên trạng thái đó được ghi
--     vào version control.
REVOKE INSERT, UPDATE, DELETE ON public.orders      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coupons     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products    FROM anon, authenticated;

REVOKE ALL ON public.checkout_requests           FROM anon, authenticated;
REVOKE ALL ON public.order_resource_reservations FROM anon, authenticated;
REVOKE ALL ON public.order_payment_events        FROM anon, authenticated;
REVOKE ALL ON public.checkout_daily_quota        FROM anon, authenticated;

GRANT ALL ON public.checkout_requests           TO service_role;
GRANT ALL ON public.order_resource_reservations TO service_role;
GRANT ALL ON public.order_payment_events        TO service_role;
GRANT ALL ON public.checkout_daily_quota        TO service_role;

-- ============================================================================
-- §6. RPC
--
--     QUYỀN: các hàm dưới đây là INVOKER RIGHTS (mặc định, KHÔNG SECURITY
--     DEFINER) — plan §Security ưu tiên invoker khi role gọi đã đủ quyền, và
--     service_role thì đủ. Không có leo thang quyền nào để khai thác.
--     Tất cả đều pin `search_path = ''` và schema-qualify mọi tên.
--     EXECUTE bị REVOKE khỏi PUBLIC/anon/authenticated ở §7.
--
--     GIỚI HẠN ĐÃ BIẾT (ghi rõ, không giấu): RPC nhận `user_id` từ server.
--     Hệ thống này dùng app JWT riêng (`nutein_access_token`) chứ không phải
--     Supabase session, nên `auth.uid()` KHÔNG khả dụng trong đường checkout —
--     DB không có cách nào tự suy ra danh tính. Bất biến bảo vệ là: chỉ
--     service_role được EXECUTE, và service-role key chỉ tồn tại server-side.
--     Đây là ranh giới tin cậy, phải được nêu trong evidence pack RFC-5.
--     RPC vẫn KHÔNG tin: total/final_price (kiểm tra lại công thức), coupon_id
--     (tự tra theo code), deadline (dùng đồng hồ DB), role, paid.
-- ============================================================================

-- 6.1 Release routine dùng chung — idempotent, aggregate SUM.
--     Gọi từ transition RPC và từ trigger tương thích §6.4.
--     Bất biến: chỉ hoàn kho khi ledger nói RESERVED. Gọi lần hai không làm gì.
CREATE OR REPLACE FUNCTION public.checkout_release_reservation(
  p_order_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_ledger public.order_resource_reservations%ROWTYPE;
  v_line   RECORD;
BEGIN
  SELECT * INTO v_ledger
  FROM public.order_resource_reservations
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Đơn legacy không có ledger: KHÔNG đoán, KHÔNG hoàn kho mù. Backfill ở
    -- §8 tạo ledger cho đơn lịch sử; đơn nào vẫn thiếu là ca đối soát tay.
    RETURN FALSE;
  END IF;

  IF v_ledger.stock_state <> 'RESERVED' AND v_ledger.coupon_state <> 'RESERVED' THEN
    RETURN FALSE; -- đã release/consume rồi -> no-op (idempotent)
  END IF;

  IF v_ledger.stock_state = 'RESERVED' THEN
    -- Aggregate TRƯỚC khi hoàn: nhiều dòng order_items có thể cùng product_id
    -- (catalog single-SKU ghi product_id hằng số cho mọi dòng). Trigger cũ
    -- dùng UPDATE...FROM và chỉ hoàn được một dòng.
    FOR v_line IN
      SELECT oi.product_id, SUM(oi.quantity)::INT AS total_quantity
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
      ORDER BY oi.product_id
    LOOP
      UPDATE public.products
      SET stock = stock + v_line.total_quantity,
          updated_at = NOW()
      WHERE id = v_line.product_id;
    END LOOP;
  END IF;

  IF v_ledger.coupon_state = 'RESERVED' AND v_ledger.coupon_id IS NOT NULL THEN
    -- Trả đúng MỘT lượt. GREATEST(...,0) không dùng ở đây có chủ đích: nếu
    -- used_count đã là 0 thì CHECK (used_count >= 0) sẽ nổ và đó là incident
    -- cần điều tra, không phải thứ để clamp im lặng (plan §Performance).
    UPDATE public.coupons
    SET used_count = used_count - 1
    WHERE id = v_ledger.coupon_id;
  END IF;

  UPDATE public.order_resource_reservations
  SET stock_state  = CASE WHEN stock_state  = 'RESERVED' THEN 'RELEASED' ELSE stock_state  END,
      coupon_state = CASE WHEN coupon_state = 'RESERVED' THEN 'RELEASED' ELSE coupon_state END,
      released_at  = NOW()
  WHERE order_id = p_order_id;

  INSERT INTO public.order_payment_events
    (order_id, actor_type, event_type, new_state, reason)
  VALUES
    (p_order_id, 'SYSTEM', 'RESERVATION_RELEASED', 'RELEASED', p_reason);

  RETURN TRUE;
END;
$$;

-- 6.2 Tạo đơn atomic. Toàn bộ thân hàm chạy trong MỘT transaction —
--     bất kỳ RAISE nào cũng rollback sạch order + items + stock + coupon + key.
CREATE OR REPLACE FUNCTION public.checkout_create_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id           UUID    := (p_payload->>'user_id')::UUID;
  v_key               TEXT    := p_payload->>'idempotency_key';
  v_hash              TEXT    := p_payload->>'request_hash';
  v_hash_version      INT     := COALESCE((p_payload->>'hash_version')::INT, 1);
  v_payment_method    TEXT    := p_payload->>'payment_method';
  v_bank_cap          INT     := (p_payload->>'bank_active_cap')::INT;
  v_cod_cap           INT     := (p_payload->>'cod_active_cap')::INT;   -- NULL = chưa chốt chính sách -> bỏ qua
  v_daily_quota       INT     := (p_payload->>'daily_quota')::INT;      -- NULL = tắt
  v_payment_ttl_sec   INT     := (p_payload->>'payment_ttl_seconds')::INT;
  v_protection_ver    INT     := COALESCE((p_payload->>'protection_version')::INT, 1);
  v_coupon_code       TEXT    := p_payload->>'coupon_code';
  v_coupon_discount   NUMERIC := COALESCE((p_payload->>'coupon_discount_amount')::NUMERIC, 0);
  v_total_price       NUMERIC := (p_payload->>'total_price')::NUMERIC;
  v_shipping_fee      NUMERIC := (p_payload->>'shipping_fee')::NUMERIC;
  v_discount_amount   NUMERIC := (p_payload->>'discount_amount')::NUMERIC;
  v_final_price       NUMERIC := (p_payload->>'final_price')::NUMERIC;
  v_items             JSONB   := p_payload->'items';

  v_user              public.users%ROWTYPE;
  v_existing          public.checkout_requests%ROWTYPE;
  v_existing_order    public.orders%ROWTYPE;
  v_coupon            public.coupons%ROWTYPE;
  v_coupon_id         UUID;
  v_active_count      INT;
  v_quota_used        INT;
  v_order_id          UUID;
  v_created_at        TIMESTAMPTZ;
  v_expires_at        TIMESTAMPTZ;
  v_line              RECORD;
  v_stock             INT;
  v_max_coupon_cut    NUMERIC;
BEGIN
  -- Cho phép ghi cột nhạy cảm trong đúng transaction này (guard §5.2).
  PERFORM set_config('nutein.allow_sensitive_order_write', 'on', true);

  -- --- (0) Kiểm tra payload tối thiểu -------------------------------------
  IF v_user_id IS NULL OR v_key IS NULL OR v_hash IS NULL THEN
    RAISE EXCEPTION 'Thiếu user_id/idempotency_key/request_hash' USING ERRCODE = 'NTPLD';
  END IF;
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Đơn hàng không có dòng nào' USING ERRCODE = 'NTPLD';
  END IF;
  IF jsonb_array_length(v_items) > 20 THEN
    RAISE EXCEPTION 'Đơn hàng vượt quá 20 dòng' USING ERRCODE = 'NTPLD';
  END IF;
  IF v_bank_cap IS NULL OR v_bank_cap < 1 THEN
    RAISE EXCEPTION 'bank_active_cap không hợp lệ' USING ERRCODE = 'NTPLD';
  END IF;

  -- Không tin số tiền client gửi: bắt buộc khớp công thức. CHECK cấp bảng đã
  -- ràng buộc final_price, nhưng kiểm ở đây để lỗi có mã rõ ràng thay vì 23514.
  IF v_final_price IS DISTINCT FROM (v_total_price + v_shipping_fee - v_discount_amount) THEN
    RAISE EXCEPTION 'Số tiền không nhất quán' USING ERRCODE = 'NTVER';
  END IF;
  IF v_total_price < 0 OR v_shipping_fee < 0 OR v_discount_amount < 0 OR v_final_price < 0 THEN
    RAISE EXCEPTION 'Số tiền âm' USING ERRCODE = 'NTVER';
  END IF;

  -- --- (1) Khoá user. Đây là serialization point cho MỌI thao tác ảnh hưởng
  --         slot của user này. Thứ tự khoá toàn hệ thống:
  --         user -> idempotency/order -> coupon -> product ids tăng dần.
  SELECT * INTO v_user FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND OR v_user.is_deleted THEN
    RAISE EXCEPTION 'Tài khoản không hợp lệ' USING ERRCODE = 'NTUSR';
  END IF;

  -- --- (2) Idempotency TRƯỚC cap và TRƯỚC mọi mutation --------------------
  --         Replay không được tiêu cap, không được tiêu quota, không chạy lại
  --         pricing. Đây là lý do bước này đứng trước bước (3).
  SELECT * INTO v_existing
  FROM public.checkout_requests
  WHERE user_id = v_user_id AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash
       OR v_existing.hash_version IS DISTINCT FROM v_hash_version THEN
      RAISE EXCEPTION 'Idempotency key đã dùng cho payload khác' USING ERRCODE = 'NTIDM';
    END IF;

    SELECT * INTO v_existing_order FROM public.orders WHERE id = v_existing.order_id;
    IF NOT FOUND THEN
      -- Key trỏ tới order không còn tồn tại. KHÔNG âm thầm tạo đơn mới dưới
      -- cùng key (sẽ phá bất biến "một key = một order"); bắt client dùng key
      -- mới cho một đơn mới.
      RAISE EXCEPTION 'Idempotency key trỏ tới đơn không còn tồn tại' USING ERRCODE = 'NTIDM';
    END IF;

    RETURN jsonb_build_object(
      'replayed',            TRUE,
      'order_id',            v_existing_order.id,
      'order_code',          v_existing_order.order_code,
      'status',              v_existing_order.status,
      'payment_status',      v_existing_order.payment_status,
      'payment_review_state', v_existing_order.payment_review_state,
      'payment_expires_at',  v_existing_order.payment_expires_at,
      'state_version',       COALESCE(v_existing_order.state_version, 0),
      'created_at',          v_existing_order.created_at
    );
  END IF;

  -- --- (3) Cap đơn giữ chỗ, dưới user lock --------------------------------
  IF v_payment_method = 'BANK_TRANSFER' THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.orders o
    WHERE o.user_id = v_user_id
      AND o.payment_method = 'BANK_TRANSFER'
      AND o.payment_status = 'UNPAID'
      AND o.released_at IS NULL
      AND o.status NOT IN ('CANCELLED', 'RETURNED');

    IF v_active_count >= v_bank_cap THEN
      RAISE EXCEPTION 'Đã đạt giới hạn % đơn chuyển khoản chưa thanh toán', v_bank_cap
        USING ERRCODE = 'NTCAP';
    END IF;
  ELSIF v_payment_method = 'COD' AND v_cod_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.orders o
    WHERE o.user_id = v_user_id
      AND o.payment_method = 'COD'
      AND o.status IN ('PENDING', 'PROCESSING');

    IF v_active_count >= v_cod_cap THEN
      RAISE EXCEPTION 'Đã đạt giới hạn % đơn COD đang xử lý', v_cod_cap
        USING ERRCODE = 'NTCAP';
    END IF;
  END IF;

  -- --- (4) Quota tạo đơn thành công / ngày (UTC), dưới cùng user lock -----
  IF v_daily_quota IS NOT NULL THEN
    SELECT used_count INTO v_quota_used
    FROM public.checkout_daily_quota
    WHERE user_id = v_user_id AND quota_day = (NOW() AT TIME ZONE 'UTC')::DATE;

    IF COALESCE(v_quota_used, 0) >= v_daily_quota THEN
      RAISE EXCEPTION 'Vượt hạn mức % đơn/ngày', v_daily_quota USING ERRCODE = 'NTQTA';
    END IF;
  END IF;

  -- --- (5) Coupon: tra theo CODE, không tin coupon_id từ client -----------
  IF v_coupon_code IS NOT NULL AND length(trim(v_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE lower(code) = lower(trim(v_coupon_code))
    FOR UPDATE;

    IF NOT FOUND OR NOT v_coupon.is_active THEN
      RAISE EXCEPTION 'Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa' USING ERRCODE = 'NTCPN';
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
      RAISE EXCEPTION 'Mã giảm giá đã hết hạn' USING ERRCODE = 'NTCPN';
    END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Mã giảm giá đã hết lượt sử dụng' USING ERRCODE = 'NTCPN';
    END IF;
    IF v_coupon.min_order_value IS NOT NULL AND v_total_price < v_coupon.min_order_value THEN
      RAISE EXCEPTION 'Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá' USING ERRCODE = 'NTCPN';
    END IF;

    -- KHÔNG tính lại discount (tránh nhân đôi logic pricing của app), nhưng
    -- CHẶN TRẦN theo định nghĩa coupon: client không thể khai khống số giảm.
    v_max_coupon_cut := CASE
      WHEN v_coupon.discount_type = 'PERCENTAGE'
        THEN ceil(v_total_price * v_coupon.discount / 100.0)
      ELSE v_coupon.discount
    END;
    IF v_coupon_discount > v_max_coupon_cut THEN
      RAISE EXCEPTION 'Số tiền giảm vượt quá giá trị mã giảm giá' USING ERRCODE = 'NTVER';
    END IF;
    IF v_coupon_discount > v_discount_amount THEN
      RAISE EXCEPTION 'Số tiền giảm coupon không nhất quán với tổng giảm' USING ERRCODE = 'NTVER';
    END IF;

    v_coupon_id := v_coupon.id;
  END IF;

  -- --- (6) Khoá products theo id TĂNG DẦN, kiểm tồn theo tổng đã gộp ------
  --         Gộp NGAY trong query (không dùng TEMP TABLE): plpgsql cache plan
  --         theo OID, mà một temp table ON COMMIT DROP đổi OID mỗi transaction
  --         -> "relation with OID ... does not exist" ở lần gọi thứ hai trong
  --         cùng session. Đây là bug đã biết, không phải sở thích style.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) AS item
    WHERE COALESCE((item->>'quantity')::INT, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'Số lượng dòng đơn không hợp lệ' USING ERRCODE = 'NTPLD';
  END IF;

  FOR v_line IN
    SELECT (item->>'product_id')::UUID       AS product_id,
           SUM((item->>'quantity')::INT)::INT AS total_quantity
    FROM jsonb_array_elements(v_items) AS item
    WHERE item->>'product_id' IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  LOOP
    SELECT stock INTO v_stock
    FROM public.products
    WHERE id = v_line.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sản phẩm không tồn tại' USING ERRCODE = 'NTSTK';
    END IF;
    IF v_stock < v_line.total_quantity THEN
      RAISE EXCEPTION 'Sản phẩm hiện đã hết hàng hoặc không đủ số lượng' USING ERRCODE = 'NTSTK';
    END IF;
  END LOOP;

  -- --- (7) Ghi. Từ đây trở đi mọi thứ hoặc commit hết, hoặc rollback hết. --
  v_expires_at := CASE
    WHEN v_payment_method = 'BANK_TRANSFER' AND v_payment_ttl_sec IS NOT NULL
      -- Đồng hồ DB, không phải đồng hồ client/browser.
      THEN NOW() + make_interval(secs => v_payment_ttl_sec)
    ELSE NULL
  END;

  INSERT INTO public.orders (
    user_id, order_code, status, payment_method, payment_status, shipping_method,
    total_price, shipping_fee, discount_amount, final_price,
    shipping_address, coupon_id, note,
    protection_version, payment_expires_at, payment_review_state, review_due_at,
    state_version
  ) VALUES (
    v_user_id,
    p_payload->>'order_code',
    COALESCE(p_payload->>'status', 'PENDING')::public."OrderStatus",
    v_payment_method::public."PaymentMethod",
    COALESCE(p_payload->>'payment_status', 'UNPAID')::public."PaymentStatus",
    COALESCE(p_payload->>'shipping_method', 'STANDARD')::public."ShippingMethod",
    v_total_price, v_shipping_fee, v_discount_amount, v_final_price,
    p_payload->'shipping_address',
    v_coupon_id,
    NULLIF(trim(COALESCE(p_payload->>'note', '')), ''),
    v_protection_ver,
    v_expires_at,
    CASE WHEN v_payment_method = 'BANK_TRANSFER' THEN 'AWAITING_TRANSFER' ELSE NULL END,
    v_expires_at,
    0
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  INSERT INTO public.order_items (order_id, product_id, product_name, variant_info, price, quantity)
  SELECT
    v_order_id,
    (item->>'product_id')::UUID,
    item->>'product_name',
    item->>'variant_info',
    (item->>'price')::NUMERIC,
    (item->>'quantity')::INT
  FROM jsonb_array_elements(v_items) AS item;

  -- Trừ kho theo TỔNG đã gộp, theo id tăng dần (cùng thứ tự đã khoá).
  FOR v_line IN
    SELECT (item->>'product_id')::UUID       AS product_id,
           SUM((item->>'quantity')::INT)::INT AS total_quantity
    FROM jsonb_array_elements(v_items) AS item
    WHERE item->>'product_id' IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  LOOP
    UPDATE public.products
    SET stock = stock - v_line.total_quantity,
        updated_at = NOW()
    WHERE id = v_line.product_id;
  END LOOP;

  IF v_coupon_id IS NOT NULL THEN
    -- V1: used_count = reserved + consumed (giữ tương thích dashboard admin).
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon_id;
  END IF;

  INSERT INTO public.order_resource_reservations
    (order_id, stock_state, coupon_state, coupon_id)
  VALUES
    (v_order_id, 'RESERVED',
     CASE WHEN v_coupon_id IS NULL THEN 'NONE' ELSE 'RESERVED' END,
     v_coupon_id);

  -- Durable key: unique(user_id, key) là chốt chặn cuối cho 2 request cùng key
  -- chạy song song. Nếu request kia commit trước, INSERT này ném 23505 và toàn
  -- bộ transaction rollback -> đúng một order tồn tại.
  INSERT INTO public.checkout_requests (user_id, idempotency_key, request_hash, hash_version, order_id)
  VALUES (v_user_id, v_key, v_hash, v_hash_version, v_order_id);

  IF v_daily_quota IS NOT NULL THEN
    INSERT INTO public.checkout_daily_quota (user_id, quota_day, used_count)
    VALUES (v_user_id, (NOW() AT TIME ZONE 'UTC')::DATE, 1)
    ON CONFLICT (user_id, quota_day)
    DO UPDATE SET used_count = public.checkout_daily_quota.used_count + 1,
                  updated_at = NOW();
  END IF;

  INSERT INTO public.order_payment_events
    (order_id, actor_id, actor_type, event_type, new_state, reference)
  VALUES
    (v_order_id, v_user_id, 'CUSTOMER', 'ORDER_CREATED',
     CASE WHEN v_payment_method = 'BANK_TRANSFER' THEN 'AWAITING_TRANSFER' ELSE NULL END,
     jsonb_build_object('payment_method', v_payment_method, 'hash_version', v_hash_version));

  RETURN jsonb_build_object(
    'replayed',            FALSE,
    'order_id',            v_order_id,
    'order_code',          p_payload->>'order_code',
    'status',              COALESCE(p_payload->>'status', 'PENDING'),
    'payment_status',      COALESCE(p_payload->>'payment_status', 'UNPAID'),
    'payment_review_state', CASE WHEN v_payment_method = 'BANK_TRANSFER' THEN 'AWAITING_TRANSFER' ELSE NULL END,
    'payment_expires_at',  v_expires_at,
    'state_version',       0,
    'created_at',          v_created_at
  );
END;
$$;

-- 6.3 Transition RPC dùng chung cho confirm / claim / cancel / review.
--     Cùng thứ tự khoá với create: user -> order -> (ledger) -> products.
--     `p_expected_version` = optimistic concurrency: hai staff bấm cùng lúc thì
--     người thứ hai nhận NTSTA thay vì ghi đè im lặng.
CREATE OR REPLACE FUNCTION public.checkout_transition_order_state(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order_id     UUID := (p_payload->>'order_id')::UUID;
  v_action       TEXT := p_payload->>'action';
  v_actor_id     UUID := NULLIF(p_payload->>'actor_id', '')::UUID;
  v_actor_type   TEXT := COALESCE(p_payload->>'actor_type', 'SYSTEM');
  v_expected_ver INT  := (p_payload->>'expected_version')::INT;
  v_reason       TEXT := p_payload->>'reason';
  v_reference    JSONB := COALESCE(p_payload->'reference', '{}'::jsonb);

  v_order        public.orders%ROWTYPE;
  v_old_state    TEXT;
  v_new_state    TEXT;
  v_new_status   public."OrderStatus";
  v_new_payment  public."PaymentStatus";
  v_released     BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('nutein.allow_sensitive_order_write', 'on', true);

  IF v_order_id IS NULL OR v_action IS NULL THEN
    RAISE EXCEPTION 'Thiếu order_id/action' USING ERRCODE = 'NTPLD';
  END IF;

  -- Khoá USER trước ORDER (đúng thứ tự chung, tránh deadlock với create).
  PERFORM 1 FROM public.users u
  WHERE u.id = (SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id)
  FOR UPDATE;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng' USING ERRCODE = 'NTSTA';
  END IF;

  IF v_expected_ver IS NOT NULL
     AND COALESCE(v_order.state_version, 0) <> v_expected_ver THEN
    RAISE EXCEPTION 'Đơn hàng đã thay đổi, vui lòng tải lại' USING ERRCODE = 'NTSTA';
  END IF;

  v_old_state  := v_order.payment_review_state;
  v_new_state  := v_order.payment_review_state;
  v_new_status := v_order.status;
  v_new_payment := v_order.payment_status;

  IF v_action = 'confirm_payment' THEN
    -- GUARD TRẠNG THÁI ĐƠN — đây là lớp DB của lỗi mà RFC-3 sẽ vá ở tầng TS:
    -- confirmPayment() hiện chỉ kiểm payment_method + payment_status, nên một
    -- đơn CANCELLED vẫn UNPAID có thể bị đánh dấu PAID. Ở đây bị chặn cứng.
    IF v_order.status IN ('CANCELLED', 'RETURNED') THEN
      RAISE EXCEPTION 'Không thể xác nhận thanh toán cho đơn đã hủy/đã trả' USING ERRCODE = 'NTSTA';
    END IF;
    IF v_order.released_at IS NOT NULL THEN
      RAISE EXCEPTION 'Đơn đã giải phóng tài nguyên, không thể xác nhận thanh toán' USING ERRCODE = 'NTSTA';
    END IF;
    IF v_order.payment_status = 'PAID' THEN
      -- Idempotent: xác nhận lại không phải lỗi, nhưng không ghi đè gì.
      RETURN jsonb_build_object('order_id', v_order_id, 'changed', FALSE,
                                'status', v_order.status, 'payment_status', 'PAID',
                                'state_version', COALESCE(v_order.state_version, 0));
    END IF;

    v_new_payment := 'PAID';
    v_new_state   := 'SETTLED';
    -- Reservation chuyển sang CONSUMED: đã thu tiền -> KHÔNG bao giờ hoàn kho
    -- tự động nữa. Đây là điều kiện chặn worker/cancel hoàn kho đơn đã trả.
    UPDATE public.order_resource_reservations
    SET stock_state  = 'CONSUMED',
        coupon_state = CASE WHEN coupon_state = 'RESERVED' THEN 'CONSUMED' ELSE coupon_state END
    WHERE order_id = v_order_id;
    -- Chủ đích KHÔNG tự chuyển sang PROCESSING (plan: fulfilment là transition riêng).

  ELSIF v_action = 'claim_payment' THEN
    IF v_order.payment_status = 'PAID' OR v_order.status IN ('CANCELLED', 'RETURNED') THEN
      RAISE EXCEPTION 'Đơn không ở trạng thái có thể khai báo đã chuyển khoản' USING ERRCODE = 'NTSTA';
    END IF;
    IF v_order.payment_review_state = 'PAYMENT_CLAIMED' THEN
      RAISE EXCEPTION 'Đơn đã được khai báo đã chuyển khoản' USING ERRCODE = 'NTSTA';
    END IF;
    -- Lời khai của khách: KHÔNG đặt PAID, KHÔNG gia hạn deadline, KHÔNG trả slot.
    v_new_state := 'PAYMENT_CLAIMED';

  ELSIF v_action = 'mark_review_required' THEN
    IF v_order.payment_status = 'PAID' OR v_order.status IN ('CANCELLED', 'RETURNED') THEN
      RETURN jsonb_build_object('order_id', v_order_id, 'changed', FALSE,
                                'status', v_order.status,
                                'payment_status', v_order.payment_status,
                                'state_version', COALESCE(v_order.state_version, 0));
    END IF;
    -- Quá hạn KHÔNG tự hủy và KHÔNG tự hoàn kho — chỉ vào hàng đợi đối soát.
    v_new_state := 'REVIEW_REQUIRED';

  ELSIF v_action = 'request_cancel' THEN
    IF v_order.payment_status = 'PAID' OR v_order.status IN ('CANCELLED', 'RETURNED') THEN
      RAISE EXCEPTION 'Đơn không thể yêu cầu hủy ở trạng thái hiện tại' USING ERRCODE = 'NTSTA';
    END IF;
    -- Yêu cầu hủy KHÔNG release ngay: cần staff đối soát chưa nhận tiền.
    v_new_state := 'CANCEL_REQUESTED';

  ELSIF v_action = 'resolve_no_transfer' THEN
    -- Staff đã đối chiếu sao kê và xác nhận CHƯA nhận tiền -> hủy + trả tài
    -- nguyên, atomically trong cùng transaction này.
    IF v_order.payment_status = 'PAID' THEN
      RAISE EXCEPTION 'Đơn đã thanh toán, không thể kết luận chưa chuyển khoản' USING ERRCODE = 'NTSTA';
    END IF;
    IF v_order.status IN ('CANCELLED', 'RETURNED') THEN
      RETURN jsonb_build_object('order_id', v_order_id, 'changed', FALSE,
                                'status', v_order.status,
                                'payment_status', v_order.payment_status,
                                'state_version', COALESCE(v_order.state_version, 0));
    END IF;
    v_new_status := 'CANCELLED';
    v_new_state  := 'RELEASED';
    v_released   := TRUE;

  ELSIF v_action = 'mark_late_transfer' THEN
    -- Tiền về SAU khi đơn đã hủy/release: KHÔNG hồi sinh đơn, KHÔNG trừ kho lại.
    v_new_state := 'LATE_TRANSFER_REVIEW';

  ELSE
    RAISE EXCEPTION 'Hành động không hợp lệ: %', v_action USING ERRCODE = 'NTPLD';
  END IF;

  UPDATE public.orders
  SET status               = v_new_status,
      payment_status       = v_new_payment,
      payment_review_state = v_new_state,
      cancellation_reason  = CASE WHEN v_released THEN COALESCE(v_reason, cancellation_reason)
                                  ELSE cancellation_reason END,
      released_at          = CASE WHEN v_released THEN NOW() ELSE released_at END,
      state_version        = COALESCE(state_version, 0) + 1,
      updated_at           = NOW()
  WHERE id = v_order_id;

  IF v_released THEN
    PERFORM public.checkout_release_reservation(v_order_id, COALESCE(v_reason, v_action));
  END IF;

  INSERT INTO public.order_payment_events
    (order_id, actor_id, actor_type, event_type, old_state, new_state, reason, checked_at, reference)
  VALUES
    (v_order_id, v_actor_id, v_actor_type, upper(v_action), v_old_state, v_new_state,
     v_reason, NOW(), v_reference);

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'changed',       TRUE,
    'status',        v_new_status,
    'payment_status', v_new_payment,
    'payment_review_state', v_new_state,
    'state_version', COALESCE(v_order.state_version, 0) + 1
  );
END;
$$;

-- 6.4 Trigger tương thích: staff đổi status sang CANCELLED/RETURNED bằng đường
--     UPDATE hiện hữu (admin-orders.repository.ts — KHÔNG sửa ở RFC-2) vẫn phải
--     trả kho. Thay cho trg_restock_on_cancel_or_return đã drop ở §4.3, nhưng
--     lần này đi qua release routine dựa trên ledger:
--       - SUM theo product_id (sửa lỗi đơn nhiều dòng),
--       - no-op nếu ledger đã RELEASED (không hoàn hai lần),
--       - no-op nếu ledger là CONSUMED (đơn đã thanh toán/đã giao không hoàn).
CREATE OR REPLACE FUNCTION public.checkout_release_on_terminal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.checkout_release_reservation(NEW.id, 'status:' || NEW.status::TEXT);

  UPDATE public.orders
  SET released_at = COALESCE(released_at, NOW())
  WHERE id = NEW.id
    AND EXISTS (
      SELECT 1 FROM public.order_resource_reservations r
      WHERE r.order_id = NEW.id AND r.released_at IS NOT NULL
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_release_on_terminal_status ON public.orders;
CREATE TRIGGER trg_checkout_release_on_terminal_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('CANCELLED', 'RETURNED')
    AND OLD.status NOT IN ('CANCELLED', 'RETURNED')
  )
  EXECUTE FUNCTION public.checkout_release_on_terminal_status();

-- ============================================================================
-- §7. EXECUTE ACL TRÊN RPC — mặc định Postgres cấp EXECUTE cho PUBLIC, phải
--     thu hồi tường minh, nếu không anon/authenticated gọi được qua PostgREST.
-- ============================================================================

REVOKE ALL ON FUNCTION public.checkout_create_order_atomic(JSONB)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_transition_order_state(JSONB)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_release_reservation(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.checkout_create_order_atomic(JSONB)     TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_transition_order_state(JSONB)  TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_release_reservation(UUID, TEXT) TO service_role;

-- ============================================================================
-- §8. BACKFILL LEDGER CHO ĐƠN LỊCH SỬ
--
--     KHÔNG thay đổi một con số stock/used_count nào — chỉ ghi lại trạng thái
--     đã có, để release routine biết đơn nào còn giữ chỗ.
--     Suy luận có căn cứ: trigger cũ trừ kho ở MỌI insert order_items, nên mọi
--     đơn có items đều đã reserve. Đơn đã CANCELLED/RETURNED đã được trigger cũ
--     hoàn (dù có thể hoàn THIẾU với đơn nhiều dòng — chênh lệch đó là việc của
--     RFC-5 reconciliation, KHÔNG tự sửa ở đây).
-- ============================================================================

INSERT INTO public.order_resource_reservations (order_id, stock_state, coupon_state, coupon_id, reserved_at, released_at)
SELECT
  o.id,
  CASE
    WHEN o.status IN ('CANCELLED', 'RETURNED') THEN 'RELEASED'
    WHEN o.status = 'DELIVERED' OR o.payment_status = 'PAID' THEN 'CONSUMED'
    ELSE 'RESERVED'
  END,
  CASE
    WHEN o.coupon_id IS NULL THEN 'NONE'
    WHEN o.status IN ('CANCELLED', 'RETURNED') THEN 'RELEASED'
    WHEN o.status = 'DELIVERED' OR o.payment_status = 'PAID' THEN 'CONSUMED'
    ELSE 'RESERVED'
  END,
  o.coupon_id,
  o.created_at,
  CASE WHEN o.status IN ('CANCELLED', 'RETURNED') THEN o.updated_at ELSE NULL END
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_resource_reservations r WHERE r.order_id = o.id
);

-- Đơn lịch sử đã terminal thì slot cũng phải coi như đã giải phóng, nếu không
-- cap sẽ đếm nhầm chúng là đang giữ chỗ.
UPDATE public.orders
SET released_at = updated_at
WHERE released_at IS NULL
  AND status IN ('CANCELLED', 'RETURNED');

COMMIT;
