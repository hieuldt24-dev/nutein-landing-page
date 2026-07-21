# Admin Portal Roadmap — Nutein

Tài liệu này mô tả lộ trình khu vực quản trị (Staff / Admin) sau Phase 0.
Đối chiếu yêu cầu gốc: [`PROJECT_REQUIREMENTS.md`](../PROJECT_REQUIREMENTS.md) mục 7.

## Nguyên tắc sản phẩm (không đổi)

- Staff/Admin **vào cùng storefront** Nutein như khách (Home, Product, Cart, Checkout, Blog, Account…).
- **Login chung** [`AuthModal`](../components/shared/AuthModal.tsx) — không form login admin riêng.
- Tài khoản Staff/Admin **cấp sẵn** (allowlist / DB). Đăng ký công khai luôn là `role: user`.
- Entry UI: mục **Quản Trị** trong mega **Khám phá** (chỉ hiện khi `staff|admin`).
- Route quản trị: `/admin` (có thể tách subdomain sau).

## Phase 0 — Nền tảng (đã triển khai)

| Hạng mục | Chi tiết |
| :--- | :--- |
| Role | `AuthUser.role`: `user` \| `staff` \| `admin` |
| Seed mock | `features/auth/data/staff-accounts.mock.ts` (`staff@nutein.com`, `admin@nutein.com`) |
| Service boundary | `authService.resolveRole` / `canAccessAdmin` — UI không import mock |
| Nav | Link Quản Trị trong `NavExploreMega` + menu mobile |
| Shell | `/admin` + `AdminAccessGate` (client session) |
| Storefront | Staff/Admin vẫn dùng flow khách bình thường |

**S1 (REQUIREMENTS):** hiểu là “xác thực trước khi vào `/admin`” qua AuthModal + role — **không** UI login thứ hai.

## Phase tiếp theo (modules)

Thứ tự gợi ý — có thể song song khi có API:

| Phase | Mã | Module | Ghi chú |
| :--- | :--- | :--- | :--- |
| 1 | S2 | Dashboard tổng quan | Số đơn mới, đơn cần xử lý, contact chưa đọc, tồn kho thấp |
| 2 | S3 | Quản lý đơn hàng | List/filter, chi tiết, chuyển trạng thái, lịch sử |
| 3 | S4 | Quản lý sản phẩm | Single-SKU Nutein + biến thể gói; giá, tồn, mô tả, ảnh |
| 4 | S5 | Coupon | Tạo/sửa/bật–tắt; % hoặc số tiền; hạn dùng |
| 5 | S6 | Blog CMS | Draft/publish, category/tag |
| 6 | S7 | Nội dung tĩnh | Policy ×5 + About |
| 7 | S8 | Hộp thư Liên hệ | Đọc/xử lý/ghi chú nội bộ |
| 8 | A1 | Quản lý người dùng | **Admin only** — đổi role, khóa TK |
| 9 | A2 | Audit log | **Admin only** — lịch sử CUD |

Mỗi module: `features/<name>/` + `app/(admin)/admin/<route>/` + API `app/api/admin/...` khi cần server.

## API & production hardening

Phase 0 dùng **Supabase session + client gate + allowlist email** — đủ demo, **không** đủ security production.

Khi gắn API thật:

1. Login AuthModal → `POST /api/auth/login` trả user + **role** (JWT/cookie httpOnly).
2. Bỏ / cô lập mock allowlist; `authService.resolveRole` đọc từ response server (hoặc claims).
3. Thêm **Next.js middleware** (hoặc server layout) chặn `/admin/**` nếu thiếu role `staff|admin`.
4. UI ẩn link Quản Trị **không** thay thế kiểm tra server.
5. RBAC theo endpoint (Staff không gọi A1/A2).
6. Audit (A2) ghi khi mutate dữ liệu quan trọng.

## Kiểm thử nhanh Phase 0

- Login email thường → không thấy Quản Trị; `/admin` → redirect `/`.
- Login `staff@nutein.com` / `admin@nutein.com` → thấy Quản Trị → shell; vẫn mua hàng / `/account`.
- `npm run build` + smoke `next start`.
