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
| 15 | ⏳ | **Sản phẩm yêu thích** (Wishlist) | `/account/wishlist` | `app/account/wishlist/page.tsx`| Client Component (Lấy từ localStorage/DB) |

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
  * Danh sách yêu thích (Wishlist).

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
