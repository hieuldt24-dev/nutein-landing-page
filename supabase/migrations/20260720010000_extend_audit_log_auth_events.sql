-- ============================================
-- NUTEIN — Mở rộng audit_log cho sự kiện auth (đăng nhập/đăng xuất/refresh)
--
-- audit_log (20260718000000_init_schema.sql) ban đầu chỉ ghi CREATE/UPDATE/
-- DELETE qua trigger cho products/orders/coupons. Thêm 4 action mới cho sự
-- kiện auth mà server thực sự quan sát được (app/api/auth/session|refresh|
-- logout — xem features/auth/services/audit-log.service.ts):
--   LOGIN_SUCCESS         — mint session sau khi Supabase xác thực OK
--   LOGOUT                — đã thu hồi refresh token
--   TOKEN_REFRESH         — mỗi lần rotate access/refresh token
--   TOKEN_REUSE_DETECTED  — refresh token cũ bị dùng lại sau khi đã rotate
--                            (dấu hiệu bị đánh cắp)
--
-- Sự kiện auth không gắn với 1 row nghiệp vụ cụ thể nào, nhưng record_id
-- đang NOT NULL -> dùng chính user_id làm record_id, table_name='auth_session'
-- để phân biệt với các dòng CRUD thật (table_name='products'/'orders'/...).
-- Không có cột user_agent riêng -> gộp vào new_data (jsonb) cùng metadata.
-- ============================================
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE 'TOKEN_REFRESH';
ALTER TYPE "AuditAction" ADD VALUE 'TOKEN_REUSE_DETECTED';

-- User xem được audit log CỦA CHÍNH MÌNH (khác "Only admin can view audit
-- log" ở init_schema — 2 policy PERMISSIVE cộng dồn theo OR, không loại trừ
-- nhau). Trong thực tế user thường chỉ thấy dòng auth của chính mình, vì
-- các action CRUD trên products/coupons chỉ STAFF/ADMIN mới làm được; đơn
-- hàng do chính user tạo (INSERT) cũng là dữ liệu họ đã có quyền xem qua
-- "Users view own orders" rồi.
CREATE POLICY "Users can view own audit log"
  ON audit_log FOR SELECT USING (auth.uid() = user_id);
