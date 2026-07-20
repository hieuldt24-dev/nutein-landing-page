import type { Metadata } from "next";
import { Quicksand, Mulish } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nutein – Nạp năng lượng từ 100% Protein thực vật",
  description:
    "Khởi đầu ngày mới tràn đầy sức sống với nguồn dinh dưỡng thuần khiết từ thiên nhiên. Nutein giúp bạn luôn khoẻ mạnh dù bận rộn nhất.",
  keywords: ["protein thực vật", "dinh dưỡng", "organic", "nutein", "non-gmo"],
  openGraph: {
    title: "Nutein – 100% Protein thực vật",
    description: "Nguồn dinh dưỡng thuần khiết từ thiên nhiên.",
    locale: "vi_VN",
    type: "website",
  },
  icons: {
    icon: "/images/favicon-color-3232-10x_2.svg",
  },
};

import { SWRProvider } from "@/components/providers/SWRProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import AuthModal from "@/components/shared/AuthModal";
import CartDrawer from "@/components/shared/CartDrawer";
import { AppToaster } from "@/components/ui/AppToaster";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      className={`${quicksand.variable} ${mulish.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col font-sans [&_>_*]:shrink-0"
        suppressHydrationWarning
      >
        <SWRProvider>
          <AuthProvider>
            {children}
            <AuthModal />
            <CartDrawer />
            <AppToaster />
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
