import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Khu vực vận hành (S2–S8) — chỉ Staff. Admin → /admin/users.
 * StaffOnlyGate tự xử lý cả 2 tầng: chưa đăng nhập/không phải staff|admin
 * -> "/"; đúng nhóm nhưng là Admin -> "/admin/users".
 */
export default function StaffGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StaffOnlyGate>
      <AdminShell>{children}</AdminShell>
    </StaffOnlyGate>
  );
}
