-- ============================================================================
-- Bootstrap schema cho INTEGRATION TEST trên Postgres cục bộ / disposable.
--
-- ĐÂY KHÔNG PHẢI MIGRATION. File này KHÔNG nằm trong supabase/migrations/ và
-- KHÔNG bao giờ được apply lên Supabase.
--
-- Mục đích: dựng lại phần schema mà RFC-2 chạm tới (users/products/coupons/
-- orders/order_items + enums + trigger stock/coupon CŨ) trên một Postgres trần
-- không có `auth` schema, không có `auth.uid()`, không có role Supabase.
--
-- GIỚI HẠN PHẢI GHI RÕ: DDL dưới đây được COPY từ
-- 20260718000000_init_schema.sql + 20260721000000_... + 20260724000000_... để
-- khớp cột/kiểu/CHECK/trigger thật, nhưng nó là bản DỰNG LẠI. Test chạy trên
-- file này chứng minh logic RPC, khoá, atomicity và ledger — nó KHÔNG chứng
-- minh schema đã deploy trên Supabase giống hệt. Đó là việc của ACL probe
-- (RFC-1) và rehearsal staging (RFC-5).
-- ============================================================================

-- Role Supabase không tồn tại trên Postgres trần; migration RFC-2 có
-- GRANT/REVOKE tới chúng nên phải tạo trước.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role"           AS ENUM ('USER', 'STAFF', 'ADMIN');
    CREATE TYPE "OrderStatus"    AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
    CREATE TYPE "PaymentMethod"  AS ENUM ('COD', 'BANK_TRANSFER', 'MOMO', 'VNPAY', 'PAYOS');
    CREATE TYPE "PaymentStatus"  AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');
    CREATE TYPE "DiscountType"   AS ENUM ('FIXED', 'PERCENTAGE');
    CREATE TYPE "ShippingMethod" AS ENUM ('STANDARD', 'EXPRESS');
  END IF;
END $$;

-- Stub: bản thật đọc `auth.uid()`; ở đây chỉ cần tồn tại để policy compile.
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT FALSE $$;

CREATE TABLE IF NOT EXISTS public.users (
  -- Bản thật REFERENCES auth.users(id); ở đây bỏ FK vì không có schema auth.
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT,
  phone       TEXT        UNIQUE,
  avatar      TEXT,
  role        "Role"      NOT NULL DEFAULT 'USER',
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT          NOT NULL,
  name            TEXT          NOT NULL,
  slug            TEXT          NOT NULL,
  description     TEXT,
  flavor          TEXT,
  size            TEXT,
  price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock           INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images          JSONB         NOT NULL DEFAULT '[]',
  nutrition_facts JSONB         NOT NULL DEFAULT '{}',
  ingredients     JSONB         NOT NULL DEFAULT '[]',
  is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT           NOT NULL UNIQUE,
  discount_type   "DiscountType" NOT NULL DEFAULT 'FIXED',
  discount        DECIMAL(10,2)  NOT NULL CHECK (discount >= 0),
  min_order_value DECIMAL(10,2),
  usage_limit     INT,
  used_count      INT            NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID             NOT NULL REFERENCES public.users(id),
  order_code       TEXT             NOT NULL,
  status           "OrderStatus"    NOT NULL DEFAULT 'PENDING',
  payment_method   "PaymentMethod"  NOT NULL DEFAULT 'COD',
  payment_status   "PaymentStatus"  NOT NULL DEFAULT 'UNPAID',
  shipping_method  "ShippingMethod" NOT NULL DEFAULT 'STANDARD',
  total_price      DECIMAL(10,2)    NOT NULL CHECK (total_price >= 0),
  shipping_fee     DECIMAL(10,2)    NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  discount_amount  DECIMAL(10,2)    NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price      DECIMAL(10,2)    NOT NULL CHECK (final_price >= 0),
  shipping_address JSONB            NOT NULL,
  coupon_id        UUID             REFERENCES public.coupons(id),
  handled_by       UUID             REFERENCES public.users(id),
  note             TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CHECK (final_price = total_price + shipping_fee - discount_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);

CREATE TABLE IF NOT EXISTS public.order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   UUID          REFERENCES public.products(id),
  product_name TEXT          NOT NULL,
  variant_info TEXT,
  price        DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  quantity     INT           NOT NULL CHECK (quantity > 0)
);

ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Hai policy bypass mà RFC-2 phải gỡ (F1 + F3). Tạo lại ở đây với điều kiện
-- hằng số (không có auth.uid()) để test khẳng định được migration THỰC SỰ drop
-- chúng, thay vì pass một cách rỗng vì chúng chưa từng tồn tại.
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders"
  ON public.orders FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;
CREATE POLICY "Users insert own order items"
  ON public.order_items FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Staff/Admin update orders" ON public.orders;
CREATE POLICY "Staff/Admin update orders"
  ON public.orders FOR UPDATE USING (public.is_staff_or_admin());

-- ── Trigger CŨ (RFC-2 phải drop cả 3) ───────────────────────────────────────
-- Giữ nguyên hình dạng lỗi để test chứng minh migration đã thay thế chúng:
-- restock dùng UPDATE ... FROM nên chỉ hoàn được MỘT dòng khớp.

CREATE OR REPLACE FUNCTION public.reduce_stock_on_order_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_reduce_stock_on_order_item_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_order_item_insert();

CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coupon_id IS NOT NULL THEN
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_coupon
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_and_apply_coupon();

CREATE OR REPLACE FUNCTION public.restock_on_order_cancelled_or_returned()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.products p
  SET stock = p.stock + oi.quantity
  FROM public.order_items oi
  WHERE oi.order_id = NEW.id AND p.id = oi.product_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_restock_on_cancel_or_return
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IN ('CANCELLED', 'RETURNED') AND OLD.status NOT IN ('CANCELLED', 'RETURNED'))
  EXECUTE FUNCTION public.restock_on_order_cancelled_or_returned();
