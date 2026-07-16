# Nutein Frontend Style Overhaul — Plan

> Tài liệu này là plan làm việc cho việc cập nhật lại front-end style của landing page Nutein. Được tạo ra trong một phiên Plan mode (chưa code). Một Cursor Agent phiên sau có thể đọc file này và thực thi trực tiếp theo các phase/todo được liệt kê ở cuối tài liệu.
>
> **Trạng thái:** Phase 0, 1, 2 đã triển khai xong (tokens, UI primitives, restyle toàn bộ section). Phase 3 (asset polish) còn thiếu sparkle SVG + ảnh lifestyle/hero thật — xem mục 6 và checklist ở mục 9.

## 0. Phạm vi & ràng buộc quan trọng

**Đây là công việc thuần Frontend/UI. Backend server và `.env` CHƯA tồn tại trong dự án ở giai đoạn này.**

- Không tạo, không yêu cầu, không giả định có file `.env`/`.env.local`. Không cấu hình `lib/env.ts`, `lib/supabase.ts`, Prisma, Redis, Cloudinary hay bất kỳ service backend nào — các dependency này có trong `package.json` theo template nhưng **ngoài phạm vi công việc này**.
- Toàn bộ dữ liệu hiển thị (sản phẩm, testimonial, USP, giá, rating...) dùng **mock data tĩnh** khai báo ngay trong component hoặc trong 1 file constants cạnh component (ví dụ `components/shared/data/testimonials.ts`) — không gọi API thật, không dùng `useSWR` với URL thật tới `app/api/**`.
- Trường hợp đặc biệt — `AuthModal.tsx` và form contact hiện tại: giữ nguyên cơ chế **mock submit** đã có (`setTimeout` giả lập, `toast` báo kết quả) khi restyle. Không nối vào API/service thật, không thêm network call mới.
- Pattern "SWR-as-store" cho **UI state** (ví dụ `useSWR("auth-modal", ...)` để mở/đóng modal — xem `docs/state-management.md` mục 3) vẫn dùng bình thường vì đây không phải network call, chỉ là cơ chế chia sẻ state phía client.
- Nếu 1 section cần "trạng thái loading" để demo UI (ví dụ skeleton), giả lập bằng `setTimeout`/`useState` cục bộ, không tạo route API mới để phục vụ việc này.
- Mục tiêu duy nhất của phase này: đúng token màu/typography theo brand Nutein, đúng bố cục/hiệu ứng học từ reference, component primitive tái sử dụng được — sẵn sàng để cắm dữ liệu thật vào khi có backend, nhưng **không code phần kết nối đó ngay bây giờ**.

## 1. Bối cảnh & phân tích

**Codebase hiện tại** (Next.js 16 App Router, Tailwind v4):
- Design tokens đã tồn tại ở `app/globals.css` (`:root` dòng 4-40) nhưng gần như không được dùng — mỗi section (`HeroSection.tsx`, `Navbar.tsx`, `Footer.tsx`...) tự khai báo lại object token riêng (ví dụ `const T = {...}` ở `components/shared/HeroSection.tsx` dòng 10-19) và hardcode hex trực tiếp trong `style={{}}`.
- Không có `@theme` Tailwind v4 nào map tới token → Tailwind utilities (`bg-primary`, `text-heading`...) chưa tồn tại, class-variance-authority/cn() cài nhưng chưa dùng.
- Chưa có `components/ui/` (shadcn chưa init) — không có Button/Card/Badge tái sử dụng, mỗi section tự vẽ UI riêng, gây trùng lặp lớn.
- Font: Quicksand (display) + Mulish (body) qua `next/font/google`, cấu hình ở `app/layout.tsx` dòng 5-17.
- `public/` chưa có brand asset thật, ảnh hero (`/images/herosection.png`) bị thiếu.
- Theo `nextjs-architecture-guide.md`, `components/ui/` là nơi quy hoạch sẵn cho shadcn/ui primitives — overhaul lần này sẽ hiện thực hoá đúng quy hoạch đó.

**Bộ nhận diện thương hiệu Nutein** (từ ảnh brand sheet do người dùng cung cấp):
- Nền chủ đạo: cream `#FFFDFD` / `#FFFDFF`.
- Màu logo được chọn (variant 3 — chữ nâu/caramel trên nền kem, **đây là variant duy nhất được dùng**): `#E2A550` — dùng làm **màu primary/brand** mới (thay `#0A9B78` xanh lá hiện tại).
- Bảng màu phụ: xanh dương nhạt `#D8EFFF` / `#BED4FF`, xanh lá nhạt (lime) `#C4E293`, xanh rêu `#AFB9A1`, xanh lá đậm `#477236`, xám nhạt `#E0E0E0`, đen `#000000`, và tím-đen đậm `#351E29` (dùng cho text heading/ink thay cho `#080E1A`).
- Logo icon: chữ "N" trong khối gradient caramel-vàng, favicon tương ứng.
- Element trang trí: sao 4 cánh (sparkle) màu xanh dương/vàng-lá/cam/xanh lá — và badge dạng ruy-băng xoắn "NUTEIN + ACTIVE PROTEIN POWDER" nhiều màu. Đây là motif riêng có thể thay cho hoa văn cloud/daisy của trang tham khảo.
- Ảnh brand sheet gốc chỉ tồn tại trong lịch sử chat (chưa có file tách lớp trong repo) — xem mục 6 "Assets cần bổ sung".

**Trang tham khảo: [drinkjoyrush.com](https://drinkjoyrush.com/)** — các pattern bố cục/kiểu chữ đáng học theo (đã chụp ảnh trực quan từng section trong phiên phân tích):
- Marquee ticker chữ chạy ngang trên cùng nav (rotating USP: "low calorie / functional ingredients / no added sugars / gluten free") — khớp tự nhiên với motif "ruy-băng xoắn text" đã có sẵn trong brand sheet của Nutein.
- Hero: headline cỡ lớn kiểu serif chồng lên ảnh lifestyle full-bleed, CTA dạng pill trắng có icon mũi tên trong vòng tròn, rating badge kính mờ (glass).
- Section sản phẩm: nền cream, card sản phẩm sạch, nút "QUICK ADD" outline-pill + icon tròn.
- Section giới thiệu: ảnh lifestyle được cắt theo khung dạng bèo/cloud xếp lớp lệch nhau, viền màu nhấn — Nutein sẽ dùng khung dạng **sao 4 cánh** (theo motif sparkle riêng) thay cho cloud.
- Section mood/persona: ảnh full-bleed, card bo góc viền màu nhấn "đè" lên mép ảnh.
- Heading dạng outline/ghost cỡ đại + badge hình "cloud" nhỏ chứa tên dưỡng chất.
- Testimonial card viền mảnh, serif heading, sao rating, link underline.
- Banner CTA cuối trang: nền màu rực full-bleed, sản phẩm đặt nghiêng 3D.
- Footer: heading khổ lớn ("MORE JOY MORE OFTEN") + input newsletter dạng pill + các cột link.

## 2. Nền tảng kỹ thuật (Design tokens & Tailwind v4 theme)

Viết lại `:root` trong `app/globals.css` theo bảng màu brand thật:
- `--color-primary: #E2A550` (caramel — thay xanh lá `#0A9B78`), thêm `--color-primary-deep` (caramel đậm hơn), `--color-primary-soft` (caramel nhạt cho bg tint).
- `--color-ink: #351E29` (thay `--color-text-heading`), giữ `--color-text-body/muted/faint` tinh chỉnh theo tông ink mới.
- `--color-bg: #FFFDFD`, `--color-surface: #FFFFFF`.
- Bộ màu phụ theo palette: `--color-sky: #D8EFFF`, `--color-sky-deep: #BED4FF`, `--color-lime: #C4E293`, `--color-sage: #AFB9A1`, `--color-forest: #477236`, `--color-gray: #E0E0E0`.
- Thêm khối `@theme inline { --color-primary: var(--color-primary); ... }` (cú pháp Tailwind v4) để các token này khả dụng như utility class Tailwind (`bg-primary`, `text-ink`, `border-sky`...) — đúng chuẩn Tailwind v4 mới (cần đọc `node_modules/next/dist/docs/` / tài liệu Tailwind v4 trước khi viết để tránh dùng cú pháp `@theme` sai, theo yêu cầu của `AGENTS.md`).
- Giữ nguyên hệ `--radius-*`, bổ sung biến `--shadow-brand` (glow theo màu caramel thay glow xanh lá).
- Loại bỏ các `T` token object cục bộ trong từng component (`HeroSection.tsx` dòng 10-19 và tương tự ở Navbar/Footer/section khác) — toàn bộ chuyển sang dùng biến CSS / Tailwind utility.

## 3. Font & typography direction

- Giữ Quicksand (display) + Mulish (body) làm nền tảng an toàn cho toàn bộ body text/UI (đã đầu tư, hỗ trợ tiếng Việt, không rủi ro layout-shift).
- Đề xuất **tăng độ tương phản kích thước tiêu đề** (oversized headline như Joy Rush) bằng cách nâng scale heading (h1 ~ 56-72px desktop) và letter-spacing âm nhiều hơn, để tạo cảm giác "bold, editorial" mà không cần đổi font.

### 3.1 Rà soát bộ font client cung cấp (9 file, danh sách Google Drive)

Client gửi 9 file font (chưa đưa file thật vào repo, mới chỉ có tên file). Vì `next/font/google` chỉ phục vụ Quicksand/Mulish, các font này — nếu dùng — phải load qua `next/font/local` và **phải hỗ trợ Unicode tiếng Việt** (đủ dấu thanh, nguyên âm mở `ư ơ`, chữ `đ`) để hiển thị đúng trên web. Kết quả rà soát theo tên file (cần soi lại glyph thật khi có file, xem mục "Cần xác nhận thêm"):

| File | Nhận diện | Tương thích Unicode tiếng Việt | Khuyến nghị |
|---|---|---|---|
| `SVN-Big Noodle Titling.otf` | Bản Việt hóa Unicode của "Big Noodle Titling" (condensed, all-caps, do STYLEno.1/SVN Font Việt hóa) | **Có** — đây là bản được Việt hóa chuyên biệt để gõ dấu tiếng Việt Unicode bình thường | Có thể dùng làm **display font phụ** cho heading/nhãn kiểu "titling" (viết hoa, cô đặc) — hợp với hướng "oversized headline" đã đề xuất ở trên. Cần xin/kiểm tra license thương mại (bản Việt hóa này chỉ free cho mục đích cá nhân theo trang phát hành). |
| `MyriadPro-Regular.otf` | Myriad Pro (Adobe) | **Có, nhưng có điều kiện** — chỉ bản OpenType version ≥ 2.006 mới có glyph tiếng Việt đầy đủ (dấu thanh + `ư ơ ă â ê ô`); bản cũ (version 1.x) sẽ lỗi font/mất dấu | Phải kiểm tra version thật của file trước khi dùng (mở font info hoặc dùng `fontTools`). Nếu đúng version 2.006+, có thể dùng cho text phụ/UI label; không cần thiết vì Mulish đã đảm nhiệm vai trò này. |
| `1FTV-FashionWacks-Regular.ttf` | "Fashion Wacks" (Nirmana Visual, serif display Art Nouveau) — file có tiền tố `1FTV` gợi ý đây là bản **Việt hóa** lưu hành trên các trang font Việt (bản gốc trên dafont chỉ có Latin, không có dấu tiếng Việt) | **Chưa xác nhận được** — cần soi glyph thật khi có file, vì tiền tố Việt hóa không đảm bảo 100% bộ dấu đầy đủ | Không dùng cho heading/CTA chính (rủi ro thiếu dấu) cho đến khi soi glyph xác nhận đủ dấu tiếng Việt. Font gốc là bản demo "free for personal use only" — nếu dùng cho landing page thương mại của Nutein, phải mua license commercial từ Nirmana Visual hoặc bên Việt hóa. |
| `VHELVCB.TTF`, `VHELVCN.TTF` | VNI Helvetica Condensed Bold/Normal | **Không** — đây là font mã hoá theo chuẩn **VNI (8-bit, pre-Unicode)**, không phải Unicode. Gõ tiếng Việt Unicode bình thường sẽ ra ký tự sai/mojibake khi áp font này | **Không dùng cho web.** Đây là font desktop-publishing cũ (thời trước Unicode phổ biến), không tương thích trình duyệt hiện đại. |
| `Vnihc__.ttf`, `VNIHCB_.TTF`, `VNIHCBI.TTF`, `Vnihci_.ttf` | Bộ font "VNI-Times/VNI Helvetica" theo 4 style Regular/Bold/Bold-Italic/Italic (đuôi `_`, `B_`, `BI`, `i_`) | **Không** — cùng nhóm mã hoá VNI 8-bit như trên | **Không dùng cho web** vì lý do tương tự. |

Tổng kết: trong 9 file, chỉ **`SVN-Big Noodle Titling.otf`** là rõ ràng tương thích Unicode tiếng Việt và có thể dùng ngay (sau khi xử lý license). **6 file VNI-encoding** (`VHELVCB`, `VHELVCN`, `Vnihc__`, `VNIHCB_`, `VNIHCBI`, `Vnihci_`) bị loại hoàn toàn khỏi phạm vi web — đây là công nghệ font tiếng Việt thời trước Unicode (Windows 9x/2000 desktop publishing), gõ Unicode vào sẽ ra chữ sai hoàn toàn nếu áp các font này. `MyriadPro-Regular.otf` và `1FTV-FashionWacks-Regular.ttf` cần kiểm tra glyph/license thêm trước khi quyết định dùng.

- Đề xuất áp dụng: giữ Quicksand/Mulish làm hệ font chính; nếu client muốn có điểm nhấn "titling" đậm chất thương hiệu hơn (khớp phong cách oversized headline học từ drinkjoyrush.com), dùng `SVN-Big Noodle Titling` làm **display accent font** cho 1-2 vị trí chọn lọc (ví dụ nhãn "NUTEIN" nhỏ trong badge, con số nổi bật ở footer) — không thay thế Quicksand cho toàn bộ heading vì đây là font all-caps condensed, không phù hợp đọc câu dài.

### 3.2 Font thật của trang reference vs. font client cung cấp — cái nào match Nutein hơn?

Đã kiểm tra `computed style` thực tế trên `drinkjoyrush.com` (không suy đoán từ ảnh):

| Vai trò trên reference | Font thật đang dùng | Loại | Hỗ trợ tiếng Việt |
|---|---|---|---|
| `h1`/`h2`/`h3`/`h5` (headline lớn, editorial) | **Fedro-Semibold** (Nasir Udin Studio, retro soft-serif display) | Premium, phải mua license | **Chưa chắc.** Trang chủ chính thức của foundry chỉ ghi "Extended Latin + Cyrillic, 200-250+ ngôn ngữ", **không liệt kê tiếng Việt** rõ ràng; một trang bán lại (fontpath.com) có ghi "Vietnamese" nhưng đây là metadata bên thứ 3, không đáng tin 100%. Muốn dùng phải test glyph thật với câu tiếng Việt đủ dấu (`ư ơ đ ẫ ộ`) trước khi quyết định. |
| `p`/`span` (body, badge/USP chip) | **PP Neue Montreal Bold** (Pangram Pangram Foundry, grotesk hiện đại) | Premium, phải mua license | **Có, xác nhận rõ** — trang chính hãng liệt kê tiếng Việt trong danh sách 506 ngôn ngữ hỗ trợ, kèm minh hoạ bộ dấu `áăâäàāąåã`, `éĕêëèēęěẽ`, `úŭûüùūųůũ`. |

So với 9 file font client cung cấp (mục 3.1): chỉ `SVN-Big Noodle Titling` là **chắc chắn dùng được tiếng Việt** (vì được Việt hóa riêng), nhưng nó là font all-caps condensed — chỉ đóng vai trò *accent/label*, không thể thay Fedro làm heading full-case editorial như reference. `MyriadPro`/`FashionWacks` còn cần soi glyph. 6 file VNI thì loại.

**Kết luận matching:**
- **Không có font nào trong 9 file client cung cấp đóng đúng vai trò "Fedro" (heading serif editorial, oversized)** — nếu muốn bám sát 100% phong cách reference, phải mua Fedro (rủi ro tiếng Việt) hoặc mua PP Neue Montreal (tiếng Việt chắc chắn OK) rồi dùng nó cho heading thay vì body.
- **Giữa 2 font reference, PP Neue Montreal match Nutein tốt hơn về mặt "dùng được tiếng Việt"** — vì có xác nhận chính hãng, còn Fedro thì rủi ro. Nhưng PP Neue Montreal là **sans-serif grotesk**, không tạo được cảm giác "editorial/soft-serif" đặc trưng của reference — nếu chỉ dùng riêng nó thì mất chất "Joy Rush" mà layout đang học theo.
- **Phương án an toàn nhất (đề xuất chính):** giữ Quicksand/Mulish (Google Fonts, tiếng Việt 100% chắc chắn, miễn phí, đã tích hợp sẵn) làm nền, tăng scale + letter-spacing để giả lập cảm giác "oversized headline" của Fedro mà không tốn phí license/không rủi ro thiếu dấu. Đây vẫn là hướng match tốt nhất cho Nutein ở giai đoạn frontend-only/mock-data hiện tại.
- **Phương án nếu có budget mua font:** ưu tiên mua **PP Neue Montreal** trước (rẻ hơn nhóm serif display, tiếng Việt chắc chắn) để dùng cho heading/USP chip thay Mulish; chỉ mua Fedro nếu đã test glyph tiếng Việt thật (yêu cầu bản demo/trial từ Nasir Udin Studio) và xác nhận đủ dấu.
- `SVN-Big Noodle Titling` (client cung cấp) vẫn giữ vai trò accent font phụ như đề xuất ở 3.1, không liên quan đến quyết định heading chính này.

## 4. Component primitives (`components/ui/`)

Scaffold shadcn/ui (`npx shadcn@latest init`) rồi tạo các primitive dùng `class-variance-authority` + `cn()` (đã có sẵn ở `lib/utils.ts`):
- `Button` — variants: `solid` (pill caramel), `outline-pill` (viền ink, dùng cho "QUICK ADD"/"ABOUT US" style), `ghost`.
- `Badge`/`Pill` — dùng cho USP chips, ticker item, ingredient cloud-badge.
- `Card` — viền mảnh + radius lớn, dùng cho testimonial/product/persona card.
- `SectionHeading` — heading lớn + biến thể "outline/ghost text" (text-stroke, dùng CSS `-webkit-text-stroke` hoặc `paint-order`).
- `MarqueeTicker` — component chạy chữ ngang vô hạn (CSS animation, reuse `@keyframes shimmer`-style translate loop), dùng cho dải USP trên Navbar.
- `StarRating` — thay `Star()` cục bộ trong HeroSection.
- `SparkleFrame` — khung ảnh dạng sao 4 cánh (clip-path polygon) thay cho "cloud/daisy" của reference, tái dùng cho ảnh sản phẩm/lifestyle.

## 5. Restyle từng section (theo pattern tham khảo, áp màu Nutein)

| Section hiện tại | Pattern học từ reference | Đổi gì |
|---|---|---|
| `Navbar.tsx` | Marquee ticker rotating USP phía trên nav | Thêm dải ticker cream/caramel text chạy các USP ("100% Protein Thực Vật", "Non-GMO", "Organic"); nav pill nổi, logo giữa |
| `HeroSection.tsx` | Headline lớn overlay ảnh, CTA pill + icon tròn, rating badge glass | Bỏ local `T` token, dùng token mới; tăng size headline; đổi glow/shadow xanh lá → caramel; badge dùng `SparkleFrame`/`Pill` mới |
| `IntroSection.tsx` | Card sản phẩm sạch trên nền cream, ảnh khung sao xếp lệch | Áp `SparkleFrame` cho ảnh nguyên liệu, card dùng `Card` primitive |
| `DifferentiatorsSection.tsx` | Heading outline/ghost cỡ đại + cloud badge dưỡng chất | Heading dạng outline dùng màu ink nhạt, badge pill màu theo 4 màu sparkle (xanh dương/lime/cam/forest) |
| `TargetAudienceSection.tsx` | Ảnh full-bleed + card đè mép ảnh | Card viền caramel đè lên ảnh lifestyle (cần asset ảnh thật) |
| `BenefitsSection.tsx` | Cloud badge + infographic | Badge pill dưỡng chất theo màu phụ, infographic card dùng token mới |
| `TestimonialsSection.tsx` | Card viền mảnh, sao rating, link underline | Dùng `Card` + `StarRating`, border ink nhạt thay shadow nặng |
| `BottomCtaSection.tsx` | Banner full-bleed màu rực + sản phẩm nghiêng 3D | Đổi gradient xanh lá → caramel/cam rực, bỏ milestone tier (Nutein chưa có cơ chế mốc chi tiêu) |
| `Footer.tsx` | Heading khổ lớn + input newsletter pill + cột link | Heading lớn "Không bỏ lỡ ưu đãi nào" + input pill, giữ cấu trúc cột hiện có, áp token màu mới |
| `AuthModal.tsx` | — | Chỉ đồng bộ token màu/pill button, không đổi cấu trúc |

Toàn bộ animation `@keyframes` trùng lặp giữa `globals.css` và từng component (ví dụ `fadeUp` bị định nghĩa lại trong `HeroSection.tsx`) sẽ được gộp về một nguồn duy nhất trong `globals.css`.

## 6. Assets cần bổ sung (blocker cần xử lý trước/song song khi code)

**Đã có trong `public/images/`** (client đã bổ sung):
- `logo-horizontal @2x_1.svg` — logo ngang (variant chữ nâu/caramel nền kem đã chọn).
- `logo-icon @1x_2.svg` — icon vuông chữ "N".
- `favicon-color 3232 @10x_2.svg` — favicon màu.
- `brand_design.jpg` — ảnh brand sheet gốc (tham khảo, không dùng trực tiếp lên site).

Khi code, cần đối chiếu tên file thật ở trên (có khoảng trắng, `@2x`/`@1x` trong tên) — nên rename sang kebab-case không dấu cách khi đưa vào code (`logo-horizontal.svg`, `logo-icon.svg`, `favicon-color.svg`) để tránh lỗi encode URL, giữ nguyên nội dung file.

**Vẫn cần bổ sung:**
- Export 4 sparkle SVG (xanh dương, lime, cam, forest) dùng làm icon bullet/khung ảnh — chưa có trong `public/images/`.
- Ảnh lifestyle/sản phẩm thật để thay thế `/images/herosection.png` (hiện bị thiếu) và ảnh cho `TargetAudienceSection` — chưa có trong `public/images/`.
- File font thật (`.otf`/`.ttf`) nếu quyết định dùng `SVN-Big Noodle Titling` (xem mục 3.1) — hiện chỉ có tên file trong danh sách Google Drive của client, chưa có file vật lý trong repo để `next/font/local` load.

## 7. Thứ tự triển khai

1. **Phase 0 — Tokens & Tailwind theme**: viết lại `globals.css` + `@theme` mapping.
2. **Phase 1 — UI primitives**: scaffold shadcn, tạo `Button/Badge/Card/SectionHeading/MarqueeTicker/StarRating/SparkleFrame`.
3. **Phase 2 — Section refactor**: đi theo thứ tự Navbar → Hero → Intro → Differentiators → TargetAudience → Benefits → Testimonials → BottomCta → Footer → AuthModal, mỗi section xoá `T` token cục bộ, dùng primitive mới.
4. **Phase 3 — Asset polish**: chèn asset thật khi có, fine-tune responsive/animation.

## 8. Việc cần xác nhận thêm trước khi code

- Logo/icon/favicon: **đã có** trong `public/images/` (xem mục 6) — không còn là blocker.
- Font: quyết định có dùng `SVN-Big Noodle Titling` làm display accent font hay không (xem mục 3.1). Nếu có, cần: (a) file `.otf` thật để đưa vào repo (ví dụ `public/fonts/` hoặc thư mục font riêng), (b) xác nhận license commercial cho bản Việt hóa. `MyriadPro-Regular.otf` và `1FTV-FashionWacks-Regular.ttf` không khuyến nghị dùng cho đến khi soi glyph/license (xem bảng ở mục 3.1); 6 file VNI-encoding còn lại loại khỏi phạm vi web.
- Heading chính: xác nhận với client có mua font trả phí để match 100% reference không (xem mục 3.2). Mặc định (không cần xác nhận thêm nếu không có phản hồi) là **giữ Quicksand/Mulish**, không mua Fedro/PP Neue Montreal — chỉ đổi khi client duyệt budget license.
- Cần 4 sparkle SVG (xanh dương, lime, cam, forest) — chưa có trong `public/images/`.
- Ảnh lifestyle/sản phẩm thật để thay thế placeholder trong Hero/TargetAudience — chưa có trong `public/images/`.

## 9. Todo checklist (cho Cursor Agent thực thi)

- [x] `tokens` — Viết lại design tokens trong `app/globals.css` theo bảng màu brand Nutein + thêm `@theme` Tailwind v4 mapping
- [x] `typography` — Xác nhận hướng typography (giữ Quicksand/Mulish hoặc thêm serif display) và tăng scale heading
- [x] `ui-primitives` — Scaffold shadcn/ui và tạo `components/ui`: Button, Badge, Card, SectionHeading, MarqueeTicker, StarRating, SparkleFrame
- [x] `navbar-ticker` — Thêm marquee ticker USP + restyle Navbar theo token mới
- [x] `hero-restyle` — Restyle HeroSection: bỏ local `T` token, áp headline lớn, CTA pill, badge mới
- [x] `sections-restyle` — Restyle Intro/Differentiators/TargetAudience/Benefits/Testimonials/BottomCta theo pattern đã map
- [x] `footer-restyle` — Restyle Footer với heading lớn + newsletter pill
- [ ] `assets` — Thu thập/export asset brand thật còn thiếu: 4 sparkle SVG (xanh dương/lime/cam/forest), ảnh lifestyle cho TargetAudienceSection, ảnh `herosection.png` cho Hero (logo/icon/favicon đã có)
