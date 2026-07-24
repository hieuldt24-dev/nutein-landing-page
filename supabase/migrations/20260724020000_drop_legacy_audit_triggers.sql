-- Bỏ 3 trigger audit cũ (`trg_audit_products/orders/coupons`) dựa
-- `auth.uid()` — hàm này luôn trả NULL vì app ghi qua Supabase service-role
-- key (không đi qua session Supabase Auth nào); JWT app tự ký hoàn toàn
-- tách biệt khỏi cơ chế auth.uid() của PostgREST. Mọi dòng audit_log ghi từ
-- trước tới nay đều có user_id = NULL do vấn đề này.
--
-- Thay thế: app tự ghi `audit_log` tường minh với user_id thật ngay sau
-- mỗi thao tác ghi thành công (xem
-- features/admin-audit/services/audit-log.repository.ts, gọi từ
-- admin-products/admin-orders/admin-coupons repository + checkout order
-- creation). Apply 1 lần (SQL Editor bởi owner), an toàn chạy lại nhiều lần.
DROP TRIGGER IF EXISTS trg_audit_products ON products;
DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
DROP TRIGGER IF EXISTS trg_audit_coupons ON coupons;
DROP FUNCTION IF EXISTS audit_trigger();
