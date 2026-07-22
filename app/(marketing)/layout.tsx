import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { FloatingActionDock } from "@/components/ui/FloatingActionDock";

/**
 * Layout marketing (Home, About, …): Navbar + Footer mount một lần,
 * soft-navigate không remount — giảm jank và giữ state UI (menu, BounceChars).
 * FAB: scroll-to-top mọi size; cart FAB chỉ desktop (mobile cart ở header).
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <FloatingActionDock />
    </>
  );
}

