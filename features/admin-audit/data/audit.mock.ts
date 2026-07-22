import type { AdminAuditEntry } from "../types";

export const MOCK_ADMIN_AUDIT: AdminAuditEntry[] = [
  {
    id: "aud-1",
    action: "UPDATE",
    tableName: "orders",
    recordId: "adm-ord-2",
    actorEmail: "staff@nutein.com",
    summary: "Đổi trạng thái đơn → processing",
    createdAt: "2026-07-20T10:00:00.000Z",
  },
  {
    id: "aud-2",
    action: "UPDATE",
    tableName: "products",
    recordId: "nutein-protein-thuc-vat",
    actorEmail: "admin@nutein.com",
    summary: "Cập nhật unitPrice / stock",
    createdAt: "2026-07-19T08:00:00.000Z",
  },
  {
    id: "aud-3",
    action: "CREATE",
    tableName: "coupons",
    recordId: "cpn-1",
    actorEmail: "admin@nutein.com",
    summary: "Tạo coupon NUTEIN10",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "aud-4",
    action: "DELETE",
    tableName: "blog_posts",
    recordId: "post-old",
    actorEmail: "staff@nutein.com",
    summary: "Xóa bài nháp lỗi",
    createdAt: "2026-05-20T12:00:00.000Z",
  },
];
