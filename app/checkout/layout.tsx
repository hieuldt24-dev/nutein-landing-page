import type { Metadata } from "next";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";

export const metadata: Metadata = {
  title: "Thanh toán – Nutein",
  description: "Điền thông tin giao hàng và hoàn tất đơn protein thực vật Nutein.",
};

/**
 * Checkout ngoài (marketing) — header tối giản, không Navbar/Footer đầy đủ.
 * AuthModal + CartDrawer vẫn mount từ root layout.
 */
export default function CheckoutLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <CheckoutHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
