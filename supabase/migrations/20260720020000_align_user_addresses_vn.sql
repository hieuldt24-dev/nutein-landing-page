-- ============================================
-- NUTEIN — Align `user_addresses` với UX thật đang triển khai
-- (features/account/schemas/address.schema.ts, features/checkout/vn-divisions.ts):
--
--  * VN hành chính 2 cấp (tỉnh/thành + phường/xã, sau sáp nhập 2025) —
--    KHÔNG còn quận/huyện, nên bỏ cột `district`.
--  * Dropdown tỉnh/phường cần mã hành chính (`province_code`/`ward_code`)
--    để prefill đúng lựa chọn khi sửa địa chỉ (tên có thể trùng giữa
--    nhiều tỉnh/phường khác nhau, chỉ tên không đủ định danh).
--  * Quyết định sản phẩm: họ tên/SĐT người nhận nằm ở hồ sơ user
--    (bảng `users`), sổ địa chỉ chỉ lưu vị trí giao hàng — xem
--    features/account/types#ShippingAddress + comment cũ ở
--    features/account/services/account.repository.ts (bản mock trước đó).
--    Vì vậy bỏ `full_name`/`phone` khỏi bảng này.
--  * Thêm `label` (nhãn tuỳ chọn — "Nhà", "Văn phòng"...).
-- ============================================

ALTER TABLE user_addresses
  DROP COLUMN full_name,
  DROP COLUMN phone,
  DROP COLUMN district;

ALTER TABLE user_addresses
  ADD COLUMN label         TEXT,
  ADD COLUMN province_code TEXT,
  ADD COLUMN ward_code     TEXT;

-- Backfill phòng trường hợp đã có dữ liệu cũ (môi trường dev/seed) trước khi
-- ép NOT NULL — dữ liệu thật sẽ được ghi lại đúng qua CRUD mới ngay sau đó.
UPDATE user_addresses
SET province_code = COALESCE(province_code, ''),
    ward_code     = COALESCE(ward_code, ''),
    ward          = COALESCE(ward, '')
WHERE province_code IS NULL OR ward_code IS NULL OR ward IS NULL;

ALTER TABLE user_addresses
  ALTER COLUMN province_code SET NOT NULL,
  ALTER COLUMN ward_code     SET NOT NULL,
  ALTER COLUMN ward          SET NOT NULL;
