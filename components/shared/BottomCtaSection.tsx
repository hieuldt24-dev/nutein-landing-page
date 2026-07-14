"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export default function BottomCtaSection() {
  return (
    <section
      id="bottom-cta"
      style={{
        padding: "80px 24px 100px",
        backgroundColor: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }} suppressHydrationWarning>
        
        {/* Main CTA banner container */}
        <div
          className="cta-banner"
          suppressHydrationWarning
          style={{
            background: "linear-gradient(135deg, #055C47 0%, #0A9B78 100%)",
            borderRadius: 36,
            padding: "80px 60px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(10, 155, 120, 0.22)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* Animated decorative shapes inside banner */}
          <div
            suppressHydrationWarning
            style={{
              position: "absolute",
              top: "-20%",
              left: "-10%",
              width: 300,
              height: 300,
              borderRadius: 9999,
              background: "radial-gradient(circle, rgba(34, 217, 165, 0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            suppressHydrationWarning
            style={{
              position: "absolute",
              bottom: "-20%",
              right: "-10%",
              width: 300,
              height: 300,
              borderRadius: 9999,
              background: "radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Heading content */}
          <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }} suppressHydrationWarning>
            <h2
              style={{
                fontSize: "clamp(26px, 3.8vw, 40px)",
                fontWeight: 900,
                color: "#FFFFFF",
                fontFamily: "var(--font-display), sans-serif",
                margin: 0,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              Sẵn sàng nạp nguồn năng lượng sạch từ thực vật?
            </h2>
            <p
              style={{
                fontSize: "clamp(14px, 1.8vw, 16px)",
                color: "rgba(255, 255, 255, 0.85)",
                lineHeight: 1.6,
                marginTop: 16,
                marginBottom: 0,
                fontFamily: "var(--font-sans), sans-serif",
              }}
            >
              Gia nhập lối sống lành mạnh cùng hàng ngàn khách hàng tin dùng Nutein để chăm sóc sức khỏe chủ động mỗi ngày.
            </p>
          </div>

          {/* Action Buttons */}
          <div
            suppressHydrationWarning
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              href="#san-pham"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#055C47",
                padding: "16px 36px",
                borderRadius: 9999,
                fontSize: 15,
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s ease-in-out",
                fontFamily: "var(--font-sans), sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.1)";
              }}
            >
              <ShoppingCart size={18} />
              Mua Ngay Sản Phẩm
            </Link>

            <button
              onClick={() => toast.info("Hệ thống tư vấn viên đang được kết nối.")}
              style={{
                backgroundColor: "transparent",
                color: "#FFFFFF",
                padding: "14px 32px",
                borderRadius: 9999,
                fontSize: 15,
                fontWeight: 700,
                border: "1.5px solid rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s ease-in-out",
                fontFamily: "var(--font-sans), sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#FFFFFF";
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <MessageSquare size={18} />
              Tư vấn trực tiếp
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .cta-banner {
            padding: 48px 24px !important;
            border-radius: 28px !important;
          }
        }
      `}</style>
    </section>
  );
}
