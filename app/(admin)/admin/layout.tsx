import { AdminOnlyGate } from "@/components/admin/shell/AdminOnlyGate";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * Khu vực quản trị (Tổng quan + A1 Users + A2 Audit) — chỉ Admin. Staff → /staff.
 * AdminOnlyGate tự xử lý cả 2 tầng: chưa đăng nhập/không phải staff|admin
 * -> "/"; đúng nhóm nhưng là Staff -> "/staff".
 */
export default function AdminGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminOnlyGate>
      <AdminShell>{children}</AdminShell>
    </AdminOnlyGate>
  );
}
