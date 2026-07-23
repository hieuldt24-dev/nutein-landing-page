-- payOS integration cho phương thức "bank_transfer": tạo payment link payOS
-- thật (VietQR) thay demo instructions cũ. Enum PAYOS tách biệt khỏi
-- BANK_TRANSFER (chuyển khoản tay/thủ công) để báo cáo phân biệt được 2 loại.
-- payos_order_code: mã đơn SỐ payOS yêu cầu (khác orders.order_code dạng
-- chuỗi NT-...) — dùng để webhook/reconcile tra ngược đơn.
-- payos_payment_link_id: dùng để gọi lại payOS API (get/cancel) khi cần.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYOS';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payos_order_code BIGINT,
  ADD COLUMN IF NOT EXISTS payos_payment_link_id TEXT;

-- Partial unique: đơn COD/MOMO không đụng payOS thì NULL, không tham gia unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payos_order_code
  ON orders (payos_order_code)
  WHERE payos_order_code IS NOT NULL;
