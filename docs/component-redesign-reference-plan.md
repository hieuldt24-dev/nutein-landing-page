# Nutein — Component & Visual Design Redesign theo Reference (drinkjoyrush.com) — Plan v2

> Bản v2 — viết lại hoàn toàn sau khi mở trực tiếp `https://drinkjoyrush.com/` (browser + DevTools CDP) để đo font/màu/spacing thật và chụp từng section, thay vì chỉ mô tả chung. Mục tiêu: liệt kê **chính xác từng pattern UI/component/animation** của reference và **map 1-1 sang Nutein**, giữ nguyên toàn bộ flow section/feature/content gốc của Nutein (không đổi thứ tự, không đổi nghiệp vụ single-SKU).
>
> Bản v1 (`docs/component-redesign-reference-plan.md` cũ) mô tả quá chung ("heading outline cỡ đại", "card đè mép ảnh"...) nên Cursor Agent implement không đủ sát reference. Bản v2 này thay thế hoàn toàn — dùng làm nguồn duy nhất để triển khai từ đầu, code cũ đã viết thử trong phiên trước **sẽ được viết lại theo đúng chi tiết ở đây**, không giữ nguyên.

## 0. Ràng buộc bắt buộc (không đổi)

- **Giữ 100% flow section hiện có của Nutein**: Navbar → Hero → IntroSection (thành phần dinh dưỡng) → DifferentiatorsSection (vì sao khác biệt) → TargetAudienceSection (dành cho ai) → BenefitsSection (lợi ích) → TestimonialsSection → BottomCtaSection → Footer. Không thêm/xoá/đổi thứ tự section.
- **Giữ 100% nội dung/copy/số liệu hiện có** của từng section — chỉ đổi cách trình bày (layout, typography, màu, ảnh/khối trang trí, animation).
- **Single-SKU**: Nutein chỉ có 1 sản phẩm (không có product grid nhiều SKU như reference — reference có drinks + gummies nhiều vị). Pattern "product grid 4-5 card ngang + QUICK ADD" của reference **không áp dụng dạng nhiều sản phẩm** — chỉ mượn *component-level* (card sản phẩm, nút QUICK ADD, mũi tên carousel) cho các chỗ hợp lý (ví dụ IntroSection có 4 "thành phần dinh dưỡng" — có thể trình bày dạng carousel-card giống product grid mà không cần thêm SKU giả).
- **Không có ảnh lifestyle người thật** trong `public/images/` (chỉ có `herosection.png` — ảnh sản phẩm cắt nền + 3 SVG logo/favicon). Mọi chỗ reference dùng ảnh lifestyle full-bleed → Nutein thay bằng: (a) ảnh sản phẩm phóng to đặt làm điểm nhấn, hoặc (b) khối màu/gradient lớn theo palette Nutein, hoặc (c) để sẵn `<Image>` placeholder đúng vị trí/kích thước để cắm ảnh thật sau khi có.
- Không tạo `.env`, không gọi API thật — mock data như đã quy định ở `docs/frontend-style-overhaul.md` mục 0.

## 1. Đo đạc thực tế trên reference (qua DevTools CDP — không suy đoán từ ảnh)

| Thuộc tính | Giá trị đo được |
|---|---|
| Font heading (`h1`, `h2`...) | `Fedro-Semibold`, `font-weight: 700`, `text-transform: uppercase` |
| H1 (Hero headline) | `font-size: 120px`, `letter-spacing: -4.8px` (≈ `-0.04em`), màu `rgb(251,246,237)` (trắng ngà) |
| H2 (section heading, ví dụ "clean, functional...") | `font-size: 66.7px`, `letter-spacing: -2.67px`, màu cam `rgb(254,67,26)` |
| Nav (`header`) | `position: absolute`, `background: transparent` — nổi hoàn toàn trong suốt trên Hero, không đổi khi cuộn qua các section khác (mỗi section tự có nền riêng, nav luôn trong suốt + chữ đủ tương phản vì có lớp overlay tối trên ảnh) |
| Footer background | `rgb(255,157,211)` → thực chất là tông **hồng-mận/dusty rose** (không phải tím thuần) |
| Nút hành động nổi (floating action buttons) | 2 nút tròn cố định **góc dưới-phải màn hình, xuất hiện ở MỌI section** (không chỉ Hero) — 1 nút cam icon "quả/order", 1 nút icon giỏ hàng, nền trắng/kem, đổ bóng nhẹ |

## 2. Component/pattern chi tiết theo từng section reference (chụp ảnh thật) → map sang Nutein

### 2.1 Marquee ticker (trên cùng, trước nav)

**Reference:** nền hồng pastel, chữ đen bold uppercase, cách nhau bằng dấu `✦`, chạy ngang vô hạn liên tục — nội dung: "ALWAYS DELICIOUS · JOYFULLY BOLD · EFFORTLESSLY STYLISH".

**Nutein (đã có, giữ nguyên cơ chế, chỉ chỉnh màu/font):**
- Đổi nền ticker từ gradient caramel hiện tại → **nền solid 1 màu** giống reference (thử `bg-primary` solid, không gradient) để giống pattern "1 màu pastel phẳng" hơn là gradient.
- Chữ trong ticker: hiện đang `font-bold` — cần **thêm dấu phân cách `✦`** giữa các item (đã có ở 1 phiên bản MarqueeTicker — xác nhận lại còn dùng `✦` hay đã đổi sang `•`, đồng bộ về `✦` cho đúng reference).
- Giữ nguyên nội dung USP tiếng Việt hiện có ("100% Protein Thực Vật · Non-GMO · Organic...").

### 2.2 Navbar

**Reference:** `position: absolute` (không phải `fixed`/`sticky` theo nghĩa che khuất — nó nằm tuyệt đối trong Hero section, khi cuộn qua sẽ cuộn theo luôn vì Hero là section đầu, KHÔNG dính lại màn hình khi cuộn tiếp — đây khác với suy đoán "sticky nổi khi cuộn" ở bản v1). Logo chữ script/cursive màu trắng giữa nav; trái: "PRODUCTS ▾", "LEARN ▾" (text link, không viền); phải: "ACCOUNT" (text + icon người) và nút pill "CART" (nền trắng, icon giỏ, viền pill).

**Nutein — quyết định lại cho đúng:**
- **Sửa lại quyết định "fixed + scroll solid" đã code ở bản v1** → đổi thành: Navbar là **phần tử đầu tiên bên trong Hero** (không `fixed` toàn trang), `position: absolute top-0` **chỉ trong phạm vi Hero**, sau khi cuộn qua Hero, Navbar cuộn theo bình thường (không dính lại). Điều này khớp đúng hành vi reference đo được, và cũng đơn giản hơn, tránh bug layout do `fixed` gây lệch khoảng trống đã gặp.
- Giữ nguyên nav links hiện tại (Sản phẩm/Về chúng tôi/Kiến thức/Liên hệ), đổi nút "Giỏ hàng"/"Tài khoản" từ icon-only sang **pill trắng có icon + label** giống reference (ví dụ nút giỏ hàng dạng pill nền trắng bo tròn).

### 2.3 Hero

**Reference:** Ảnh lifestyle full-bleed (người cầm lon, cận cảnh) chiếm 100% viewport height. Headline uppercase cực lớn (120px), 2 dòng, màu trắng ngà, đè trực tiếp lên ảnh (không có nền/overlay riêng cho chữ — chữ đủ dày để đọc được trên ảnh nhờ contrast tự nhiên của ảnh tối). Subtext 3 dòng nhỏ, uppercase, letter-spacing rộng, màu trắng, căn giữa. CTA: pill trắng "SHOP NOW" (chữ đen) + nút tròn viền đen có icon mũi tên chéo (↗), đặt sát cạnh nhau. Góc dưới-phải: 2 nút tròn nổi (persistent floating action buttons — xem mục 1).

**Nutein (đã có ảnh sản phẩm phóng to thay ảnh lifestyle — giữ hướng này, chỉnh chi tiết):**
- Headline: tăng `letter-spacing` âm hơn nữa cho khớp cảm giác "condensed uppercase" (hiện Quicksand không uppercase theo mặc định — **thêm `uppercase`** cho headline Hero để giống reference, đây là thay đổi lớn nhất còn thiếu ở bản v1).
- Icon mũi tên cạnh CTA: đổi từ `ArrowRight` (mũi tên ngang) → **mũi tên chéo lên (↗, `ArrowUpRight` từ lucide-react)** giống reference, viền tròn đen/ink dày hơn (2px).
- Subtext: đổi thành **uppercase, letter-spacing rộng** (`tracking-[0.05em] uppercase text-xs`) thay vì subtext thường hiện tại — khớp pattern reference.
- **Thêm 2 nút tròn nổi persistent (FloatingActionButtons)** ở góc dưới-phải, hiển thị ở TẤT CẢ section (không chỉ Hero) — component mới `components/ui/FloatingActionDock.tsx`, `position: fixed bottom-6 right-6 z-40`, 2 nút: 1 nút mở nhanh trang sản phẩm (icon lá/hạt Nutein), 1 nút mở AuthModal hoặc giỏ hàng info (vì single-SKU không có cart phức tạp — có thể dùng nút này để mở nhanh khối "Mua ngay" hoặc scroll to `#san-pham`).

### 2.4 Product-card carousel pattern ("DRINKS AS DELICIOUS AS THEY ARE DELIGHTFUL")

**Reference:** Heading trái + 2 nút mũi tên tròn carousel phải (prev/next) trên cùng 1 hàng. Dưới là hàng ngang các thẻ sản phẩm: ảnh lon nổi trên nền trong suốt, tên sản phẩm 2 dòng bold, nút "QUICK ADD" (pill viền, chữ nhỏ uppercase) + nút tròn mũi tên chéo cạnh nhau.

**Nutein — áp dụng cho `IntroSection` (4 nhóm dưỡng chất) thay vì product SKU:**
- Đổi `IntroSection` từ grid 4 cột cố định → **hàng ngang có thể kéo/carousel** (dùng CSS `overflow-x-auto snap-x` đơn giản, không cần lib carousel riêng) trên mobile; desktop vẫn hiển thị đủ 4 card trong 1 hàng vì chỉ có 4 item.
- Heading "Một ly Protein Nutein có gì?" đặt trái, thêm 2 nút mũi tên tròn phải (trang trí — vì chỉ có 4 item vừa màn hình desktop, 2 nút này chủ yếu có ý nghĩa trên mobile khi carousel cần điều hướng) — nếu không cần thiết về UX có thể bỏ, nhưng nên giữ vì đúng pattern reference và tạo cảm giác "sản phẩm/carousel" giống reference.
- Mỗi card ingredient: đổi bố cục thành ảnh/icon lớn phía trên + tên dưỡng chất bold 1-2 dòng + (không có nút "QUICK ADD" vì không phải sản phẩm để mua riêng — thay bằng badge nhỏ dạng pill hiển thị định lượng, ví dụ "20g" nổi trên góc ảnh/icon, giữ được cảm giác "card sản phẩm" mà không sai lệch nghiệp vụ).

### 2.5 Brand/About section ("CLEAN, FUNCTIONAL, FEEL GOOD...")

**Reference:** Heading lớn top (2 dòng, màu tím-navy đậm, uppercase). Bên trái: cụm 3 ảnh lifestyle cắt theo khung **bèo/cloud** (scallop-edge), xếp lệch chồng lên nhau, mỗi khung có viền màu cam mảnh. Bên phải: đoạn brand statement (serif, không uppercase, đọc như quote) + nút "ABOUT US" (pill viền) + sao rating + link "170 REVIEWS" gạch chân.

**Nutein — áp dụng cho `DifferentiatorsSection`:**
- Đây chính là section "triết lý phát triển" hiện tại — đổi bố cục: **heading 2 dòng lớn top** (thay vì heading trái + list hàng ngang đã code ở v1), dưới heading chia 2 cột: trái là **cụm khung `SparkleFrame`** (đã có component, dùng khung sao 4 cánh thay khung cloud — đúng theo quyết định motif ở `frontend-style-overhaul.md` mục 1) chứa **ảnh sản phẩm hiện có** (vì chưa có ảnh lifestyle, dùng `herosection.png` cắt/crop nhiều góc khác nhau tạm thời, hoặc dùng khối màu + icon lớn trong khung sparkle thay ảnh); phải là đoạn mô tả + rating/badge.
- 3 mục "100% Nguyên Liệu Thật / Enzyme Hấp Thu Nhanh / Canh Tác Hữu Cơ" (hiện đang là list hàng ngang đánh số ở v1) → **giữ cách trình bày list đánh số này ở section khác** (nó thực ra khớp hơn với 1 section khác của reference — xem 2.7 "milestone rows"), không dùng ở đây.

### 2.6 Full-bleed mood section ("LIFE IS A LOT. JOY SHOULD BE TOO.")

**Reference:** Ảnh full-bleed (trời xanh, 3 người), heading trắng bold centered đè lên ảnh, subtext trắng nhỏ dưới heading. Phía dưới, đè lên mép dưới ảnh: **4 card trắng bo góc, viền trái màu cam đậm (4px), xếp hàng ngang**, mỗi card: heading bold nhỏ + đoạn mô tả.

**Nutein — áp dụng cho `TargetAudienceSection`:**
- Đổi nền từ card-grid trắng hiện tại → **khối màu lớn full-bleed** (dùng gradient caramel/ink đậm thay ảnh vì chưa có ảnh lifestyle) làm nền, heading trắng centered đè lên (thay vì outline heading màu ink hiện tại).
- 4 persona card: đổi từ card có top-border-bar-ngang-đầy-đủ-màu → **viền trái (`border-l-4`) màu accent** giống reference, nền card trắng đặt đè lên phần dưới khối màu nền (dùng `-mt-*` để card "cắn" lên nền, tạo hiệu ứng "đè mép" đúng reference).

### 2.7 "WHERE FUNCTION MEETS FUN" — cloud ingredient badges

**Reference:** Nền cream, heading + subtext + nút "LEARN MORE" centered top. Dưới là các lon/gói sản phẩm xếp fan (nghiêng, chồng mép), quanh đó là **các khung nhỏ hình cloud (viền đôi, bo tròn kiểu bong bóng)** chứa text ngắn kiểu "L-Tyrosine for focus & lift" — mỗi khung đặt lệch vị trí khác nhau quanh cụm sản phẩm.

**Nutein — áp dụng cho `BenefitsSection`:**
- Đổi infographic card hiện tại (1 card trắng bo góc chứa list "Cam kết 4 Không") → **cụm ảnh sản phẩm (`herosection.png`) ở giữa** + **4 khung cloud/sparkle nhỏ quanh ảnh** mỗi khung 1 dòng benefit ngắn (rút gọn từ 4 benefit hiện có: "Nhẹ bụng", "Bảo vệ tim mạch", "Trẻ hóa da", "Bền vững môi trường") — dùng lại `SparkleFrame` (đã có, khung sao) thu nhỏ làm "cloud badge" thay vì cloud thật, giữ đúng motif riêng của Nutein.
- Cột text 4 benefit chi tiết (hiện tại) giữ nguyên bên cạnh, không xoá nội dung — chỉ thêm cụm ảnh+cloud-badge làm điểm nhấn hình ảnh.

### 2.8 Testimonials ("Don't take our word for it")

**Reference:** Pattern giống các section khác — heading + rating tổng, card có heading nhỏ bold (tên review ngắn kiểu "Perfect way to unwind") + đoạn quote + tên người + số reviews.

**Nutein (đã code khá gần ở v1, giữ + chỉnh nhỏ):**
- Thêm heading ngắn bold cho mỗi review (hiện chỉ có đoạn quote dài) — ví dụ thêm field `headline: "Nhẹ bụng hẳn sau 1 tuần"` cho mỗi testimonial mock data, hiển thị bold phía trên đoạn quote, giống pattern reference "review có tiêu đề riêng".

### 2.9 "BUNDLE & SAVE" — banner milestone

**Reference:** Nền cam rực toàn màn hình, heading trắng lớn trái + đoạn text nhỏ, ảnh sản phẩm nghiêng 3D bên trái-dưới, bên phải: heading nhỏ "ORDER MORE. SAVE MORE. JOY MORE." + **3 dòng milestone** (icon tròn + "spend $X" + chip reward "SAVE $5"/"FREE SHIPPING").

**Nutein — áp dụng cho `BottomCtaSection`:**
- Giữ banner nền cam/caramel rực đã có, nhưng đổi bố cục từ "centered stack" hiện tại → **2 cột: trái là heading+CTA hiện có, phải là 3 dòng milestone-style** dùng lại đúng pattern list-đánh-số đã code cho Differentiators ở v1 (icon tròn + label + badge) — **đây chính là nơi phù hợp nhất để tái sử dụng pattern "3 dòng ngang có icon+badge" đã lỡ code ở Differentiators**, vì Nutein single-SKU không có mốc chi tiêu thật — thay bằng 3 mốc "cam kết" của Nutein (ví dụ: "Mua 2 hộp – Freeship", "Mua 3 hộp – Tặng túi tote", "Đăng ký định kỳ – Giảm 10%" — cần xác nhận với client có chương trình này không, xem mục 4).

### 2.10 Footer ("MORE JOY MORE OFTEN")

**Reference:** Nền hồng-mận (`rgb(255,157,211)`), heading khổng lồ tràn viền 2 bên (chữ chạm mép màn hình, bị cắt), màu nâu-đỏ đậm, đè lên là **2-3 ảnh khung cloud nhỏ** xoay nghiêng random. Form newsletter đặt phía trên heading (không phải dưới). Cột link 2 bên dưới. Cuối cùng: copyright + disclaimer pháp lý nhỏ.

**Nutein (đã có heading lớn + newsletter, cần chỉnh):**
- Đổi nền Footer từ `bg-ink` (nâu-tím đậm) → **giữ `bg-ink` cho Nutein** (không đổi sang hồng-mận — đây là màu riêng của Joy Rush, không thuộc palette Nutein đã chọn) — chỉ mượn **cấu trúc bố cục** (heading khổng lồ tràn viền, form newsletter phía trên heading) không mượn màu.
- Heading "Không bỏ lỡ ưu đãi nào từ Nutein" → tăng kích thước để **tràn/gần chạm viền 2 bên màn hội** giống reference (hiện đang `clamp(32px,5vw,56px)`, cân nhắc tăng lên `clamp(40px,7vw,90px)`).
- Thêm 2 khung `SparkleFrame` nhỏ chứa icon/ảnh (thay ảnh lifestyle cloud) đặt đè lên góc heading, xoay nghiêng nhẹ (`rotate-[-6deg]`) giống hiệu ứng "ảnh cloud nghiêng" của reference.

## 3. Component mới cần tạo thêm (`components/ui/`)

| Component | Mục đích |
|---|---|
| `FloatingActionDock.tsx` | 2 nút tròn nổi `fixed bottom-6 right-6`, hiển thị toàn site (mục 2.3) |

~~`CarouselArrows.tsx`~~, ~~`MilestoneRow.tsx`~~ — **đã loại bỏ** theo quyết định mục 4 (không cần carousel ở Intro, không có milestone ở BottomCta).

Component đã có, tiếp tục dùng: `Button`, `Badge`, `Card`, `SectionHeading`, `MarqueeTicker` (di chuyển từ Navbar → Testimonials), `StarRating`, `SparkleFrame`.

## 4. Quyết định đã xác nhận (thay cho câu hỏi mở ở bản trước)

1. **BottomCtaSection — KHÔNG có milestone/ưu đãi/shipping.** Nutein hiện chưa có chương trình ưu đãi theo số lượng mua, chưa có dịch vụ shipping riêng → **bỏ hẳn `MilestoneRow` và ý tưởng 3 mốc ở mục 2.9**. BottomCtaSection giữ nguyên bố cục banner 2-CTA đơn giản đã có (không thêm cột milestone).
2. **IntroSection — KHÔNG cần `CarouselArrows`.** Bỏ hẳn ý tưởng 2 nút mũi tên trang trí ở mục 2.4 — chỉ áp dụng phần "đổi bố cục card ảnh/icon lớn + badge định lượng", không cần carousel/arrows.
3. **Testimonials — không viết headline mới cho từng review.** Thay vào đó: **di chuyển `MarqueeTicker` (dải băng USP hiện đang nằm trên Navbar) xuống làm 1 dải trang trí trong `TestimonialsSection`** (ví dụ dải băng hiển thị số liệu/điểm nhấn đánh giá — "⭐ 4.9/5 · 50,000+ khách hàng · ..."). Navbar sau khi bỏ ticker sẽ đơn giản hơn (không còn dải USP phía trên).
4. **Ảnh trong `SparkleFrame`/cụm ảnh (Differentiators, Benefits, Footer) — dùng ảnh tạm.** User đã bổ sung `public/images/example.jpg` làm ảnh tạm dùng chung cho các khung này cho tới khi có ảnh lifestyle thật.

## 5. Thứ tự triển khai (đã xác nhận mục 4, sẵn sàng code)

1. Navbar: bỏ `MarqueeTicker` (dời xuống Testimonials), bỏ `fixed+scrolled`, chuyển về `absolute` trong phạm vi Hero (mục 2.2).
2. Tạo `FloatingActionDock`, gắn vào layout gốc (`app/layout.tsx` hoặc `app/page.tsx`) để hiện toàn site.
3. Hero: bỏ padding-top dành cho ticker cũ (vì ticker đã dời đi), thêm `uppercase` cho headline, đổi icon mũi tên → `ArrowUpRight`, subtext → uppercase tracking rộng.
4. IntroSection: đổi card ingredient sang bố cục "ảnh/icon lớn + badge định lượng" (không cần carousel arrows).
5. DifferentiatorsSection: đổi bố cục sang "heading 2 dòng top + 2 cột (SparkleFrame cluster dùng `example.jpg` / brand statement + rating)", **giữ nguyên** 3 mục list đánh số hiện tại (không chuyển đi đâu nữa vì BottomCta không cần milestone).
6. TargetAudienceSection: đổi nền sang khối màu full-bleed + heading trắng centered, card viền trái `border-l-4`, đè mép nền bằng margin âm.
7. BenefitsSection: thêm cụm ảnh (`example.jpg`) + `SparkleFrame` cloud-badge quanh ảnh.
8. TestimonialsSection: thêm `MarqueeTicker` (dải USP/số liệu đánh giá) phía trên heading hoặc giữa heading/card.
9. BottomCtaSection: giữ nguyên bố cục banner 2-CTA đã có, không thêm milestone.
10. Footer: tăng size heading, thêm 2 `SparkleFrame` nghiêng (dùng `example.jpg`) đè lên heading, fix bug `height: 0`.
11. Review lại toàn site trên desktop/mobile, đảm bảo flow/content không đổi.

## 6. Phụ lục — trạng thái code đã thử ở phiên trước (v1, sẽ bị viết lại theo plan này)

Trong phiên trước, các file sau đã được sửa theo hiểu sai/thiếu chi tiết (bản v1) — sẽ viết lại theo mục 2-5 ở trên: `HeroSection.tsx`, `Navbar.tsx`, `IntroSection.tsx`, `DifferentiatorsSection.tsx`, `TargetAudienceSection.tsx`, `BenefitsSection.tsx`, `TestimonialsSection.tsx`, `BottomCtaSection.tsx`.

2 phát hiện kỹ thuật ở phiên trước **vẫn còn giá trị, giữ nguyên fix**:
- Đã fix bug rule `h1,h2,h3,h4,h5,h6` unlayered trong `app/globals.css` đè mọi Tailwind utility về màu/line-height/letter-spacing — **giữ nguyên fix này**, không revert.
- Bug `Footer` bị `height: 0` — **chưa fix, cần điều tra khi viết lại Footer theo mục 2.10** (nghi do `app/layout.tsx` dùng `<body className="min-h-full flex flex-col">` mà `<main>` không có `flex-1`).

## 7. Todo checklist

- [x] Xác nhận 4 câu hỏi ở mục 4 với client/user
- [x] `navbar-absolute` — Đổi Navbar từ fixed sang absolute-trong-Hero, bỏ ticker (mục 2.2)
- [x] `floating-dock` — Tạo `FloatingActionDock`, gắn toàn site qua `app/layout.tsx` (mục 2.3)
- [x] `hero-uppercase` — Hero: uppercase headline, `ArrowUpRight`, subtext uppercase tracking rộng, giảm `pt` do bỏ ticker
- [x] `intro-card` — IntroSection: card ảnh/icon lớn (76px) + badge định lượng nổi góc (không cần carousel arrows)
- [x] `differentiators-cloud` — Differentiators: heading 2 dòng top + SparkleFrame cluster (`example.jpg`) + brand statement/rating, giữ nguyên list đánh số
- [x] `target-fullbleed` — TargetAudience: nền khối màu gradient ink→primary-deep full-bleed + card viền trái đè mép (margin âm)
- [x] `benefits-cloud-badge` — Benefits: cụm ảnh (`example.jpg`) + SparkleFrame cloud-badge + card cam kết đè góc
- [x] `testimonials-ticker` — Di chuyển `MarqueeTicker` (USP band) từ Navbar xuống làm dải dẫn trong Testimonials
- [x] `bottomcta-keep` — BottomCta: giữ nguyên banner 2-CTA hiện có (không milestone, không ưu đãi/shipping)
- [x] `footer-scale-sparkle` — Footer: heading tăng lên `clamp(38px,6.5vw,80px)` uppercase + 2 `SparkleFrame` nghiêng (`example.jpg`)
- [x] `footer-height-bug` — Rà soát `globals.css`/`layout.tsx`: không còn rule nào gây `height:0` sau khi đã fix bug cascade layer h1-h6 ở phiên trước; cần QA trực quan lại trên browser thật để xác nhận hết bug
- [ ] `final-review` — Review toàn site desktop/mobile trên browser thật, xác nhận flow/content không đổi (cần user hoặc phiên sau chạy `npm run dev` để verify — shell hiện không phản hồi trong phiên này)
