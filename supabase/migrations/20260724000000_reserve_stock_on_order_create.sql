-- Trừ kho NGAY LÚC ĐẶT HÀNG (order_items insert) thay vì đợi tới lúc Staff
-- chuyển đơn sang PROCESSING. Đóng race condition oversell: 2 đơn đặt gần
-- như đồng thời khi kho sắp hết đều có thể lọt qua pre-check phía app
-- (SELECT rời rạc, không lock) — trigger dưới đây là chốt chặn thật, atomic
-- nhờ row lock của Postgres trên UPDATE...SET stock = stock - x, kết hợp
-- CHECK (stock >= 0) đã có sẵn trên products. Apply 1 lần (CLI `supabase db
-- push` hoặc SQL Editor bởi owner) — không tự chạy trong runtime app.

-- 1) Bỏ trigger trừ kho cũ (trừ lúc PROCESSING)
DROP TRIGGER IF EXISTS trg_reduce_stock ON orders;
DROP FUNCTION IF EXISTS reduce_stock_on_processing();

-- 2) Trừ kho ngay khi order_items được insert (= lúc tạo đơn, mọi trạng
-- thái kể cả PENDING) — mỗi dòng order_items trừ đúng quantity của dòng đó.
CREATE OR REPLACE FUNCTION reduce_stock_on_order_item_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reduce_stock_on_order_item_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_order_item_insert();

-- 3) Hoàn kho khi đơn bị CANCELLED/RETURNED — không còn điều kiện "đã qua
-- PROCESSING" như trigger cũ, vì giờ MỌI đơn đã trừ kho ngay từ lúc tạo.
CREATE OR REPLACE FUNCTION restock_on_order_cancelled_or_returned()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products p
  SET stock = p.stock + oi.quantity
  FROM order_items oi
  WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_restock_on_cancel_or_return
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('CANCELLED', 'RETURNED')
    AND OLD.status NOT IN ('CANCELLED', 'RETURNED')
  )
  EXECUTE FUNCTION restock_on_order_cancelled_or_returned();
