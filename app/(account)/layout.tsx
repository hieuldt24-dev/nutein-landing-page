import Navbar from "@/components/layout/Navbar";
import { FloatingActionDock } from "@/components/ui/FloatingActionDock";

/**
 * Account portal — Navbar + FAB, không Footer (khác marketing).
 * URL vẫn /account, /account/orders.
 */
export default function AccountGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
      <FloatingActionDock />
    </>
  );
}
