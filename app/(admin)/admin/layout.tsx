import { AdminAccessGate } from "@/components/admin/AdminAccessGate";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Khu vực quản trị — shell sidebar (không Navbar/FAB storefront).
 * Gate role staff/admin; modules theo docs/admin-portal-roadmap.md.
 */
export default function AdminGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminAccessGate>
      <AdminShell>{children}</AdminShell>
    </AdminAccessGate>
  );
}
