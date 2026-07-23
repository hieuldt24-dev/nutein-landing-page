# Admin Portal Roadmap — Nutein

Tài liệu này mô tả lộ trình khu vực quản trị (Staff / Admin).
Đối chiếu: [`PROJECT_REQUIREMENTS.md`](../PROJECT_REQUIREMENTS.md) mục 7.

## Nguyên tắc sản phẩm

- Staff/Admin vào cùng storefront; login chung [`AuthModal`](../components/shared/AuthModal.tsx).
- Entry: **Quản Trị** trong mega Khám phá khi `staff|admin` — trỏ động theo role (`/staff` hoặc `/admin`).
- Route: **tách 2 namespace riêng theo role**, không dùng chung shell route — `/staff` (S2–S8, Staff) và `/admin` (Tổng quan + A1 Users + A2 Audit, Admin) — cùng shell sidebar [`AdminShell`](../components/admin/shell/AdminShell.tsx) (không Navbar storefront). Nút **Về cửa hàng** → `/`.
- **Tách quyền:** Staff = S2–S8 (vận hành, ở `/staff/**`). Admin = Tổng quan (doanh thu + users + audit) + A1 Users + A2 Audit (không kế thừa staff ops, ở `/admin/**`). Gate: [`StaffOnlyGate`](../components/admin/shell/StaffOnlyGate.tsx) / [`AdminOnlyGate`](../components/admin/shell/AdminOnlyGate.tsx).

## Phase 0 — Nền tảng (xong)

Role từ `public.users` qua `POST /api/auth/session` → SWR `auth-role` + gate `StaffOnlyGate`/`AdminOnlyGate` ở layout mỗi khu vực (đã bỏ `AdminAccessGate` — dư thừa sau khi tách route, 2 gate trên đã tự đủ). Không còn email allowlist mock.

## Phase 1 — Dashboard (mock UI)

- Staff [`/staff`](../app/(staff)/staff/page.tsx): doanh thu chính + chỉ số vận hành phụ · [`DashboardRevenuePanel`](../components/admin/dashboard/DashboardRevenuePanel.tsx) · [`AdminDashboardSummary`](../components/admin/dashboard/AdminDashboardSummary.tsx) · [`features/admin-dashboard/`](../features/admin-dashboard/)
- Admin [`/admin`](../app/(admin)/admin/page.tsx): doanh thu + users snapshot + audit gần đây · cùng `features/admin-dashboard/` (`getAdminHome`)

## Phase 2 — S3 Đơn hàng (mock UI)

[`/staff/orders`](../app/(staff)/staff/orders/page.tsx) · [`features/admin-orders/`](../features/admin-orders/)

## Phase 3 — S4 Sản phẩm (mock UI)

[`/staff/products`](../app/(staff)/staff/products/page.tsx) · [`features/admin-products/`](../features/admin-products/) · single-SKU editor + variants + stock + URL ảnh (chưa Cloudinary).

## Phase 4 — S5 Coupon (mock UI)

[`/staff/coupons`](../app/(staff)/staff/coupons/page.tsx) · [`features/admin-coupons/`](../features/admin-coupons/) · CRUD + bật/tắt.

## Phase 5 — S6 Blog CMS (mock UI)

[`/staff/blog`](../app/(staff)/staff/blog/page.tsx) · [`features/admin-blog/`](../features/admin-blog/) · draft/publish. Storefront blog vẫn mock riêng cho đến API chung.

## Phase 6 — S7 Nội dung tĩnh (mock UI)

[`/staff/content`](../app/(staff)/staff/content/page.tsx) · [`features/admin-content/`](../features/admin-content/) · Policy ×5 (`privacy|terms|shipping|return|payment`) + About. Public policy routes gắn sau.

## Phase 7 — S8 Liên hệ (mock UI)

[`/staff/contact`](../app/(staff)/staff/contact/page.tsx) · [`features/admin-contact/`](../features/admin-contact/) · đọc / xử lý / ghi chú. Form storefront chưa ghi DB.

## Phase 8 — A1 Users (mock UI, Admin only)

[`/admin/users`](../app/(admin)/admin/users/page.tsx) · [`features/admin-users/`](../features/admin-users/) · [`AdminOnlyGate`](../components/admin/shell/AdminOnlyGate.tsx) · đổi role + khóa. Chưa Supabase Auth Admin API.

## Phase 9 — A2 Audit (mock UI, Admin only)

[`/admin/audit`](../app/(admin)/admin/audit/page.tsx) · [`features/admin-audit/`](../features/admin-audit/) · list + lọc (read-only seed).

## API & production hardening

Client gate + role DB + mock admin data services — đủ demo UI admin, **không** đủ production data.

1. ~~Proxy chặn `/staff/**`, `/admin/**` bằng JWT role~~ — **xong**, xem `proxy.ts` (`guardAdminArea`) — optimistic check ở edge, mirror đúng `StaffOnlyGate`/`AdminOnlyGate`. Chưa thay thế được check thật khi route API dưới đây tồn tại.
2. Đổi thân từng `admin*Service` → route API thật + Supabase. Namespace API gợi ý mirror route UI: `app/api/staff/**` (orders/products/coupons/blog/content/contact) + `app/api/admin/**` (users/audit) — hiện `features/admin-orders/` còn 2 dòng comment cũ nhắc `app/api/admin/orders/**`, cần đổi thành `app/api/staff/orders/**` khi làm bước này.
3. Cloudinary upload (S4); đồng bộ storefront với nguồn admin (blog/product/contact).
4. Audit ghi từ mutate thật (A2).

## Kiểm thử nhanh

- Staff: `/staff` + S2–S8 OK; `/admin/**` bị đá về `/staff`.
- Admin: `/admin` (Tổng quan), `/admin/users`, `/admin/audit` OK; `/staff/**` bị đá về `/admin`.
- Chưa đăng nhập / role USER: cả `/staff` và `/admin/**` đá về `/`.
- UI không import `*.mock.ts`.
- `npm run build`.
