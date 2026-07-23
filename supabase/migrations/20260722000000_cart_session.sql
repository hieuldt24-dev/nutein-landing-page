-- Session cart (Joy Rush–aligned): guest giỏ theo cookie session_id;
-- user_id nullable; unique partial indexes thay UNIQUE phụ thuộc user_id NOT NULL.

-- 1) Bỏ UNIQUE cũ (NULL user_id sẽ phá semantics UNIQUE chuẩn)
ALTER TABLE cart
  DROP CONSTRAINT IF EXISTS cart_user_id_product_id_variant_id_key;

ALTER TABLE cart
  DROP CONSTRAINT IF EXISTS cart_user_id_product_id_key;

-- 2) Cho phép guest rows (không gắn users.id)
ALTER TABLE cart
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE cart
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- 3) Phải có đúng một phía sở hữu
ALTER TABLE cart
  DROP CONSTRAINT IF EXISTS cart_owner_check;

ALTER TABLE cart
  ADD CONSTRAINT cart_owner_check
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL);

-- 4) Unique theo chủ sở hữu (partial — NULL không tham gia)
CREATE UNIQUE INDEX IF NOT EXISTS cart_user_product_variant_uidx
  ON cart (user_id, product_id, variant_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cart_session_product_variant_uidx
  ON cart (session_id, product_id, variant_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_session_id
  ON cart (session_id)
  WHERE session_id IS NOT NULL;
