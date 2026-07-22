# Admin Portal Roadmap — Nutein

Tài liệu này mô tả lộ trình khu vực quản trị (Staff / Admin).
Đối chiếu: [`PROJECT_REQUIREMENTS.md`](../PROJECT_REQUIREMENTS.md) mục 7.

## Nguyên tắc sản phẩm

- Staff/Admin vào cùng storefront; login chung [`AuthModal`](../components/shared/AuthModal.tsx).
- Entry: **Quản Trị** trong mega Khám phá khi `staff|admin`.
- Route: `/admin` + shell sidebar [`AdminShell`](../components/admin/AdminShell.tsx) (không Navbar storefront). Nút **Về cửa hàng** → `/`.
- **Tách quyền:** Staff = S2–S8 (vận hành). Admin = chỉ A1 Users + A2 Audit (không kế thừa staff). Gate: [`StaffOnlyGate`](../components/admin/StaffOnlyGate.tsx) / [`AdminOnlyGate`](../components/admin/AdminOnlyGate.tsx).

## Phase 0 — Nền tảng (xong)

Role + allowlist + `authService` + gate [`AdminAccessGate`](../components/admin/AdminAccessGate.tsx).

## Phase 1 — S2 Dashboard (mock UI)

[`/admin`](../app/(admin)/admin/page.tsx) · [`features/admin-dashboard/`](../features/admin-dashboard/) · [`AdminDashboardSummary`](../components/admin/AdminDashboardSummary.tsx)

## Phase 2 — S3 Đơn hàng (mock UI)

[`/admin/orders`](../app/(admin)/admin/orders/page.tsx) · [`features/admin-orders/`](../features/admin-orders/)

## Phase 3 — S4 Sản phẩm (mock UI)

[`/admin/products`](../app/(admin)/admin/products/page.tsx) · [`features/admin-products/`](../features/admin-products/) · single-SKU editor + variants + stock + URL ảnh (chưa Cloudinary).

## Phase 4 — S5 Coupon (mock UI)

[`/admin/coupons`](../app/(admin)/admin/coupons/page.tsx) · [`features/admin-coupons/`](../features/admin-coupons/) · CRUD + bật/tắt.

## Phase 5 — S6 Blog CMS (mock UI)

[`/admin/blog`](../app/(admin)/admin/blog/page.tsx) · [`features/admin-blog/`](../features/admin-blog/) · draft/publish. Storefront blog vẫn mock riêng cho đến API chung.

## Phase 6 — S7 Nội dung tĩnh (mock UI)

[`/admin/content`](../app/(admin)/admin/content/page.tsx) · [`features/admin-content/`](../features/admin-content/) · Policy ×5 (`privacy|terms|shipping|return|payment`) + About. Public policy routes gắn sau.

## Phase 7 — S8 Liên hệ (mock UI)

[`/admin/contact`](../app/(admin)/admin/contact/page.tsx) · [`features/admin-contact/`](../features/admin-contact/) · đọc / xử lý / ghi chú. Form storefront chưa ghi DB.

## Phase 8 — A1 Users (mock UI, Admin only)

[`/admin/users`](../app/(admin)/admin/users/page.tsx) · [`features/admin-users/`](../features/admin-users/) · [`AdminOnlyGate`](../components/admin/AdminOnlyGate.tsx) · đổi role + khóa. Chưa Supabase Auth Admin API.

## Phase 9 — A2 Audit (mock UI, Admin only)

[`/admin/audit`](../app/(admin)/admin/audit/page.tsx) · [`features/admin-audit/`](../features/admin-audit/) · list + lọc (read-only seed).

## API & production hardening (chưa làm)

Client gate + allowlist + mock services — đủ demo, **không** đủ production.

Khi gắn thật:

1. Role từ JWT/DB; middleware chặn `/admin/**`.
2. Đổi thân từng `admin*Service` → `app/api/admin/**` / Supabase.
3. Cloudinary upload (S4); đồng bộ storefront với nguồn admin (blog/product/contact).
4. Audit ghi từ mutate thật (A2).

## Kiểm thử nhanh

- Staff: S2–S8 OK; A1/A2 redirect.
- Admin: toàn bộ module.
- UI không import `*.mock.ts`.
- `npm run build`.
