-- E2E chuẩn: order_code + cart.variant_id + seed sản phẩm Nutein
-- Apply 1 lần (CLI `supabase db push` hoặc SQL Editor bởi owner).

-- 1) Mã đơn hiển thị
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_code TEXT;

UPDATE orders
SET order_code = 'NT-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYYMMDD')
  || '-' || upper(substr(replace(id::text, '-', ''), 1, 4))
WHERE order_code IS NULL;

ALTER TABLE orders
  ALTER COLUMN order_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_code
  ON orders(order_code);

-- 2) Gói đóng trên giỏ (pack-1 / pack-3 / pack-6)
ALTER TABLE cart
  ADD COLUMN IF NOT EXISTS variant_id TEXT NOT NULL DEFAULT 'pack-1';

-- 3) Seed SKU chủ lực — UUID cố định để app map FK
INSERT INTO products (
  id,
  sku,
  name,
  slug,
  description,
  flavor,
  size,
  price,
  stock,
  images,
  nutrition_facts,
  ingredients
)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'NUTEIN-PV-001',
  'Nutein',
  'nutein',
  'Bột protein thực vật Nutein, dễ pha, phù hợp người ăn chay và tập luyện nhẹ nhàng.',
  'Original',
  '1 hũ',
  249000.00,
  9999,
  '["/images/example.jpg"]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  is_deleted = FALSE,
  sku = EXCLUDED.sku,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  price = EXCLUDED.price,
  updated_at = NOW();

-- 4) Cho phép user insert order_items của đơn mình (khi không dùng service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Users insert own order items'
  ) THEN
    CREATE POLICY "Users insert own order items"
      ON order_items FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = order_items.order_id
            AND o.user_id = auth.uid()
        )
      );
  END IF;
END $$;
