"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { CtaCluster } from "@/components/ui/CtaCluster";

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
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowStickyCta(window.scrollY > 620);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      id="hero"
      aria-label="Hero – Nutein Protein thực vật"
      className="hero-section relative min-h-[calc(100vh-40px)] flex flex-col items-center justify-center overflow-hidden pt-[104px] pb-10"
    >
      <MeshBg />

      {/* Oversized headline — editorial style, uppercase */}
      <h1 className="hero-headline relative z-[2] mt-6 text-center font-black uppercase text-ink leading-[0.9] tracking-[-0.06em] whitespace-nowrap">
        Nạp năng lượng
      </h1>
      <h1 className="hero-headline hero-headline--accent relative z-[2] -mt-[0.08em] text-center font-black uppercase leading-[0.9] tracking-[-0.06em] whitespace-nowrap text-primary-deep">
        100% Protein thực vật
      </h1>

      {/* Product visual */}
      <div className="hero-visual relative z-[2] w-full max-w-[520px] aspect-square -mt-[3%] mb-1 flex items-center justify-center">
        <div
          className="absolute w-[74%] h-[74%] rounded-full blur-[22px] z-0"
          style={{
            background:
              "radial-gradient(circle, rgba(226,165,80,0.3) 0%, rgba(192,134,53,0.08) 50%, transparent 70%)",
            animation: "pulseCircle 5s infinite ease-in-out",
          }}
        />

        <div
          className="relative w-full h-full z-[1]"
          style={{ animation: "floatYSlow 7s ease-in-out infinite" }}
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
      </div>

      {/* CTA Cluster — JoyRush style: text pill + circle arrow, swap on hover */}
      <div className="relative z-[2] mt-5 animate-fade-up" style={{ animationDelay: "0.25s" }}>
        <CtaCluster label="Mua ngay" href="#san-pham" size={52} />
      </div>

      {/* Mobile Sticky CTA Bar */}
      {showStickyCta && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-[color:var(--color-border)] px-6 py-3 z-[100] flex items-center justify-between shadow-[0_-4px_24px_rgba(53,30,41,0.08)]"
          style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div>
            <div className="text-sm font-black text-ink tracking-[-0.02em] font-display">Nutein Protein</div>
            <div className="text-[11px] text-primary-deep font-bold">100% Thực vật tinh khiết</div>
          </div>
          <Link
            href="#san-pham"
            className="bg-gradient-to-br from-primary to-primary-deep text-white px-6 py-2.5 rounded-full text-[13px] font-extrabold shadow-brand"
          >
            Mua ngay
          </Link>
        </div>
      )}

      <style>{`
        .hero-headline {
          font-size: clamp(44px, 8.6vw, 116px);
        }
        .hero-headline--accent {
          font-size: clamp(38px, 7.6vw, 100px);
        }
        @keyframes floatYSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(1deg); }
          66%       { transform: translateY(-7px) rotate(-1deg); }
        }
        @keyframes ambientPulse {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -30px) scale(1.08); }
        }
        @keyframes pulseCircle {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .hero-headline { white-space: normal !important; font-size: clamp(32px, 9vw, 56px) !important; }
          .hero-headline--accent { white-space: normal !important; font-size: clamp(28px, 8vw, 48px) !important; }
          .hero-visual { max-width: 380px !important; margin-top: -2% !important; }
        }
        @media (max-width: 480px) {
          .hero-visual { max-width: 300px !important; }
        }
      `}</style>
    </section>
  );
}
