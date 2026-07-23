import { AdminOnlyGate } from "@/components/admin/AdminOnlyGate";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Khu vực quản trị (A1 Users, A2 Audit) — chỉ Admin. Staff → /staff.
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
