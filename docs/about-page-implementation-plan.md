# Nutein — Plan triển khai trang Về Nutein (`/about`)

> Plan riêng cho page About. Nội dung & phạm vi **bám sát** `PROJECT_REQUIREMENTS.md` mục **3.6 Về Nutein (About Story)**. Reference Joy Rush About Us chỉ ở mức pattern UI (layout energy, nhịp section) — không copy nội dung THC/functionals/age-gate.
>
> Style/component theo `docs/frontend-style-system-guide.md` + token `app/globals.css`.

## 0. Ràng buộc bắt buộc

- **Route:** `/about` → `app/about/page.tsx`. Không dùng hash `#ve-chung-toi` làm “page”.
- **Navbar & Footer:** **reuse như home** — cùng component `Navbar` / `Footer`, cùng cách gắn vào page (wrapper hero + absolute nav nếu page có hero, hoặc cùng pattern đang dùng trên home). Không thiết kế / quyết định lại navbar-footer riêng cho About.
- **Chỉ wire link:** “Về chúng tôi” / “Về Nutein” / CTA Differentiator → `/about`.
- **Nội dung page = đúng 4 nhóm §3.6** (xem mục 1–2). Không thêm Reviews, FUNCTIONALS, catalog multi-SKU, age gate.
- **Single-SKU** throughout.
- `page.tsx` mỏng, compose section; copy dài → `features/about/constants.ts`.

## 1. Requirement nguồn (PROJECT_REQUIREMENTS §3.6) — không mở rộng

**Mục tiêu:** Xây dựng niềm tin, kể câu chuyện thương hiệu & xuất xứ.

**Nội dung chính (đủ và đủ dùng để chia section):**

1. Câu chuyện thương hiệu, Triết lý sản phẩm.
2. Quy trình lựa chọn nguyên liệu sạch, Quy trình sản xuất an toàn.
3. Cam kết chất lượng, Chứng nhận (nếu có).
4. Tầm nhìn & Sứ mệnh.

Mọi section nội dung trên `/about` phải map 1–1 vào một trong bốn mục trên. Không invent block ngoài danh sách này (trừ chrome Navbar/Footer và CTA đóng trang kiểu home nếu cần dẫn mua — không tính là nội dung §3.6).

## 2. Cấu trúc page (map 1–1 với §3.6)

```txt
app/about/page.tsx
  Navbar                         ← reuse home
  AboutStory                     ← §3.6 (1) Câu chuyện + Triết lý
  AboutProcess                   ← §3.6 (2) Nguyên liệu sạch + Sản xuất an toàn
  AboutCommitment                ← §3.6 (3) Cam kết chất lượng + Chứng nhận (nếu có)
  AboutMission                   ← §3.6 (4) Tầm nhìn & Sứ mệnh
  BottomCtaSection (optional)    ← reuse home — dẫn mua; không thay nội dung §3.6
  Footer                         ← reuse home
```

Ưu tiên đặt section trong `components/about/` (chỉ dùng cho About).

### 2.1 `AboutStory` — Câu chuyện thương hiệu, Triết lý sản phẩm

- Mở đầu trang: có thể gộp **eyebrow + H1 ngắn** ngay trong section này (không tách “Hero” thành requirement riêng).
- Nội dung: xuất xứ / vì sao có Nutein + triết lý “nguyên liệu thật / Healthy Lifestyle / Organic Grocery”.
- Layout gợi ý: 2 cột desktop (ảnh sản phẩm hoặc ingredient | text); stack mobile.
- Component: `SectionHeading`, `SparkleFrame` hoặc `Image`, typography token — tránh card dày.

### 2.2 `AboutProcess` — Quy trình nguyên liệu sạch + sản xuất an toàn

- Hai nhánh rõ (có thể 2 subsection hoặc 1 grid 2 cột / 4–6 bước):
  - Lựa chọn nguyên liệu sạch
  - Sản xuất an toàn
- Layout gợi ý: bước đánh số / card viền mảnh (`Card`) — **không** copy “Crafted with real FUNCTIONALS” (amino/THC) của Joy Rush.
- Đây là chỗ thay thế pattern “ingredient science cards” của JR bằng nội dung đúng Nutein.

### 2.3 `AboutCommitment` — Cam kết chất lượng, Chứng nhận (nếu có)

- Cam kết chất lượng: list hoặc grid ngắn (Non-GMO, không chất bảo quản, hữu cơ…).
- Chứng nhận: **chỉ hiện khi có thật**; chưa có → không bịa logo; có thể bỏ hàng chứng nhận hoặc ghi chú nhẹ “đang cập nhật”.
- Layout gợi ý: badges/pills + đoạn cam kết; hoặc 2×2 điểm cam kết.

### 2.4 `AboutMission` — Tầm nhìn & Sứ mệnh

- Hai khối rõ: **Tầm nhìn** | **Sứ mệnh**.
- Layout gợi ý: nền `primary-soft` hoặc khối ink/cream; typography lớn, ít trang trí.
- Pattern tham khảo JR “Goals” chỉ về nhịp section, không copy copy Joy Rush.

### 2.5 Chrome ngoài §3.6 (không đổi requirement)

| Phần | Việc |
|---|---|
| `Navbar` / `Footer` | Reuse home; chỉ đổi href → `/about` |
| `BottomCtaSection` | Optional cuối page — cùng component home — để giữ CTA mua; không thay thế 4 mục §3.6 |

## 3. Joy Rush — chỉ để nhớ pattern (không là checklist nội dung)

| Joy Rush | Với Nutein |
|---|---|
| Hero manifesto | Gộp mở đầu vào `AboutStory` |
| About main | → `AboutStory` |
| FUNCTIONALS cards | **Bỏ nội dung** → thay bằng `AboutProcess` |
| Goals | → `AboutMission` |
| Reviews / age gate / multi-SKU CTA | **Bỏ** |

## 4. Wiring

| File | Việc |
|---|---|
| `app/about/page.tsx` | Compose 4 section §3.6 (+ Navbar/Footer/optional BottomCta) + metadata VI |
| `components/layout/Navbar.tsx` | Link → `/about` |
| `components/layout/Footer.tsx` | Link → `/about` |
| `components/shared/DifferentiatorsSection.tsx` | CTA → `/about` |

## 5. Content & asset checklist

- [ ] Copy VI cho đủ 4 mục §3.6 (story/triết lý; nguyên liệu; sản xuất; cam kết; tầm nhìn; sứ mệnh)
- [ ] Ảnh minh họa story/process (tạm dùng asset `public/images/` hiện có nếu chưa có lifestyle)
- [ ] Chứng nhận thật (nếu chưa có → không render logo giả)
- [ ] Metadata: title/description trang Về Nutein

## 6. Style checklist (agent)

- Token Nutein only; CTA `FillButton` (`ink` / `ink-solid`).
- Heading `font-display`; spacing section theo style guide.
- Motion nhẹ, có chủ đích; không glass/glow “AI generic”.
- Mobile-first.

## 7. Thứ tự triển khai

1. `app/about/page.tsx` + wire links Navbar/Footer/Differentiator → `/about`.
2. `AboutStory` (§3.6.1) — gồm mở đầu trang.
3. `AboutProcess` (§3.6.2).
4. `AboutCommitment` (§3.6.3).
5. `AboutMission` (§3.6.4).
6. Optional: gắn `BottomCtaSection` như home.
7. Pass visual desktop/mobile; không regress cart/auth.

## 8. Out of scope

- CMS/API about
- Team/career subpages
- Reviews trên About
- Redirect `#ve-chung-toi` (tuỳ chọn sau)
- Thiết kế lại Navbar/Footer

## 9. Definition of done

- [ ] `/about` có đủ **đúng 4 nhóm nội dung §3.6**, không thiếu không thừa requirement
- [ ] Navbar & Footer reuse home; mọi link Về Nutein / Về chúng tôi → `/about`
- [ ] UI token + component Nutein; không FUNCTIONALS / age gate / multi-SKU
- [ ] Mobile + desktop ổn

---

**Tài liệu liên quan:** `PROJECT_REQUIREMENTS.md` §2 STT 8 & §3.6 · `docs/frontend-style-system-guide.md` · `docs/source-code-architecture-guide.md`
