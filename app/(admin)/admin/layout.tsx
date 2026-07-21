import Navbar from "@/components/layout/Navbar";
import { FloatingActionDock } from "@/components/ui/FloatingActionDock";
import { AdminAccessGate } from "@/components/admin/AdminAccessGate";

/**
 * Khu vực quản trị — cùng Navbar storefront; gate role staff/admin.
 * Modules S2–S8 / A1–A2 theo docs/admin-portal-roadmap.md.
 */
export default function AdminGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <AdminAccessGate>{children}</AdminAccessGate>
      <FloatingActionDock />
    </>
  );
}
