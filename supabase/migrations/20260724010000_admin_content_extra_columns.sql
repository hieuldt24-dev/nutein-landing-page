-- Cột bổ sung để nối các màn Staff còn lại (Sản phẩm/Liên hệ/Blog/Trang tĩnh)
-- vào bảng thật thay vì mock in-memory — giữ tối thiểu, chỉ thêm đúng field
-- UI hiện đang cho phép sửa mà DB gốc chưa có chỗ chứa. Apply 1 lần (CLI
-- `supabase db push` hoặc SQL Editor bởi owner).

-- 1) products — gom các field marketing/cosmetic (tagline, unitLabel, ảnh
-- gallery, variants đóng gói...) vào 1 JSONB thay vì thêm nhiều cột rời.
-- Không đụng price/stock/name/description (đã có cột riêng, dùng thẳng).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS marketing_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Chốt chặn DB-level cho đúng kiến trúc single-SKU: app (Staff Sản phẩm,
-- checkout, order_items) chỉ từng thao tác đúng 1 UUID cố định này — API
-- Staff cũng không có endpoint tạo sản phẩm mới (chỉ GET/PATCH hardcode
-- theo id). CHECK này chặn cả trường hợp insert trực tiếp (script/SQL
-- Editor) tạo thêm sản phẩm khác ngoài ý muốn.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_single_sku_only'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_single_sku_only
      CHECK (id = 'a0000000-0000-4000-8000-000000000001');
  END IF;
END $$;

-- Seed marketing_meta cho sản phẩm chủ lực đã seed ở migration trước, chỉ
-- khi còn rỗng (không ghi đè nếu Staff đã lưu qua UI mới).
UPDATE products
SET marketing_meta = '{
  "tagline": "Protein thực vật — năng lượng sạch cho lối sống lành mạnh mỗi ngày.",
  "unitLabel": "Hộp 1 hũ · Protein thực vật",
  "image": "/images/example.jpg",
  "imageAlt": "Hộp Protein thực vật Nutein",
  "defaultVariantId": "pack-1",
  "gallery": [
    { "id": "gallery-1", "src": "/images/example.jpg", "alt": "Hộp Protein thực vật Nutein — góc chính" },
    { "id": "gallery-2", "src": "/images/yogurt.jpg", "alt": "Nutein dùng cùng sữa chua" },
    { "id": "gallery-3", "src": "/images/beans.jpg", "alt": "Nguyên liệu đậu protein thực vật" },
    { "id": "gallery-4", "src": "/images/vegetables.jpg", "alt": "Lối sống xanh cùng Nutein" }
  ],
  "variants": [
    { "id": "pack-1", "label": "1 hộp", "units": 1 },
    { "id": "pack-3", "label": "3 hộp", "units": 3 },
    { "id": "pack-6", "label": "6 hộp", "units": 6 }
  ]
}'::jsonb
WHERE id = 'a0000000-0000-4000-8000-000000000001'
  AND marketing_meta = '{}'::jsonb;

-- 2) contact_messages — ghi chú nội bộ Staff (UI hiện có ô nhập nhưng
-- chưa có cột lưu). "Đã xử lý" dùng luôn handled_by IS NOT NULL, không
-- cần cột boolean riêng.
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- 3) blog_posts — alt ảnh cover (a11y), tag lọc công thức (trang Blog công
-- khai lọc theo recipe filter), phút đọc (Staff nhập tay trong editor,
-- không tự tính), và 2 cờ curation cho trang chủ/blog public ("Bài nổi
-- bật", "Công thức yêu thích") — Staff bật/tắt qua editor.
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS cover_alt TEXT,
  ADD COLUMN IF NOT EXISTS recipe_filters TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reading_minutes INT NOT NULL DEFAULT 5 CHECK (reading_minutes > 0),
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- 4) static_pages — seed 6 trang đã biết (5 chính sách + about) để màn
-- "Trang tĩnh" của Staff luôn thấy đủ danh sách ngay từ đầu, tránh phải tạo
-- tay từng slug. ON CONFLICT DO NOTHING — không ghi đè nếu đã có/đã sửa.
INSERT INTO static_pages (slug, title, content) VALUES
('bao-mat', 'Chính sách bảo mật', $page$Nutein cam kết bảo vệ thông tin cá nhân của khách hàng. Chúng tôi chỉ thu thập và xử lý dữ liệu cần thiết để vận hành cửa hàng, giao hàng và hỗ trợ bạn tốt hơn.

## 01. Thông tin chúng tôi thu thập
Họ tên, số điện thoại, email, địa chỉ nhận hàng và nội dung bạn gửi qua form liên hệ hoặc tài khoản. Dữ liệu thanh toán (nếu có) được xử lý qua đối tác cổng thanh toán — Nutein không lưu đầy đủ thông tin thẻ.

## 02. Mục đích sử dụng
Xử lý đơn hàng, giao nhận, chăm sóc khách hàng, cải thiện trải nghiệm website và gửi thông tin liên quan đơn hàng (khi bạn đồng ý nhận thông báo marketing).

## 03. Chia sẻ với bên thứ ba
Chỉ chia sẻ khi cần thiết để hoàn tất đơn (đơn vị vận chuyển, cổng thanh toán) hoặc khi pháp luật yêu cầu. Chúng tôi không bán dữ liệu cá nhân.

## 04. Bảo mật & lưu trữ
Áp dụng biện pháp kỹ thuật và tổ chức phù hợp để hạn chế truy cập trái phép. Dữ liệu được lưu trong thời gian cần thiết cho mục đích nêu trên hoặc theo quy định pháp luật.

## 05. Quyền của bạn
Bạn có thể yêu cầu xem, cập nhật hoặc xoá thông tin tài khoản qua trang Tài khoản / Liên hệ. Mọi thắc mắc về bảo mật gửi về hello@nutein.vn.$page$),

('dieu-khoan', 'Điều khoản sử dụng', $page$Khi truy cập và sử dụng website Nutein, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.

## 01. Tài khoản
Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình. Thông tin cung cấp phải chính xác, đầy đủ.

## 02. Đặt hàng & giá
Đơn hàng chỉ được xác nhận sau khi Nutein tiếp nhận và xử lý thành công. Giá, khuyến mãi và tồn kho có thể thay đổi mà không cần báo trước, trừ đơn đã xác nhận.

## 03. Nội dung trên website
Hình ảnh, bài viết và tài liệu thuộc quyền của Nutein hoặc bên cấp phép. Không sao chép, phân phối cho mục đích thương mại khi chưa được đồng ý bằng văn bản.

## 04. Giới hạn trách nhiệm
Nutein nỗ lực duy trì thông tin chính xác nhưng không cam kết website không gián đoạn hoặc không lỗi. Trách nhiệm pháp lý được giới hạn trong phạm vi pháp luật cho phép.

## 05. Thay đổi điều khoản
Chúng tôi có thể cập nhật điều khoản theo thời gian. Phiên bản mới có hiệu lực kể từ ngày đăng trên trang này.$page$),

('giao-hang', 'Chính sách giao hàng', $page$Nutein giao hàng toàn quốc qua đối tác vận chuyển uy tín. Thời gian và phí ship phụ thuộc khu vực và phương thức bạn chọn khi thanh toán.

## 01. Phạm vi giao hàng
Hỗ trợ giao trên toàn Việt Nam. Một số khu vực xa / hải đảo có thể cần thêm thời gian hoặc phụ phí theo bảng giá đơn vị vận chuyển.

## 02. Thời gian dự kiến
Giao tiêu chuẩn thường 3–5 ngày làm việc sau khi đơn được xác nhận. Giao nhanh (nếu có) rút ngắn theo khu vực — thời gian hiển thị tại checkout là ước tính.

## 03. Phí vận chuyển
Phí được tính theo địa chỉ và phương thức. Đơn đủ điều kiện chương trình khuyến mãi có thể được miễn phí ship theo tiến độ voucher trên giỏ hàng.

## 04. Kiểm tra khi nhận
Vui lòng kiểm tra ngoại quan kiện hàng trước khi ký nhận. Nếu hộp móp méo / seal hỏng, từ chối nhận hoặc ghi chú với shipper và liên hệ Nutein trong 48 giờ.

## 05. Thất lạc / chậm trễ
Chúng tôi hỗ trợ tra cứu vận đơn với đơn vị giao hàng. Chậm do thời tiết, lễ tết hoặc sự cố carrier ngoài tầm kiểm soát sẽ được cập nhật sớm nhất có thể.$page$),

('doi-tra', 'Chính sách đổi trả', $page$Cảm ơn bạn đã chọn Nutein. Vì sản phẩm thực phẩm / dinh dưỡng, chúng tôi áp dụng đổi trả trong các trường hợp cụ thể dưới đây để đảm bảo an toàn chất lượng.

## 01. Điều kiện được hỗ trợ
Sản phẩm lỗi do sản xuất hoặc hư hỏng trong vận chuyển; giao sai hàng so với đơn đã xác nhận. Sản phẩm còn nguyên seal (trừ khi lỗi nằm trong seal và được Nutein xác nhận).

## 02. Thời hạn yêu cầu
Liên hệ trong 7 ngày kể từ khi nhận hàng (hoặc 48 giờ với hàng hư do vận chuyển). Gửi kèm mã đơn, mô tả sự cố và ảnh minh chứng rõ.

## 03. Cách thức xử lý
Sau khi xác minh, Nutein có thể đổi sản phẩm tương đương hoặc hoàn tiền theo phương thức thanh toán gốc. Phí ship liên quan đơn lỗi (nếu có) được xem xét hoàn theo từng trường hợp.

## 04. Không áp dụng đổi trả
Đổi ý / không thích hương vị; đã mở seal khi không thuộc lỗi được xác nhận; hư hỏng do bảo quản sai hướng dẫn; đơn giao thành công nhưng thất lạc sau khi ký nhận.

## 05. Liên hệ hỗ trợ
Gửi yêu cầu qua form Liên hệ hoặc email hello@nutein.vn với tiêu đề nêu mã đơn để được phản hồi nhanh.$page$),

('thanh-toan', 'Phương thức thanh toán', $page$Nutein hỗ trợ các hình thức thanh toán phổ biến để bạn hoàn tất đơn hàng thuận tiện và an toàn.

## 01. Thanh toán khi nhận hàng (COD)
Thanh toán bằng tiền mặt cho nhân viên giao hàng khi nhận kiện. Vui lòng chuẩn bị đúng số tiền trên đơn.

## 02. Chuyển khoản ngân hàng
Chuyển khoản theo thông tin Nutein cung cấp sau khi đặt hàng. Đơn được xử lý sau khi xác nhận đã nhận chuyển khoản (có thể cần bạn gửi biên lai nếu được yêu cầu).

## 03. Hoá đơn & chứng từ
Thông tin xuất hoá đơn (nếu cần) vui lòng ghi chú khi đặt hàng hoặc liên hệ sớm sau khi đặt. Chúng tôi hỗ trợ trong phạm vi quy định kế toán hiện hành.

## 04. Sự cố thanh toán
Nếu giao dịch lỗi hoặc bị trừ tiền nhưng đơn chưa xác nhận, liên hệ ngay kèm mã giao dịch / ảnh biên lai để được kiểm tra và hỗ trợ.$page$),

('about', 'Về Nutein', $page$Khi cuộc sống bận rộn, dinh dưỡng phải đủ sạch.

Đó là động lực của chúng tôi: mang nguồn đạm thực vật thật, dễ dùng vào những khoảnh khắc cần năng lượng mỗi ngày.

## Câu chuyện thương hiệu

Nutein bắt đầu từ nhu cầu thật của người ăn sạch, tập luyện và dân văn phòng: muốn bổ sung protein mà không phụ thuộc đạm động vật, không chấp nhận chất độn hay hương liệu hóa học. Chúng tôi chọn hướng Organic Grocery — nguyên liệu truy xuất được, công thức tối giản, hương vị từ hạt và thiên nhiên.

## Triết lý sản phẩm

Healthy Lifestyle không phải khẩu hiệu. Mỗi hộp Nutein hướng tới ba điều rõ ràng: nguyên liệu thật, hấp thu nhẹ bụng, và thói quen dùng bền vững — ít phụ gia hơn, nhiều dinh dưỡng có thể cảm nhận sau vài tuần duy trì.$page$)

ON CONFLICT (slug) DO NOTHING;
