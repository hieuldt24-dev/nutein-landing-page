import { StaffOnlyGate } from "@/components/admin/shell/StaffOnlyGate";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * Khu vực vận hành (S2–S8) — chỉ Staff. Admin → /admin.
 * StaffOnlyGate tự xử lý cả 2 tầng: chưa đăng nhập/không phải staff|admin
 * -> "/"; đúng nhóm nhưng là Admin -> "/admin".
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
