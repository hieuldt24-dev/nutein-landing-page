"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import { CtaCluster } from "@/components/ui/CtaCluster";
import { BounceChars } from "@/components/ui/BounceChars";
import { useAddToCart } from "@/lib/useAddToCart";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MeshBg() {
  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-soft via-primary-soft/60 to-bg" />
      <div
        className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[85vw] h-[85vw] rounded-full blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, rgba(226,165,80,0.24) 0%, rgba(192,134,53,0.06) 55%, transparent 75%)",
          animation: "ambientPulse 12s infinite ease-in-out alternate",
        }}
      />
      <div
        className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] rounded-full blur-[60px]"
        style={{
          background:
            "radial-gradient(circle, rgba(71,114,54,0.1) 0%, rgba(196,226,147,0.04) 60%, transparent 80%)",
          animation: "ambientPulse 15s infinite ease-in-out alternate-reverse",
        }}
      />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(rgba(53,30,41,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(53,30,41,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function HeroSection() {
  const addToCart = useAddToCart();

  const handleBuyNow = (e: MouseEvent) => {
    e.preventDefault();
    addToCart();
  };

  return (
    <section
      id="hero"
      aria-label="Hero – Nutein Protein thực vật"
      className="hero-section relative min-h-[calc(100vh-40px)] flex flex-col items-center justify-center overflow-hidden pt-[104px] pb-10"
    >
      <MeshBg />

      {/* Oversized headline — bounce per-char kiểu Joy Rush */}
      <h1 className="hero-headline relative z-[2] mt-0 text-center font-black uppercase text-ink leading-[0.9] tracking-[-0.06em] whitespace-nowrap">
        <BounceChars staggerMs={26}>Nạp năng lượng</BounceChars>
      </h1>
      <h1 className="hero-headline hero-headline--accent relative z-[2] -mt-[0.08em] mb-2 text-center font-black uppercase leading-[0.9] tracking-[-0.06em] whitespace-nowrap text-primary-deep">
        <BounceChars staggerMs={26} delayMs={340}>
          100% Protein thực vật
        </BounceChars>
      </h1>

      {/* Product visual + CTA: khoảng thở giữa headline / ảnh / nút */}
      <div className="hero-visual relative z-[2] w-full max-w-[520px] aspect-square -mt-[6%] mb-2 flex flex-col items-center justify-center">
        <div
          aria-hidden
          className="absolute w-[74%] h-[74%] rounded-full blur-[22px] z-0"
          style={{
            background:
              "radial-gradient(circle, rgba(226,165,80,0.3) 0%, rgba(192,134,53,0.08) 50%, transparent 70%)",
            animation: "pulseCircle 5s infinite ease-in-out",
          }}
        />

        <div
          className="relative w-full h-full z-[1]"
          style={{ animation: "heroFloatYSlow 7s ease-in-out infinite" }}
        >
          <Image
            src="/images/herosection.png"
            alt="Nutein Organic Fuel – protein thực vật với nguyên liệu tự nhiên"
            fill
            sizes="(max-width: 900px) 90vw, 560px"
            priority
            className="object-contain object-center"
            style={{
              mixBlendMode: "multiply",
              filter: "drop-shadow(0 32px 64px rgba(192,134,53,0.28))",
              transform: "scale(1.14)",
            }}
          />
        </div>

        {/* CTA — xuống nhẹ so với mép ảnh, tránh dính sát */}
        <div
          className="relative z-[3] -mt-[6%] animate-fade-up"
          style={{ animationDelay: "0.25s" }}
        >
          <CtaCluster
            label="Mua ngay"
            href="/#san-pham"
            onClick={handleBuyNow}
            size={70}
            fontSize={20}
            fontWeight={900}
            labelPaddingX="2.4rem"
            iconSize={26}
          />
        </div>
      </div>
    </section>
  );
}

