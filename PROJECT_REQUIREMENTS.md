# TÀI LIỆU YÊU CẦU WEBSITE — NUTEIN

Tài liệu này ghi nhận mục tiêu dự án, cấu trúc sitemap, chi tiết các khối nội dung của từng trang, quy chuẩn UX và danh sách định tuyến các trang (Routing Pages) sẽ được triển khai trong ứng dụng Next.js.

---

## 1. Tổng Quan Dự Án

| Hạng mục | Mô tả |
| :--- | :--- |
| **Loại website** | E-commerce (bán hàng trực tuyến) 1 sản phẩm chủ lực – Protein thực vật |
| **Định vị thương hiệu** | Healthy Lifestyle, nguyên liệu thật, phong cách Organic Grocery |
| **Mục tiêu chính** | (1) Truyền tải thương hiệu → (2) Thuyết phục mua hàng → (3) Tối ưu chuyển đổi & giữ chân khách hàng |
| **Nhóm trang** | 10 trang chính + Footer toàn site |

> ⚠️ **Ràng buộc quan trọng cho mọi trang liên quan sản phẩm/giỏ hàng/đơn hàng/wishlist:** Nutein chỉ bán **1 sản phẩm chủ lực** (single-SKU), không phải catalog nhiều sản phẩm. Một số mục dưới đây (Cart, Wishlist) dùng câu chữ generic kiểu e-commerce đa sản phẩm ("danh sách sản phẩm", "sản phẩm yêu thích") — đã được đánh dấu ⚠️ tại từng vị trí kèm giải thích đúng. Không implement listing/catalog/search cho "sản phẩm" (chỉ blog/recipe mới cần listing). Chi tiết state/shape dữ liệu xem `docs/state-management.md` mục 7.

---

## 2. Danh Sách Các Trang & Đường Dẫn (Next.js App Router Mapping)

Dưới đây là danh sách chi tiết các trang sẽ được tạo trong cấu trúc thư mục `app/` của Next.js:

| STT | Trạng thái | Tên trang | Route Path | Next.js File Path | Ghi chú |
| :--- | :---: | :--- | :--- | :--- | :--- |
| 1 | ✅ | **Trang chủ** (Home) | `/` | `app/page.tsx` | Đã xong (Navbar, HeroSection, Footer) |
| 2 | ⏳ | **Chi tiết Sản phẩm** (Landing Page) | `/product` | `app/product/page.tsx` | Chờ triển khai (Trang bán hàng chủ lực) |
| 3 | ⏳ | **Giỏ hàng** (Cart) | `/cart` | `app/cart/page.tsx` | Chờ triển khai (Quản lý giỏ hàng cục bộ/SWR) |
| 4 | ⏳ | **Thanh toán** (Checkout) | `/checkout` | `app/checkout/page.tsx` | Chờ triển khai (Form đặt hàng, ship, voucher) |
| 5 | ⏳ | **Thành công** (Order Success) | `/checkout/success` | `app/checkout/success/page.tsx` | Chờ triển khai (Trang cảm ơn & dẫn dắt) |
| 6 | ⏳ | **Danh sách Blog** (Explore) | `/blog` | `app/blog/page.tsx` | Chờ triển khai (Tìm kiếm, bộ lọc chuyên mục) |
| 7 | ⏳ | **Chi tiết bài viết** (Blog Detail) | `/blog/[slug]` | `app/blog/[slug]/page.tsx` | Chờ triển khai (Đọc bài viết MDX/HTML) |
| 8 | ⏳ | **Về Nutein** (About) | `/about` | `app/about/page.tsx` | Chờ triển khai (Câu chuyện thương hiệu) |
| 9 | ⏳ | **Liên hệ** (Contact) | `/contact` | `app/contact/page.tsx` | Chờ triển khai (Đã có logic Contact API & Service) |
| 10 | ⏳ | **Trang chính sách** (Dynamic) | `/policies/[slug]` | `app/policies/[slug]/page.tsx` | Chờ triển khai (giao-hang, doi-tra, bao-mat, v.v.) |
| 11 | ⏳ | **Tài khoản chính** (Dashboard) | `/account` | `app/account/page.tsx` | Chờ triển khai (Thông tin cá nhân & địa chỉ) |
| 12 | ✅ | **Đăng nhập** (Login) | - (Popup Modal) | `components/shared/AuthModal.tsx` | Đã xong (Tích hợp dạng Popup chặn tương tác trang nền) |
| 13 | ✅ | **Đăng ký** (Register) | - (Popup Modal) | `components/shared/AuthModal.tsx` | Đã xong (Tích hợp dạng Popup chặn tương tác trang nền) |
| 14 | ⏳ | **Lịch sử đơn hàng** (Orders) | `/account/orders` | `app/account/orders/page.tsx` | Client Component (Theo dõi đơn hàng qua SWR/DB) |
| 15 | ⏳ | **Sản phẩm yêu thích** (Wishlist) | `/account/wishlist` | `app/account/wishlist/page.tsx`| Client Component (Lấy từ localStorage/DB) ⚠️ Cần xác nhận lại với client: site chỉ có 1 sản phẩm chủ lực (mục 1) nên "wishlist sản phẩm" chưa rõ nghĩa — có thể ý client là lưu công thức/blog yêu thích (xem mục 3.5) chứ không phải sản phẩm. Không code route này theo hướng multi-product wishlist khi chưa xác nhận. |

---

## 3. Chi Tiết Từng Trang

### 3.1 Trang Chủ (Home)
* **Mục tiêu:** Giới thiệu thương hiệu, truyền tải phong cách sống Healthy Lifestyle, dẫn dắt sang trang Sản phẩm.
* **Các khối (Blocks):**
  * **Hero Banner:** Hình ảnh và thông điệp chủ đạo (Mạnh mẽ, tươi mát, Organic).
  * **Giới thiệu nhanh:** "Một ly Protein Nutein có gì?".
  * **Điểm khác biệt:** "Vì sao Protein Nutein khác biệt?".
  * **Đối tượng phù hợp:** "Dành cho ai?".
  * **Giá trị sản phẩm:** Lợi ích của Protein thực vật.
  * **Bằng chứng xã hội:** Feedback từ khách hàng thực tế.
  * **CTA:** Khám phá sản phẩm.

### 3.2 Sản Phẩm (Product — Landing Page bán hàng)
* **Mục tiêu:** Cung cấp đầy đủ thông tin để khách ra quyết định mua ngay trên trang.
* **Các khối (Blocks):**
  1. **Hero:** Hình sản phẩm, giá bán, USP nổi bật, rating, CTA "Mua ngay".
  2. **Thành phần trực quan:** Hình ảnh nguyên liệu bao quanh ly Protein + triết lý "Từ nguyên liệu thật đến một ly dinh dưỡng".
  3. **Thành phần nổi bật:** 6 nhóm dạng card lớn: Protein thực vật, Ngũ cốc, Các loại hạt, Rau củ & trái cây, Chất xơ, Vitamin & Khoáng chất.
  4. **Công thức dinh dưỡng:** Infographic kết hợp nguyên liệu + Nutrition Facts.
  5. **Đối tượng sử dụng:** Người tập Gym, Yoga/Pilates, Eat Clean, ăn chay hiện đại, dân văn phòng.
  6. **Hướng dẫn sử dụng:** Cách pha, thời điểm dùng tốt nhất.
  7. **FAQ:** Các câu hỏi thường gặp về sản phẩm.
  8. **CTA cuối trang:** Mua ngay.
  * *Lưu ý:* Cần xác nhận lại với khách có block nào bị thiếu không (ví dụ: phần đánh giá/review chi tiết sản phẩm - tương ứng block 2.7 bị thiếu trong bản gốc).

### 3.3 Giỏ Hàng (Cart)
* **Mục tiêu:** Cho khách xem lại đơn hàng trước khi thanh toán.
* **Chức năng chính:**
  * Danh sách sản phẩm (hình ảnh, giá, số lượng có thể chỉnh, xóa sản phẩm).
  * Mã giảm giá (voucher).
  * Tạm tính, phí vận chuyển ước tính, tổng thanh toán.
  * CTA: Đi đến Thanh toán.
  * ⚠️ **Cần lưu ý khi triển khai:** mục 1 của tài liệu này ghi rõ Nutein là "E-commerce 1 sản phẩm chủ lực" (single-SKU), nên "Danh sách sản phẩm" ở trên thực chất là **1 dòng hàng duy nhất** (sản phẩm Nutein) + số lượng chỉnh được — không phải giỏ hàng nhiều sản phẩm khác nhau như e-commerce đa mặt hàng thông thường. Nếu có gói/combo (hộp 1/3/6 hũ...), đó là **variant** của cùng 1 sản phẩm. Xem `docs/state-management.md` mục 7 để biết shape state cụ thể.

### 3.4 Thanh Toán (Checkout)
* **Mục tiêu:** Tối ưu trải nghiệm điền thông tin, tăng tỷ lệ chuyển đổi.
* **Cấu trúc dữ liệu nhập:**
  * **Thông tin người mua:** Họ tên, SĐT, Email, Địa chỉ (Tỉnh/Quận/Phường), Ghi chú đơn hàng.
  * **Phương thức giao hàng:** Tiêu chuẩn / Nhanh.
  * **Phương thức thanh toán:** COD (thanh toán khi nhận hàng), Chuyển khoản ngân hàng, Ví điện tử.
  * **Xác nhận đơn hàng:** Sản phẩm, số lượng, giá, phí ship, voucher áp dụng, tổng tiền.
  * **CTA:** Đặt hàng ngay.

### 3.5 Khám Phá (Blog & Recipes)
* **Mục tiêu:** Xây dựng chuyên môn về sức khoẻ, hỗ trợ SEO, tăng thời gian ở lại trang (time-on-site).
* **Chuyên mục bài viết:**
  * **Công thức (Recipes):** Smoothie Protein, Overnight Oats, Protein Bowl, Pancake Protein, Granola Bowl, Latte ngũ cốc, Bữa sáng 5 phút.
    * *Bộ lọc:* Bữa sáng / Sau tập luyện / Ăn nhẹ / Eat Clean / Thuần chay.
  * **Protein:** Protein thực vật là gì? · So sánh Protein thực vật vs động vật · Khi nào nên bổ sung? · Vai trò trong chế độ ăn.
  * **Healthy Lifestyle:** Bữa phụ lành mạnh · Eat Clean · Meal Prep · Xây dựng lối sống lành mạnh.
  * **Dinh dưỡng:** Bổ sung đạm cho người ăn chay · Dinh dưỡng cho người tập luyện · Vai trò chất xơ · Vitamin & khoáng chất · Cân bằng dinh dưỡng.
* **Giao diện:** Thanh tìm kiếm, Bộ lọc theo chủ đề, Bài viết nổi bật, Bài viết mới nhất, Công thức yêu thích, và nút kêu gọi hành động "Khám phá Protein Nutein" ở cuối mỗi bài.

### 3.6 Về Nutein (About Story)
* **Mục tiêu:** Xây dựng niềm tin, kể câu chuyện thương hiệu & xuất xứ.
* **Nội dung chính:**
  * Câu chuyện thương hiệu, Triết lý sản phẩm.
  * Quy trình lựa chọn nguyên liệu sạch, Quy trình sản xuất an toàn.
  * Cam kết chất lượng, Chứng nhận (nếu có).
  * Tầm nhìn & Sứ mệnh.

### 3.7 Liên Hệ (Contact)
* **Thông tin liên kết:** Hotline, Email, Fanpage, TikTok, Shopee.
* **Chức năng:** Form gửi tin nhắn liên hệ trực tuyến, Bản đồ đường đi (Google Maps).

### 3.8 Chính Sách (Policies)
* **Mục tiêu:** Đáp ứng điều kiện pháp lý TMĐT của Bộ Công Thương.
* **Các trang:** Giao hàng · Đổi trả · Bảo mật · Điều khoản sử dụng · Thanh toán. (Các trang này chỉ truy cập qua liên kết dưới Footer).

### 3.9 Tài Khoản Khách Hàng (Customer Account Portal)
* **Mục tiêu:** Quản lý thông tin đơn hàng cá nhân, kích thích tỷ lệ mua hàng lặp lại.
* **Chức năng:**
  * Đăng ký / Đăng nhập / Quên mật khẩu.
  * Thông tin cá nhân, Số điện thoại, Sổ địa chỉ nhận hàng.
  * Lịch sử đơn hàng, Theo dõi trạng thái đơn hàng (Đang xử lý, Đang giao, Thành công).
  * Danh sách yêu thích (Wishlist). ⚠️ Xem cảnh báo ở mục 2, dòng 15 — cần xác nhận lại phạm vi thực tế của tính năng này trước khi triển khai.

### 3.10 Xác Nhận Đặt Hàng Thành Công (Order Success)
* **Mục tiêu:** Xác nhận đơn hàng, gửi lời cảm ơn và giữ chân người dùng tiếp tục đọc blog/công thức.
* **Nội dung:**
  * Lời cảm ơn, Mã đơn hàng cụ thể.
  * Thông tin giao hàng của khách hàng, Thời gian giao hàng dự kiến.
  * **CTA phụ:** Tiếp tục mua sắm · Xem công thức chế biến · Khám phá Blog.

---

## 4. Bố Cục Chân Trang (Footer)
Hiển thị ở chân tất cả các trang trên website:
* **Thương hiệu:** Logo Nutein kèm mô tả ngắn gọn về định vị.
* **Liên kết nhanh:** Trang chủ, Sản phẩm, Khám phá, Về Nutein, Liên hệ.
* **Hỗ trợ khách hàng:** Liên kết tới các trang Chính sách.
* **Kết nối:** Hotline, Email, các icon Mạng xã hội (Fanpage, TikTok, Shopee).
* **Thanh toán & Vận chuyển:** Biểu tượng phương thức thanh toán và các đơn vị giao hàng đối tác.
* **Chứng nhận:** Logo Đăng ký Bộ Công Thương (liên kết xác thực) và chứng nhận chất lượng (ISO, FDA,... nếu có).

---

## 5. Quy Chuẩn UX/UI Quan Trọng
1. **Tinh gọn Menu điều hướng:** Các trang phụ như Giỏ hàng chi tiết, Thanh toán, Thành công, Chính sách không đưa vào menu chính để tránh phân tâm người dùng. Menu chính chỉ giữ các trang dẫn hướng chính.
2. **Landing Page bán hàng hiệu năng cao:** Trang `/product` đóng vai trò Landing Page chuyển đổi chính. Cần tối ưu tải trang cực nhanh, hình ảnh sản phẩm chất lượng cao, thông điệp USP rõ ràng ngay tại phần đầu trang (Hero Section).
3. **Responsive Design:** Thiết kế tương thích hoàn hảo trên các thiết bị di động (Mobile First), vì tỷ lệ khách hàng mua sắm Healthy Lifestyle qua điện thoại chiếm >80%.

---

## 6. Đặc Tả Vai Trò Người Dùng & Khu Vực Quản Trị (User / Staff / Admin)

> Nguồn: bổ sung từ `TÀI LIỆU YÊU CẦU WEBSITE — NUTEIN (1).docx` (mục 7), đối chiếu với schema đã có ở `supabase/migrations/20260718000000_init_schema.sql`.

Hệ thống có 3 role: **User** (khách hàng — đã đặc tả đủ ở Mục 2–3), **Staff** (nhân viên vận hành), **Admin** (quản trị cấp cao). Khu vực Staff/Admin nằm ngoài menu công khai, không public, yêu cầu đăng nhập bằng tài khoản có role tương ứng.

**Nguyên tắc quyền hạn:**
- User: chỉ xem/thao tác dữ liệu của chính mình (giỏ hàng, đơn hàng, địa chỉ, wishlist, đánh giá đã viết) — không vào được khu vực quản trị.
- Staff: vận hành hàng ngày — đơn hàng, sản phẩm (SKU/variant, không phải catalog đa sản phẩm — xem ⚠️ ở Mục 1), coupon, blog, nội dung tĩnh, hộp thư liên hệ.
- Admin: kế thừa toàn bộ quyền Staff + quản lý người dùng (đổi role, khóa/mở khóa) + xem audit log.

> ⚠️ **Đã sẵn sàng ở tầng backend, chưa có ở tầng UI/route:** `Role` enum (`USER`/`STAFF`/`ADMIN`), RLS policy `"Staff/Admin manage products/coupons/orders/blog_posts/static_pages"`, `"Admin can update any profile"`, `"Only admin can view audit log"` đã tồn tại trong DB; JWT (`features/auth/services/jwt.service.ts`) đã có claim `role`. **Chưa có** bất kỳ route `app/admin/**` hay `app/api/admin/**` nào — toàn bộ bảng dưới đây đang ở trạng thái ⏳ (chưa triển khai).

### 6.1 Staff — Trang vận hành (S1–S8)

| # | Trạng thái | Trang | Mục tiêu | Route Path | Next.js File Path | Ghi chú |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| S1 | ⏳ | Đăng nhập quản trị | Xác thực nhân viên | `/admin/login` | `app/admin/login/page.tsx` | Form login riêng biệt với `AuthModal.tsx` của khách hàng — không tái dùng |
| S2 | ⏳ | Dashboard tổng quan | Nắm nhanh tình hình vận hành | `/admin` | `app/admin/page.tsx` | Đơn mới, đơn cần xử lý, tin nhắn liên hệ chưa đọc, sản phẩm sắp hết hàng |
| S3 | ⏳ | Quản lý đơn hàng | Xử lý đơn từ đặt tới giao xong | `/admin/orders`, `/admin/orders/[id]` | `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx` | Lọc theo trạng thái/ngày, đổi trạng thái (Chờ xử lý → Đang xử lý → Đang giao → Đã giao/Hủy/Trả hàng), lịch sử đổi trạng thái (`order_status_logs` đã có) |
| S4 | ⏳ | Quản lý sản phẩm | Cập nhật thông tin bán hàng | `/admin/products` | `app/admin/products/page.tsx` | ⚠️ Single-SKU: quản lý **SKU/variant** (hương vị/dung tích) của 1 sản phẩm Nutein, không phải catalog đa sản phẩm |
| S5 | ⏳ | Quản lý coupon | Tạo chương trình khuyến mãi | `/admin/coupons` | `app/admin/coupons/page.tsx` | Tạo/sửa/tắt, % hoặc số tiền giảm, giới hạn lượt dùng, ngày hết hạn |
| S6 | ⏳ | Quản lý Blog | Sản xuất nội dung Khám phá | `/admin/blog`, `/admin/blog/[id]` | `app/admin/blog/page.tsx`, `app/admin/blog/[id]/page.tsx` | Soạn thảo, chọn chuyên mục/tag, lưu nháp hoặc đăng công khai |
| S7 | ⏳ | Quản lý nội dung tĩnh | Cập nhật nội dung ít thay đổi | `/admin/content/[slug]` | `app/admin/content/[slug]/page.tsx` | 5 trang Chính sách + trang Về Nutein qua CMS, không cần dev sửa code |
| S8 | ⏳ | Hộp thư Liên hệ | Chăm sóc khách qua form liên hệ | `/admin/messages` | `app/admin/messages/page.tsx` | Đánh dấu đã đọc/đã xử lý, ghi chú nội bộ (`contact_messages` đã có) |

### 6.2 Admin — Trang độc quyền (kế thừa toàn bộ S2–S8 + A1–A2)

| # | Trạng thái | Trang | Mục tiêu | Route Path | Next.js File Path | Ghi chú |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| A1 | ⏳ | Quản lý người dùng | Quản lý nhân sự + tài khoản khách | `/admin/users` | `app/admin/users/page.tsx` | Tìm/lọc theo role, thăng/hạ cấp role (User↔Staff↔Admin), khóa/mở khóa tài khoản |
| A2 | ⏳ | Nhật ký hệ thống (Audit Log) | Giám sát thay đổi dữ liệu quan trọng | `/admin/audit-log` | `app/admin/audit-log/page.tsx` | Lọc theo người thực hiện/thời gian/loại thao tác — bảng `audit_log` + RLS đã có sẵn |

### 6.3 Bảng tổng hợp quyền hạn

| Chức năng | User | Staff | Admin |
| :--- | :---: | :---: | :---: |
| Mua hàng, quản lý tài khoản của chính mình | ✅ | – | – |
| Đổi trạng thái đơn hàng | ❌ | ✅ | ✅ |
| Sửa giá / tồn kho sản phẩm | ❌ | ✅ | ✅ |
| Tạo / sửa mã giảm giá | ❌ | ✅ | ✅ |
| Đăng / sửa bài Blog | ❌ | ✅ | ✅ |
| Sửa nội dung Chính sách / Về Nutein | ❌ | ✅ | ✅ |
| Xem & xử lý form Liên hệ | ❌ | ✅ | ✅ |
| Quản lý tài khoản người dùng khác (đổi role) | ❌ | ❌ | ✅ |
| Xem Audit Log | ❌ | ❌ | ✅ |

> Khu vực quản trị nên tách route riêng khỏi `(marketing)`/`(account)` (ví dụ `app/admin/` với `layout.tsx` guard role STAFF/ADMIN riêng), giao diện tối giản, tập trung bảng dữ liệu/form — không cần đầu tư visual như trang User-facing.

### 6.4 Đặc tả API quản trị (đề xuất — chưa triển khai, chưa có code)

Chưa có route nào trong `app/api/admin/**` tồn tại — đây là spec để dùng làm checklist khi bắt đầu code. Mọi route theo đúng convention hiện có trong `app/api/**`:
- Bọc `withErrorHandler` (`src/middlewares/error-handler.middleware.ts`), trả `ApiResponse<T>` qua `successResponse`/`createdResponse`/`errorResponse` (`src/api/response.ts`).
- Guard 2 bước đã có sẵn, chỉ cần gọi, không cần viết mới: `const user = await authenticate(req)` rồi `requireRole(user, "STAFF", "ADMIN")` (hoặc chỉ `"ADMIN"` với A1/A2) — xem `src/middlewares/authenticate.middlware.ts:36`.
- Lỗi chuẩn hoá qua `AppError`/`NotFoundError`/`ValidationError`/`ForbiddenError` (`src/errors/app.error.ts`) — 401 chưa đăng nhập/token hết hạn, 403 sai role, 404 không tìm thấy record, 400 Zod parse fail.

| Method | Endpoint | Phục vụ trang | Role |
| :--- | :--- | :--- | :---: |
| GET | `/api/admin/dashboard` | S2 | STAFF, ADMIN |
| GET | `/api/admin/orders`, `/api/admin/orders/[id]` | S3 | STAFF, ADMIN |
| PATCH | `/api/admin/orders/[id]/status` | S3 | STAFF, ADMIN |
| GET, POST | `/api/admin/products` | S4 | STAFF, ADMIN |
| PATCH | `/api/admin/products/[id]` | S4 | STAFF, ADMIN |
| GET, POST | `/api/admin/coupons` | S5 | STAFF, ADMIN |
| PATCH, DELETE | `/api/admin/coupons/[id]` | S5 | STAFF, ADMIN |
| GET, POST | `/api/admin/blog` | S6 | STAFF, ADMIN |
| PATCH, DELETE | `/api/admin/blog/[id]` | S6 | STAFF, ADMIN |
| GET, PATCH | `/api/admin/static-pages/[slug]` | S7 | STAFF, ADMIN |
| GET | `/api/admin/contact-messages` | S8 | STAFF, ADMIN |
| PATCH | `/api/admin/contact-messages/[id]` | S8 | STAFF, ADMIN |
| GET | `/api/admin/users` | A1 | ADMIN |
| PATCH | `/api/admin/users/[id]/role`, `/api/admin/users/[id]/status` | A1 | ADMIN |
| GET | `/api/admin/audit-log` | A2 | ADMIN |

Chi tiết request/response theo cột thật của schema (`supabase/migrations/20260718000000_init_schema.sql`):

**S2 — Dashboard**
- `GET /api/admin/dashboard` → `data: { newOrders: number; pendingOrders: number; unreadMessages: number; lowStockProducts: { id, sku, name, stock }[] }`

**S3 — Đơn hàng** (`orders`, `order_items`, `order_status_logs`)
- `GET /api/admin/orders?status=&from=&to=&page=&limit=` → `data: Order[]`, `meta: { page, limit, total }`. `Order` = `{ id, user_id, status, payment_method, payment_status, shipping_method, total_price, shipping_fee, discount_amount, final_price, created_at }`.
- `GET /api/admin/orders/[id]` → order đầy đủ + `items: OrderItem[]` + `shipping_address` (JSONB snapshot) + `statusLogs: OrderStatusLog[]`.
- `PATCH /api/admin/orders/[id]/status` — body `{ status: OrderStatus; note?: string }` (`OrderStatus` = `PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED|RETURNED`). Service phải validate transition hợp lệ (không cho nhảy `DELIVERED` → `PENDING`), update `orders.status` + insert `order_status_logs` với `changed_by = user.userId`. 404 nếu order không tồn tại.

**S4 — Sản phẩm** ⚠️ single-SKU — đây là quản lý **SKU/variant** của 1 sản phẩm Nutein (`flavor`/`size`), không phải catalog đa sản phẩm.
- `GET /api/admin/products?includeDeleted=` → toàn bộ SKU kể cả `is_deleted=true` nếu có query — khác `GET /api/product` public (chỉ SKU active).
- `POST /api/admin/products` — tạo SKU/variant mới, body khớp cột `products` (`sku, name, slug, description?, flavor?, size?, price, stock, images?, nutrition_facts?, ingredients?`).
- `PATCH /api/admin/products/[id]` — partial update (giá, tồn kho, nội dung, ảnh, hoặc `is_deleted: true` để soft-delete SKU).

**S5 — Coupon**
- `GET /api/admin/coupons?active=` → list.
- `POST /api/admin/coupons` — body `{ code, discount_type: "FIXED"|"PERCENTAGE", discount, min_order_value?, usage_limit?, expires_at? }`.
- `PATCH /api/admin/coupons/[id]` — partial + toggle `is_active`.
- `DELETE /api/admin/coupons/[id]` — ⚠️ `orders.coupon_id` reference `coupons(id)` không có `ON DELETE CASCADE/SET NULL`, nên hard-delete sẽ lỗi FK nếu coupon đã từng được dùng trong đơn. Khuyến nghị dùng `PATCH { is_active: false }` (soft-delete) làm hành vi chính; DELETE thật chỉ nên cho phép khi `used_count = 0`.

**S6 — Blog**
- `GET /api/admin/blog?category=&published=&q=` → list kể cả bản nháp (khác `GET /api/blog` public chỉ `is_published=true`).
- `POST /api/admin/blog` — body khớp cột `blog_posts` (`category, tags[], title, slug, thumbnail?, excerpt?, content, author?, is_published?`).
- `PATCH /api/admin/blog/[id]` — partial; khi set `is_published: true` mà `published_at` đang null thì service tự set `published_at = now()`.
- `DELETE /api/admin/blog/[id]`.

**S7 — Nội dung tĩnh (CMS)**
- `GET /api/admin/static-pages/[slug]` → `{ slug, title, content, updated_at }`.
- `PATCH /api/admin/static-pages/[slug]` — body `{ title?, content }`. Không có `POST` — 5 trang Chính sách + Về Nutein seed sẵn qua migration, endpoint này chỉ sửa nội dung record có sẵn.

**S8 — Hộp thư liên hệ**
- `GET /api/admin/contact-messages?isRead=&page=&limit=` → list `{ id, name, email, phone, message, is_read, handled_by, created_at }`.
- `PATCH /api/admin/contact-messages/[id]` — body `{ is_read?: boolean }`, tự set `handled_by = user.userId`. ⚠️ **Gap cần xác nhận:** docx yêu cầu "ghi chú nội bộ" nhưng bảng `contact_messages` hiện **không có cột note** — cần thêm migration (`ALTER TABLE contact_messages ADD COLUMN internal_note TEXT`) nếu giữ yêu cầu này.

**A1 — Quản lý người dùng**
- `GET /api/admin/users?role=&q=&page=&limit=` → `{ id, email, name, phone, role, is_deleted, created_at }[]`.
- `PATCH /api/admin/users/[id]/role` — body `{ role: "USER"|"STAFF"|"ADMIN" }`. Service phải chặn admin tự hạ role chính mình (RLS không chặn việc này, phải validate ở tầng service).
- `PATCH /api/admin/users/[id]/status` — body `{ is_deleted: boolean }` (khóa = `true`). ⚠️ **Cần xác nhận:** cột `is_deleted` hiện dùng chung cho cả "xóa" và ý định "khóa tài khoản" của A1 — nếu 2 khái niệm cần tách biệt (khóa tạm thời khác xóa vĩnh viễn), cần thêm cột riêng (VD: `is_locked`) qua migration mới.

**A2 — Audit log**
- `GET /api/admin/audit-log?tableName=&userId=&action=&from=&to=&page=&limit=` → `{ id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at }[]`. `action` = `CREATE|UPDATE|DELETE|LOGIN_SUCCESS|LOGOUT|TOKEN_REFRESH|TOKEN_REUSE_DETECTED`.
