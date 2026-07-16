# Frontend Style System Guide — Nutein

## 1. Mục tiêu của tài liệu

Tài liệu này định nghĩa hệ thống styling, layout và quy tắc giao diện cho landing page/e-commerce Nutein (Next.js 16 App Router, Tailwind CSS v4). Mục tiêu là giúp mọi developer và AI coding agent tạo UI nhất quán với bộ nhận diện thương hiệu Nutein, dễ mở rộng sang các trang tương lai (`/product`, `/cart`, `/checkout`, `/blog`, `/about`...), và chấm dứt tình trạng mỗi component tự hardcode màu/spacing riêng.

Các mục tiêu chính:

- Mọi màu sắc, font, spacing, radius, shadow phải xuất phát từ **design tokens** trong [app/globals.css](../app/globals.css), không hardcode hex/px rải rác trong từng component.
- Tái sử dụng component nền (`components/ui/`) thay vì mỗi section tự vẽ lại Button/Card/Badge bằng `style={{}}`.
- Giữ nhất quán ngôn ngữ hình ảnh: cream background, caramel là màu nhấn chính, bo tròn kiểu pill, chữ Quicksand cho heading.
- Giúp AI agent sinh code UI đúng theo hệ thống thay vì tự sáng tạo màu/spacing mới mỗi lần.
- Kế hoạch chi tiết về việc migrate từ hệ thống cũ (xanh lá `#0A9B78`, inline style) sang hệ thống mới nằm ở [frontend-style-overhaul.md](./frontend-style-overhaul.md) — tài liệu này là **rulebook áp dụng lâu dài** sau khi/khi đang migrate, không phải kế hoạch một lần.

Nguyên tắc cốt lõi: UI phải được tạo từ token, component, layout pattern đã thống nhất. Nếu cần biến thể mới, kiểm tra pattern hiện có trước khi tự thêm.

## 2. Design Philosophy

Nutein là landing page bán hàng cho sản phẩm Protein thực vật, định vị **Healthy Lifestyle, nguyên liệu thật, phong cách Organic Grocery** (theo `PROJECT_REQUIREMENTS.md`). Đây là marketing/e-commerce site, không phải dashboard vận hành — UI được phép có cảm xúc, nhịp điệu, chuyển động, miễn là vẫn sạch sẽ và đáng tin cậy.

Triết lý thiết kế:

- Warm & organic > lạnh và công nghiệp.
- Bold typography, nhiều khoảng trắng > dày đặc thông tin.
- Chuyển động có chủ đích (fade up, float nhẹ) > tĩnh hoàn toàn, nhưng không lạm dụng hiệu ứng gây rối mắt.
- Nhất quán thương hiệu > sáng tạo tùy hứng từng section.
- Mobile-first thực sự > desktop-first (theo `PROJECT_REQUIREMENTS.md`: >80% khách hàng Healthy Lifestyle mua sắm qua điện thoại).

Hướng thẩm mỹ:

- Nền cream ấm (`--color-bg: #FFFDFD`), không dùng trắng lạnh `#FFFFFF` cho background lớn.
- Caramel (`--color-primary: #E2A550`) là màu nhấn chính cho CTA, badge, icon — không dùng lại màu xanh lá `#0A9B78` cũ.
- Heading cỡ lớn, letter-spacing âm nhẹ, dùng font Quicksand.
- Button/badge chủ yếu dạng pill (`border-radius: 9999px`), ít dùng góc vuông.
- Card viền mảnh (1px) thay cho shadow nặng nhiều lớp.
- Element trang trí là motif riêng của brand: sao 4 cánh (sparkle) 4 màu, không copy cloud/daisy của bất kỳ site tham khảo nào.

## 3. Theme System — Design Tokens

Toàn bộ token định nghĩa tại `:root` trong [app/globals.css](../app/globals.css). Component **không được** hardcode hex, phải dùng biến CSS (trực tiếp hoặc qua Tailwind `@theme` utility nếu đã map).

Bảng màu chính thức (theo bộ nhận diện thương hiệu Nutein):

```txt
--color-bg            #FFFDFD   nền tổng thể (cream)
--color-surface       #FFFFFF   nền card/panel nổi trên bg
--color-primary       #E2A550   caramel — CTA, link nhấn, icon chính
--color-primary-deep  (đậm hơn) hover/active state của primary
--color-primary-soft  (nhạt hơn) nền tint cho badge/section nhẹ
--color-ink           #351E29   text heading, màu tối chính (thay đen thuần)
--color-text-body     xám ấm    body text
--color-text-muted    xám nhạt  metadata, caption
--color-sky           #D8EFFF   màu phụ — badge/section xanh dương nhạt
--color-sky-deep      #BED4FF   biến thể đậm hơn của sky
--color-lime          #C4E293   màu phụ — badge/section xanh lá nhạt
--color-sage          #AFB9A1   màu phụ trung tính ấm
--color-forest        #477236   xanh lá đậm — dùng cho text/icon nhấn phụ
--color-gray          #E0E0E0   border/divider nhẹ
--color-border         (dựa trên ink, alpha thấp)
--radius-sm/md/lg/xl/full   8 / 14 / 20 / 28 / 9999 px
--shadow-sm/md/lg/xl        elevation chuẩn
--shadow-brand              glow màu caramel (thay glow xanh lá cũ)
--font-sans     Mulish (body)
--font-display  Quicksand (heading)
```

Ý nghĩa & quy tắc dùng màu:

- `primary` (caramel): mọi CTA chính, link quan trọng, icon nhấn, số liệu highlight (rating, giá). Không dùng cho toàn bộ background lớn (dễ gắt mắt) — dùng `primary-soft` cho tint nền.
- `ink`: heading, text quan trọng nhất. Không dùng đen thuần `#000000` cho text thường.
- `sky` / `lime` / `sage` / `forest`: chỉ dùng để phân loại nội dung (badge dưỡng chất, sparkle 4 màu, section luân phiên màu nền) — không dùng làm màu CTA chính.
- `surface` trên `bg`: card/modal nổi nhẹ nhàng bằng border mảnh + shadow nhẹ, không cần tương phản mạnh vì cả hai đều là tông sáng ấm.

Quy tắc bắt buộc:

- Không hardcode `#E2A550`, `#351E29`... trực tiếp trong component — luôn `var(--color-primary)` hoặc class Tailwind map từ token (`bg-primary`, `text-ink`) nếu đã cấu hình `@theme`.
- Không dùng arbitrary color Tailwind (`bg-[#123456]`) trừ khi giá trị đó thật sự là token mới cần thêm vào `globals.css` trước.
- Không tự tạo `const T = {...}` object màu cục bộ trong component (đây chính là nợ kỹ thuật cần dọn theo `frontend-style-overhaul.md`) — mọi màu đi qua token chung.
- Section liên tiếp không nên dùng cùng 1 tông màu nền nếu muốn tạo nhịp điệu (xen kẽ cream / primary-soft / ảnh full-bleed), nhưng không dùng quá 3 màu nền khác nhau trong 1 lượt cuộn màn hình.

Ví dụ tốt:

```tsx
<div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]">
  <p className="text-sm text-[var(--color-text-muted)]">Cập nhật gần nhất</p>
</div>
```

Ví dụ không nên dùng:

```tsx
<div style={{ borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", backgroundColor: "#FFFFFF", color: "#080E1A" }}>
  <p style={{ fontSize: 13, color: "#6B7280" }}>Cập nhật gần nhất</p>
</div>
```

## 4. Typography System

Font chính: **Quicksand** (`--font-display`, dùng cho mọi heading `h1-h6`) + **Mulish** (`--font-sans`, dùng cho body), cấu hình qua `next/font/google` ở [app/layout.tsx](../app/layout.tsx), hỗ trợ subset `vietnamese`.

Quy tắc:

- Không thêm font family thứ 3 vào UI chính trừ khi được quyết định rõ (xem mục "Font & typography direction" trong `frontend-style-overhaul.md` về khả năng thêm serif display cho hero).
- Heading luôn dùng `var(--font-display)`, body luôn `var(--font-sans)` — không set `fontFamily` tùy tiện trong từng component.
- Heading scale ưu tiên cỡ lớn, tự tin (hero h1 ~ 56-72px desktop, 32-40px mobile), letter-spacing âm nhẹ (`-0.02em` đến `-0.03em`), line-height chặt (`~1.1`).
- Body text dùng `line-height: 1.6` (đã set global trên `body`), không cần chỉnh lại mỗi component.
- Label/caption nhỏ (badge, USP chip) có thể dùng `letter-spacing` dương nhẹ + uppercase để tạo cảm giác nhãn sản phẩm, nhưng không áp dụng uppercase cho đoạn văn dài.

Scale đề xuất (Tailwind):

```txt
text-xs    caption, badge nhỏ, legal text footer
text-sm    body phụ, label, meta
text-base  body chính
text-lg    sub-heading, card title
text-2xl   section heading (mobile)
text-4xl   section heading (desktop)
text-5xl/6xl  hero headline (desktop)
```

## 5. Spacing & Radius System

Spacing dựa trên scale Tailwind mặc định, không dùng px tùy tiện.

- `gap-2`: icon + text, control nhỏ trong badge/chip.
- `gap-4` / `gap-6`: khoảng cách giữa field, card content.
- `py-16` / `py-24`: padding dọc chuẩn cho 1 section landing page (desktop), `py-12` cho mobile.
- Card nhỏ: `p-4` đến `p-6`. Section container: `px-4 md:px-8 max-w-7xl mx-auto`.

Radius:

- Button/badge/chip: `--radius-full` (pill) — đây là ngôn ngữ hình ảnh chủ đạo của brand, ưu tiên hơn góc vuông.
- Card/ảnh: `--radius-lg` (20px) hoặc `--radius-xl` (28px).
- Input: `--radius-md` (14px).
- Không tạo radius mới ngoài scale đã có trừ khi có lý do hệ thống (ví dụ khung ảnh dạng sao — dùng `clip-path`, không phải `border-radius`).

## 6. Layout System

- Container chính: `max-w-7xl mx-auto px-4 md:px-8` cho hầu hết section; hero/full-bleed section có thể `w-full` không giới hạn max-width cho phần ảnh/màu nền, nhưng nội dung text bên trong vẫn giới hạn trong container.
- Mobile-first: viết class mobile trước, thêm biến thể `md:`/`lg:` cho desktop — không viết ngược (desktop trước rồi override mobile).
- Navbar sticky trên cùng, không dùng sidebar (đây là landing page, không phải dashboard).
- Mỗi section là 1 block full-width độc lập (`<section>`), không lồng nhiều layer scroll — chỉ có scroll chính của `body`.
- Ảnh sản phẩm/lifestyle dùng `next/image` với `fill` hoặc kích thước cố định, luôn có `alt` mô tả tiếng Việt.

## 7. Tailwind Usage Rules

- Ưu tiên Tailwind utility cho layout/spacing; dùng biến CSS token (`var(--color-*)`) cho màu sắc/font/radius cho đến khi có `@theme` mapping đầy đủ trong `globals.css`.
- Không viết `style={{...}}` inline cho giá trị tĩnh (màu, radius, spacing) — chỉ dùng `style` khi giá trị thực sự động (ví dụ vị trí tính toán runtime, progress bar width %).
- Không để `className` dài quá mức không đọc được — nếu 1 tổ hợp class lặp lại ≥ 2-3 lần, tạo component/variant dùng `class-variance-authority` (đã cài, xem `lib/utils.ts`).
- Dùng `cn()` (từ `lib/utils.ts`, dựa trên `clsx` + `tailwind-merge`) cho mọi class có điều kiện — không nối string thủ công.
- Không tạo `<style>{`...`}`> block riêng trong từng component cho keyframe animation — mọi `@keyframes` dùng chung phải nằm trong `globals.css` (xem mục 9).

GOOD:

```tsx
import { cn } from "@/lib/utils";

<button
  className={cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold",
    "bg-[var(--color-primary)] text-white transition-colors duration-150 hover:bg-[var(--color-primary-deep)]",
    disabled && "pointer-events-none opacity-50",
  )}
>
  Mua ngay
</button>
```

BAD:

```tsx
<button style={{ height: 44, borderRadius: 999, padding: "0 24px", background: "#E2A550", color: "#fff" }}>
  Mua ngay
</button>
```

## 8. Component Primitives (`components/ui/`)

Theo quy hoạch trong [nextjs-architecture-guide.md](../nextjs-architecture-guide.md), `components/ui/` chứa các primitive shadcn/ui. Khi cần Button/Card/Badge mới, kiểm tra thư mục này trước — nếu chưa có, tạo mới ở đây bằng `class-variance-authority`, KHÔNG tự vẽ lại trong từng section.

Primitive tối thiểu cần có (theo `frontend-style-overhaul.md`):

- `Button`: variant `solid` (pill caramel), `outline-pill` (viền ink), `ghost`. Hỗ trợ prop `loading` (xem `loading-agent-guide.md`).
- `Badge` / `Pill`: dùng cho USP chip, ticker item, ingredient badge — hỗ trợ variant màu theo `sky`/`lime`/`sage`/`forest`.
- `Card`: viền mảnh `border border-[var(--color-border)]`, radius `lg`, dùng cho product/testimonial/persona card.
- `StarRating`: hiển thị rating sao, dùng lại ở Hero, Testimonials.
- `SectionHeading`: heading section với biến thể outline/ghost text cho hiệu ứng chữ lớn trang trí.

Quy tắc:

- Mọi section mới ưu tiên compose từ các primitive này thay vì viết JSX + `style` riêng.
- Khi sửa 1 primitive, kiểm tra toàn bộ nơi đang dùng nó để tránh regression thị giác.

## 9. Animation Rules

Animation được phép có tính "sống", nhưng phải phục vụ cảm giác thương hiệu (ấm áp, tự nhiên), không phải hiệu ứng phô trương ngẫu nhiên.

- Toàn bộ `@keyframes` dùng chung đặt trong [app/globals.css](../app/globals.css) (`floatY`, `fadeUp`, `badgePop`...) — không định nghĩa lại keyframe cùng tên trong component riêng lẻ.
- Duration hợp lý: hover/transition nhanh `150-200ms`; fade-in khi scroll vào view `500-700ms` với easing `cubic-bezier(0.22,1,0.36,1)`.
- Float/pulse liên tục (badge lơ lửng, glow) chỉ dùng cho 1-2 điểm nhấn mỗi section, không để toàn bộ trang "rung" cùng lúc.
- Marquee ticker (USP chạy chữ) dùng animation `translate` tuyến tính, tốc độ đủ chậm để đọc được, dùng `animation-play-state: paused` khi hover nếu ticker có thể click.
- Không dùng `transition: all` — chỉ animate property cụ thể (`transform`, `opacity`, `background-color`) để tránh giật layout.

## 10. Icon System

- Dùng `lucide-react` làm nguồn icon duy nhất, không trộn icon pack khác.
- Icon trong button/badge: `size-4` (16px). Icon trong feature/USP chip: `size-4` hoặc `size-5`.
- Element trang trí sao 4 cánh (sparkle) là SVG riêng của brand (không phải từ `lucide-react`) — xem asset cần bổ sung trong `frontend-style-overhaul.md`.
- Icon-only button phải có `aria-label`.

## 11. Empty & Loading States

Quy tắc loading chi tiết nằm ở [loading-agent-guide.md](./loading-agent-guide.md) — không lặp lại ở đây, chỉ nhắc nguyên tắc chung: mọi list/section fetch dữ liệu (blog, orders, wishlist khi được xây) phải có empty state rõ ràng (không để trắng), copy ngắn gọn tiếng Việt, có CTA tiếp theo nếu phù hợp.

## 12. Responsive Rules (Mobile-first)

Khác với app dashboard desktop-first, Nutein bắt buộc **mobile-first** vì hành vi khách hàng thực tế (theo `PROJECT_REQUIREMENTS.md`, mục 5, ghi rõ >80% khách hàng Healthy Lifestyle mua sắm qua điện thoại).

- Viết Tailwind class base = mobile, thêm `md:`/`lg:` để mở rộng cho desktop, không viết ngược lại.
- Hero, CTA, form phải test kỹ ở viewport 375px trước khi test desktop.
- Text/button không được nhỏ hơn kích thước chạm tối thiểu (tối thiểu `h-11`/`44px` cho tap target chính).
- Ảnh full-bleed (hero, mood section) phải có `object-fit: cover` + kiểm tra crop hợp lý trên tỉ lệ mobile (dọc) chứ không chỉ desktop (ngang).
- Navbar mobile dùng menu dạng overlay/drawer đơn giản, không nhồi toàn bộ nav item ngang trên mobile.
- Section CTA cuối trang trên mobile có thể dùng sticky CTA bar (đã có pattern "sticky mobile CTA" trong `HeroSection.tsx`) — tái sử dụng thay vì tạo pattern sticky mới.

## 13. Font Configuration Reference

```txt
--font-display: Quicksand (heading)
--font-sans:    Mulish (body)
```

- Cả hai font đều load qua `next/font/google` với subset `["latin", "vietnamese"]` — bắt buộc giữ subset `vietnamese` vì toàn bộ content là tiếng Việt.
- Không dùng font-weight quá mỏng (`300`) cho text quan trọng trên nền ảnh — ưu tiên `600-800` cho heading để đảm bảo đọc được trên background phức tạp.

## 14. UI Consistency Checklist

Trước khi commit UI mới, kiểm tra:

- Màu sắc có lấy từ token (`var(--color-*)`) không, hay đang hardcode hex?
- Heading có dùng `--font-display`, body có dùng `--font-sans` không?
- Button/badge có dùng radius pill (`--radius-full`) đúng ngôn ngữ hình ảnh brand không?
- Có tái sử dụng `components/ui/` primitive không, hay đang tự vẽ lại?
- Animation có nằm trong `globals.css` (không định nghĩa keyframe trùng cục bộ) không?
- Đã test ở mobile viewport trước khi test desktop chưa?
- Có `alt` text tiếng Việt cho mọi ảnh không?
- Loading/empty state đã xử lý theo `loading-agent-guide.md` chưa?

## 15. AI Agent Frontend Rules

AI coding agent phải tuân thủ hệ thống này trước khi sinh code UI mới:

1. Đọc token trong `app/globals.css` và component liên quan gần nhất trước khi viết UI mới.
2. Không hardcode màu hex (`#E2A550`, `#351E29`...) trực tiếp trong JSX/style — luôn qua token.
3. Không tạo object token cục bộ (`const T = {...}`) trong component — đây là anti-pattern đang được dọn dần theo `frontend-style-overhaul.md`.
4. Không dùng `style={{...}}` cho giá trị tĩnh có thể biểu diễn bằng Tailwind class + token.
5. Ưu tiên tái sử dụng `components/ui/` primitive; nếu primitive cần thiết chưa tồn tại, tạo trong `components/ui/` bằng `cva`, không viết riêng trong section.
6. Không thêm icon pack, animation library, hoặc CSS-in-JS solution mới ngoài những gì đã có (`lucide-react`, Tailwind, CSS custom properties, keyframes trong `globals.css`).
7. Viết mobile-first: class base cho mobile, `md:`/`lg:` override cho desktop.
8. Khi chỉnh 1 section, không refactor toàn bộ trang nếu nhiệm vụ chỉ yêu cầu thay đổi nhỏ — nhưng nếu section đó vẫn dùng object `T` cục bộ/hex hardcode, nên dọn luôn phần liên quan trực tiếp đến thay đổi.
9. Giữ đúng phân vai `app/` (mỏng, chỉ gọi service) — `features/*/services/` (business logic) — `components/` (UI) như mô tả trong `nextjs-architecture-guide.md`.

## 16. Common Mistakes To Avoid

- Hardcode hex màu cũ (`#0A9B78` và các biến thể xanh lá) — hệ thống mới dùng caramel `#E2A550` làm primary.
- Tạo lại `const T = {...}` token object trong component mới.
- Viết `<style>{`@keyframes ...`}</style>` riêng trong component trong khi `globals.css` đã có keyframe tương đương.
- Bo góc vuông cho button/badge chính (phá vỡ ngôn ngữ pill của brand).
- Thiết kế desktop trước rồi mới "nhồi" responsive cho mobile.
- Dùng nền trắng lạnh `#FFFFFF` cho background lớn thay vì cream `--color-bg`.
- Copy motif trang trí từ site tham khảo (cloud/daisy) thay vì dùng motif sparkle riêng của Nutein.

## 17. Tài liệu liên quan

- [frontend-style-overhaul.md](./frontend-style-overhaul.md) — kế hoạch migrate từ hệ thống cũ sang hệ thống token/component mới, theo phase.
- [state-management.md](./state-management.md) — quy tắc quản lý state (SWR, local state, form).
- [loading-agent-guide.md](./loading-agent-guide.md) — quy tắc loading/skeleton/spinner chi tiết.
- [nextjs-architecture-guide.md](../nextjs-architecture-guide.md) — kiến trúc thư mục tổng thể của dự án.
