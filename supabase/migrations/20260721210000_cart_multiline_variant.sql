-- Multi-line cart: nhiều dòng / user theo variant_id (pack-1 / pack-3 / pack-6)
-- Apply 1 lần (CLI hoặc SQL Editor bởi owner).

-- 1) Bỏ UNIQUE(user_id, product_id) — cho phép nhiều gói cùng SKU
ALTER TABLE cart
  DROP CONSTRAINT IF EXISTS cart_user_id_product_id_key;

-- 2) UNIQUE theo gói
ALTER TABLE cart
  DROP CONSTRAINT IF EXISTS cart_user_id_product_id_variant_id_key;

ALTER TABLE cart
  ADD CONSTRAINT cart_user_id_product_id_variant_id_key
  UNIQUE (user_id, product_id, variant_id);

-- 3) Index hỗ trợ lookup theo user
CREATE INDEX IF NOT EXISTS idx_cart_user_product
  ON cart (user_id, product_id);
