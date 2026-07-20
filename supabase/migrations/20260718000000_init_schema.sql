-- ============================================
-- NUTEIN — Schema Migration (v5 — Fix toàn bộ code review)
-- Supabase / PostgreSQL
-- 15 bảng. Dùng Supabase Auth có sẵn (auth.users) cho đăng nhập,
-- kể cả Google OAuth — KHÔNG tự lưu password/token ở bất kỳ đâu.
--
-- Đã fix trong bản này:
--  1. Xác nhận rõ: dùng Supabase Auth, không có mâu thuẫn thiết kế
--  2. CHECK constraint: cart.quantity, order_items.quantity,
--     reviews.rating, products.stock
--  3. Index còn thiếu: orders.created_at, blog_posts.published_at,
--     reviews(product_id, rating)
--  4. Trigger tự động trừ/hoàn kho theo trạng thái đơn hàng
--  5. Trigger tự động ghi order_status_logs
--  6. audit_trigger() hoạt động thật, gắn vào products/orders/coupons
--  7. Partial unique index: mỗi user chỉ 1 địa chỉ mặc định
--  8. Trigger validate + tăng used_count cho coupon khi tạo đơn
--  9. Partial unique index cho sku/slug/flavor+size (chỉ áp dụng
--     sản phẩm chưa xóa mềm — cho phép tái dùng sau khi soft-delete)
-- 10. RLS đầy đủ cho toàn bộ bảng còn thiếu
--
-- Fix bổ sung sau review lần 2:
-- 11. SECURITY DEFINER cho 3 trigger function (reduce_stock,
--     log_order_status_change, validate_and_apply_coupon) — nếu không
--     có, các trigger này bị chính RLS chặn khi khách thường (role=USER)
--     tự tạo đơn hàng, gây lỗi "permission denied" ngay khi đặt hàng.
-- 12. Policy cho ADMIN sửa role của user khác (trước đây chỉ tự sửa
--     được hồ sơ của chính mình).
-- 13. CHECK orders.final_price = total_price + shipping_fee - discount_amount
-- 14. CHECK coupons.discount >= 0
-- ============================================

-- ENUMS
CREATE TYPE "Role"            AS ENUM ('USER', 'STAFF', 'ADMIN');
CREATE TYPE "OrderStatus"     AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
CREATE TYPE "PaymentMethod"   AS ENUM ('COD', 'BANK_TRANSFER', 'MOMO', 'VNPAY');
CREATE TYPE "PaymentStatus"   AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "DiscountType"    AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "ShippingMethod"  AS ENUM ('STANDARD', 'EXPRESS');
CREATE TYPE "BlogCategory"    AS ENUM ('RECIPES', 'PROTEIN', 'HEALTHY_LIFESTYLE', 'NUTRITION');
CREATE TYPE "AuditAction"     AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- ============================================
-- 1. USERS / PROFILES (mục 3.9)
-- Dùng Supabase Auth (auth.users) cho toàn bộ đăng nhập, kể cả Google
-- OAuth (bật ở Dashboard > Authentication > Providers). KHÔNG tự lưu
-- password/refresh_token/access_token ở bảng nào trong schema này.
-- Bảng "users" chỉ là hồ sơ mở rộng, id trùng với auth.users.id.
-- ============================================
CREATE TABLE users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT,
  phone       TEXT        UNIQUE,
  avatar      TEXT,
  role        "Role"      NOT NULL DEFAULT 'USER',
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);

-- Tự động tạo dòng "users" mỗi khi có tài khoản mới trong auth.users
-- (áp dụng cho cả đăng ký email/password lẫn đăng nhập Google lần đầu)
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Helper function dùng chung cho RLS ở các bảng khác — kiểm tra
-- người đang gọi request có role STAFF hoặc ADMIN không.
-- Đặt SAU bảng users vì function bên trong tham chiếu tới nó.
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('STAFF', 'ADMIN')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- STAFF/ADMIN cần xem được hồ sơ khách để xử lý đơn hàng/liên hệ
CREATE POLICY "Staff/Admin can view all profiles"
  ON users FOR SELECT USING (is_staff_or_admin());

-- Chỉ ADMIN được sửa hồ sơ/role của user khác (VD: thăng cấp lên STAFF)
CREATE POLICY "Admin can update any profile"
  ON users FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
  );

-- ============================================
-- 2. USER ADDRESSES (mục 3.9 — Địa chỉ nhận hàng)
-- Fix #7: partial unique index đảm bảo mỗi user chỉ có 1 địa chỉ mặc định
-- ============================================
CREATE TABLE user_addresses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  street      TEXT        NOT NULL,
  ward        TEXT,
  district    TEXT,
  province    TEXT        NOT NULL,
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);

-- Fix #7: chỉ cho phép TỐI ĐA 1 dòng is_default = TRUE cho mỗi user
CREATE UNIQUE INDEX idx_one_default_address
  ON user_addresses(user_id) WHERE is_default = TRUE;

-- Fix #10: RLS
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses"
  ON user_addresses FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. PRODUCTS (mục 3.2 — mỗi dòng = 1 SKU theo hương vị/dung tích)
-- Fix #2: CHECK stock >= 0 (và price >= 0)
-- Fix #9: partial unique index cho sku/slug/flavor+size — chỉ áp dụng
-- sản phẩm chưa xóa mềm, cho phép tái dùng SKU sau khi soft-delete
-- ============================================
CREATE TABLE products (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  sku               TEXT           NOT NULL,
  name              TEXT           NOT NULL,
  slug              TEXT           NOT NULL,
  description       TEXT,
  flavor            TEXT,
  size              TEXT,
  price             DECIMAL(10,2)  NOT NULL CHECK (price >= 0),
  stock             INT            NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images            JSONB          NOT NULL DEFAULT '[]',
  nutrition_facts   JSONB          NOT NULL DEFAULT '{}',
  ingredients       JSONB          NOT NULL DEFAULT '[]',
  is_deleted        BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_is_deleted ON products(is_deleted);

-- Fix #9: partial unique — bỏ UNIQUE cứng, chỉ ràng buộc trên sản phẩm còn sống
CREATE UNIQUE INDEX idx_products_sku_active         ON products(sku)  WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_products_slug_active        ON products(slug) WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_products_flavor_size_active ON products(flavor, size) WHERE is_deleted = FALSE;

-- Fix #10: RLS — public chỉ xem sản phẩm còn sống, chỉnh sửa chỉ STAFF/ADMIN
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active products"
  ON products FOR SELECT USING (is_deleted = FALSE);

CREATE POLICY "Staff/Admin manage products"
  ON products FOR ALL USING (is_staff_or_admin());

-- ============================================
-- 4. CART (mục 3.3 — Giỏ hàng)
-- Fix #2: CHECK quantity > 0
-- ============================================
CREATE TABLE cart (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INT         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_cart_user_id ON cart(user_id);

-- Fix #10: RLS
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
  ON cart FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 5. COUPONS (mục 3.3 — Mã giảm giá)
-- ============================================
CREATE TABLE coupons (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT           NOT NULL UNIQUE,
  discount_type    "DiscountType" NOT NULL DEFAULT 'FIXED',
  discount         DECIMAL(10,2)  NOT NULL CHECK (discount >= 0),
  min_order_value  DECIMAL(10,2),
  usage_limit      INT,
  used_count       INT            NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_is_active ON coupons(is_active);

-- Fix #10: RLS — public chỉ xem coupon đang active, quản lý chỉ STAFF/ADMIN
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active coupons"
  ON coupons FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Staff/Admin manage coupons"
  ON coupons FOR ALL USING (is_staff_or_admin());

-- ============================================
-- 6. ORDERS (mục 3.4 — Thanh toán; shipping_address là snapshot JSONB)
-- ============================================
CREATE TABLE orders (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID             NOT NULL REFERENCES users(id),
  status              "OrderStatus"    NOT NULL DEFAULT 'PENDING',
  payment_method      "PaymentMethod"  NOT NULL DEFAULT 'COD',
  payment_status      "PaymentStatus"  NOT NULL DEFAULT 'UNPAID',
  shipping_method     "ShippingMethod" NOT NULL DEFAULT 'STANDARD',
  total_price         DECIMAL(10,2)    NOT NULL CHECK (total_price >= 0),
  shipping_fee        DECIMAL(10,2)    NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  discount_amount     DECIMAL(10,2)    NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price         DECIMAL(10,2)    NOT NULL CHECK (final_price >= 0),
  shipping_address    JSONB            NOT NULL,
  coupon_id           UUID             REFERENCES coupons(id),
  handled_by          UUID             REFERENCES users(id),
  note                TEXT,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  -- Đảm bảo final_price luôn khớp công thức, tránh sai lệch dữ liệu
  -- nếu backend tính nhầm khi tạo/cập nhật đơn
  CHECK (final_price = total_price + shipping_fee - discount_amount)
);

-- Fix #3: index created_at DESC để load "đơn hàng mới nhất" nhanh hơn
CREATE INDEX idx_orders_user_id            ON orders(user_id);
CREATE INDEX idx_orders_status             ON orders(status);
CREATE INDEX idx_orders_created_at         ON orders(created_at DESC);
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);

-- Fix #10: RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id OR is_staff_or_admin());

CREATE POLICY "Users create own orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff/Admin update orders"
  ON orders FOR UPDATE USING (is_staff_or_admin());

-- ============================================
-- 7. ORDER ITEMS (snapshot tên/giá tại thời điểm mua)
-- Fix #2: CHECK quantity > 0
-- ============================================
CREATE TABLE order_items (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID           REFERENCES products(id),
  product_name  TEXT           NOT NULL,
  variant_info  TEXT,
  price         DECIMAL(10,2)  NOT NULL CHECK (price >= 0),
  quantity      INT            NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Fix #10: RLS — xem qua quan hệ với đơn hàng cha
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own order items"
  ON order_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR is_staff_or_admin())
    )
  );

-- ============================================
-- 8. ORDER STATUS LOGS (lịch sử thay đổi trạng thái đơn hàng)
-- Fix #5: trigger tự động ghi log (xem phần TRIGGERS bên dưới)
-- ============================================
CREATE TABLE order_status_logs (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      "OrderStatus"  NOT NULL,
  note        TEXT,
  changed_by  UUID           REFERENCES users(id),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_logs_order_id   ON order_status_logs(order_id);
CREATE INDEX idx_order_status_logs_created_at ON order_status_logs(order_id, created_at);

-- Fix #10: RLS
ALTER TABLE order_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own order status logs"
  ON order_status_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_logs.order_id
        AND (o.user_id = auth.uid() OR is_staff_or_admin())
    )
  );

-- ============================================
-- 9. WISHLISTS (mục 3.9 — Danh sách yêu thích)
-- ============================================
CREATE TABLE wishlists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);

-- Fix #10: RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist"
  ON wishlists FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 10. REVIEWS (đánh giá thật + gộp testimonials qua is_featured)
-- Fix #2: CHECK rating BETWEEN 1 AND 5
-- Fix #3: index (product_id, rating)
-- ============================================
CREATE TABLE reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rating      INT         NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id),
  is_featured BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_reviews_product_id       ON reviews(product_id);
CREATE INDEX idx_reviews_is_featured      ON reviews(is_featured);
CREATE INDEX idx_reviews_product_rating   ON reviews(product_id, rating);

-- Fix #10: RLS — ai cũng xem được review (hiển thị công khai ở trang sản phẩm),
-- chỉ chủ sở hữu mới được tạo/sửa/xóa review của chính mình
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Users create own reviews"
  ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews"
  ON reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reviews"
  ON reviews FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 11. BLOG POSTS (mục 3.5 — category ENUM cố định, tags dạng mảng)
-- Fix #3: index published_at DESC để load bài viết mới nhất nhanh hơn
-- ============================================
CREATE TABLE blog_posts (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  category      "BlogCategory"  NOT NULL,
  tags          TEXT[]          NOT NULL DEFAULT '{}',
  title         TEXT            NOT NULL,
  slug          TEXT            NOT NULL UNIQUE,
  thumbnail     TEXT,
  excerpt       TEXT,
  content       TEXT            NOT NULL,
  author        TEXT,
  is_published  BOOLEAN         NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_category     ON blog_posts(category);
CREATE INDEX idx_blog_posts_is_published ON blog_posts(is_published);
CREATE INDEX idx_blog_posts_tags         ON blog_posts USING GIN(tags);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- Fix #10: RLS — public chỉ xem bài đã publish, quản lý chỉ STAFF/ADMIN
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published posts"
  ON blog_posts FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Staff/Admin manage posts"
  ON blog_posts FOR ALL USING (is_staff_or_admin());

-- ============================================
-- 12. FAQS (mục 3.2 — danh sách chung cho trang Sản phẩm)
-- ============================================
CREATE TABLE faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0
);

-- Fix #10: RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view faqs"
  ON faqs FOR SELECT USING (true);

CREATE POLICY "Staff/Admin manage faqs"
  ON faqs FOR ALL USING (is_staff_or_admin());

-- ============================================
-- 13. STATIC PAGES (mục 3.8 — 5 trang Chính sách)
-- ============================================
CREATE TABLE static_pages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix #10: RLS
ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view static pages"
  ON static_pages FOR SELECT USING (true);

CREATE POLICY "Staff/Admin manage static pages"
  ON static_pages FOR ALL USING (is_staff_or_admin());

-- ============================================
-- 14. CONTACT MESSAGES (mục 3.7 — Form liên hệ)
-- ============================================
CREATE TABLE contact_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  handled_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix #10: RLS — bất kỳ ai (kể cả chưa đăng nhập) đều gửi được form liên hệ,
-- nhưng chỉ STAFF/ADMIN mới đọc được nội dung
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact message"
  ON contact_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff/Admin view contact messages"
  ON contact_messages FOR SELECT USING (is_staff_or_admin());

CREATE POLICY "Staff/Admin update contact messages"
  ON contact_messages FOR UPDATE USING (is_staff_or_admin());

-- ============================================
-- 15. AUDIT LOG (Fix #6: gắn trigger thật để bảng này hoạt động)
-- ============================================
CREATE TABLE audit_log (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID           REFERENCES users(id),
  action      "AuditAction"  NOT NULL,
  table_name  TEXT           NOT NULL,
  record_id   UUID           NOT NULL,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id      ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at   ON audit_log(created_at);

-- Fix #10: RLS — chỉ ADMIN được xem nhật ký audit
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can view audit log"
  ON audit_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- ============================================
-- AUTO UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cart_updated_at
  BEFORE UPDATE ON cart FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_static_pages_updated_at
  BEFORE UPDATE ON static_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Fix #4: TRIGGER TỰ ĐỘNG TRỪ/HOÀN KHO
-- Trừ kho khi đơn chuyển sang PROCESSING; hoàn lại kho nếu đơn đã
-- từng trừ kho mà sau đó bị CANCELLED/RETURNED.
-- ============================================
CREATE OR REPLACE FUNCTION reduce_stock_on_processing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'PROCESSING' AND OLD.status IS DISTINCT FROM 'PROCESSING' THEN
    UPDATE products p
    SET stock = p.stock - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

  ELSIF NEW.status IN ('CANCELLED', 'RETURNED')
        AND OLD.status NOT IN ('PENDING', 'CANCELLED', 'RETURNED') THEN
    -- Đơn đã từng trừ kho (đã qua PROCESSING trở lên) mà giờ bị hủy/trả -> hoàn kho
    UPDATE products p
    SET stock = p.stock + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reduce_stock
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION reduce_stock_on_processing();

-- ============================================
-- Fix #5: TRIGGER TỰ ĐỘNG GHI order_status_logs
-- Ghi 1 dòng log ngay khi đơn được tạo, và mỗi khi status thay đổi.
-- ============================================
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_status_logs (order_id, status, changed_by)
  VALUES (NEW.id, NEW.status, NEW.handled_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_order_status_insert
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

CREATE TRIGGER trg_log_order_status_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_order_status_change();

-- ============================================
-- Fix #8: TRIGGER VALIDATE + TĂNG used_count CHO COUPON
-- Chặn tạo đơn nếu coupon không hợp lệ/hết hạn/hết lượt dùng,
-- đồng thời tự tăng used_count ngay khi đơn được tạo thành công.
-- ============================================
CREATE OR REPLACE FUNCTION validate_and_apply_coupon()
RETURNS TRIGGER AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
BEGIN
  IF NEW.coupon_id IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE id = NEW.coupon_id FOR UPDATE;

    IF NOT FOUND OR v_coupon.is_active = FALSE THEN
      RAISE EXCEPTION 'Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa';
    END IF;

    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
      RAISE EXCEPTION 'Mã giảm giá đã hết hạn';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Mã giảm giá đã hết lượt sử dụng';
    END IF;

    UPDATE coupons SET used_count = used_count + 1 WHERE id = NEW.coupon_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_coupon
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_and_apply_coupon();

-- ============================================
-- Fix #6: AUDIT TRIGGER HOẠT ĐỘNG THẬT
-- Tự động ghi mọi thay đổi CREATE/UPDATE/DELETE vào audit_log,
-- gắn cho các bảng quan trọng nhất: products, orders, coupons.
-- ============================================
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'CREATE', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trg_audit_coupons
  AFTER INSERT OR UPDATE OR DELETE ON coupons
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
