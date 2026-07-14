"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  primary:     "#0A9B78",
  primaryDeep: "#077A5F",
  accent:      "#22D9A5",
  text:        "#080E1A",
  muted:       "#6B7280",
  border:      "rgba(0,0,0,0.07)",
  glass:       "rgba(255,255,255,0.82)",
  glassBorder: "rgba(255,255,255,0.92)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Star() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function RatingRow() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      backgroundColor: T.glass,
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${T.border}`,
      borderRadius: 9999, padding: "8px 16px",
      width: "fit-content",
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    }}>
      <span style={{ display: "flex", gap: 2, alignItems: "center" }}>
        <Star />
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text, marginLeft: 2 }}>4.9/5</span>
      </span>
      <span style={{ width: 1, height: 14, background: T.border }} />
      <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>50,000+ khách hàng tin dùng</span>
      <span style={{ width: 1, height: 14, background: T.border }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, fontWeight: 700, letterSpacing: "0.02em" }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: T.primary, display: "inline-block" }} />
        Non-GMO Certified
      </span>
    </div>
  );
}

function Chip({ icon, label, delay = "0s" }: { icon: React.ReactNode; label: string; delay?: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      backgroundColor: "white", border: `1px solid ${T.border}`,
      borderRadius: 9999, padding: "6px 14px 6px 10px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animationDelay: delay,
    }} className="animate-fade-up chip-hover">
      <span style={{ color: T.primary, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function FloatingBadge({
  children, style, delay = "0s", className = "",
}: {
  children: React.ReactNode; style?: React.CSSProperties;
  delay?: string; className?: string;
}) {
  return (
    <div
      className={`animate-float animate-badge-pop ${className}`.trim()}
      style={{
        position: "absolute",
        zIndex: 10,
        animationDelay: delay,
        ...style,
      }}
    >
      <div
        className="hover-badge-interactive"
        style={{
          backgroundColor: T.glass, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${T.glassBorder}`, borderRadius: 18,
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function IconBox({ bg, children, size = 34, radius = 10 }: {
  bg: string; children: React.ReactNode; size?: number; radius?: number;
}) {
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {children}
    </span>
  );
}

function MeshBg() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Base modern off-white background with a hint of sage */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#F5F8F7" }} />
      
      {/* Aurora glow blobs */}
      <div style={{
        position: "absolute",
        top: "-10%",
        left: "-10%",
        width: "60vw",
        height: "60vw",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34, 217, 165, 0.08) 0%, rgba(10, 155, 120, 0.02) 60%, transparent 80%)",
        filter: "blur(50px)",
        animation: "ambientPulse 12s infinite ease-in-out alternate",
      }} />
      
      <div style={{
        position: "absolute",
        bottom: "-10%",
        right: "-10%",
        width: "50vw",
        height: "50vw",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(234, 179, 8, 0.06) 0%, rgba(254, 243, 199, 0.01) 60%, transparent 80%)",
        filter: "blur(60px)",
        animation: "ambientPulse 15s infinite ease-in-out alternate-reverse",
      }} />

      {/* Grid overlay texture */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(10,155,120,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(10,155,120,0.012) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        opacity: 0.9,
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function HeroSection() {
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Symmetrical layout tokens for floating badges (relative to square wrapper)
  const badgeTop = "6%";
  const badgeBottom = "6%";
  const badgeXSide = "-18%";

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 620) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      id="hero"
      aria-label="Hero – Nutein Protein thực vật"
      style={{
        position: "relative",
        minHeight: "calc(100vh - 68px)",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <MeshBg />

      <div
        className="hero-grid"
        style={{
          position: "relative", zIndex: 1,
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 24px",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 48,
          alignItems: "center",
        }}
      >

        {/* ══════════════════════════════════════════
            COLUMN 1 – LEFT – Text content
        ══════════════════════════════════════════ */}
        <div
          className="hero-text-col"
          style={{
            display: "flex", flexDirection: "column", gap: 20,
            padding: "60px 0",
            position: "relative", zIndex: 2,
          }}
        >
          {/* Social proof */}
          <RatingRow />

          {/* Headline */}
          <div>
            <h1 style={{
              fontSize: "clamp(42px, 4.4vw, 68px)",
              fontWeight: 900, color: T.text,
              lineHeight: 1.05, letterSpacing: "-0.05em",
            }}>
              Nạp năng lượng từ{" "}
              <span style={{
                background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                100% Protein
              </span>
              <br />thực vật
            </h1>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href="#san-pham" id="hero-cta-primary"
              className="pulse-button-glow"
              style={{
                background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
                color: "#fff", padding: "18px 42px", borderRadius: 9999,
                fontSize: 17, fontWeight: 900, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 10px 30px rgba(10,155,120,0.38)",
                letterSpacing: "-0.01em",
                transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-3px) scale(1.05)";
                el.style.boxShadow = "0 20px 45px rgba(10,155,120,0.55)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "";
                el.style.boxShadow = "0 10px 30px rgba(10,155,120,0.38)";
              }}
            >
              Mua ngay
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="#kien-thuc" id="hero-cta-secondary"
              style={{
                backgroundColor: "transparent", color: T.text,
                padding: "15px 32px", borderRadius: 9999,
                fontSize: 16, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
                border: "1.5px solid rgba(0,0,0,0.14)", letterSpacing: "-0.01em",
                transition: "border-color 0.18s, color 0.18s, background-color 0.18s, transform 0.18s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = T.primary; el.style.color = T.primary;
                el.style.backgroundColor = "rgba(10,155,120,0.05)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(0,0,0,0.14)"; el.style.color = T.text;
                el.style.backgroundColor = "transparent"; el.style.transform = "";
              }}
            >
              Khám phá sản phẩm
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Benefit chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Chip delay="0.05s" label="20g Protein" icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            } />
            <Chip delay="0.1s" label="100% Vegan" icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            } />
            <Chip delay="0.15s" label="Không chất bảo quản" icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            } />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            COLUMN 2 – RIGHT – Product image (large)
        ══════════════════════════════════════════ */}
        <div
          className="hero-img-col"
          style={{
            position: "relative",
            height: "100%",
            minHeight: "calc(100vh - 68px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Centered Square Image Container */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 500,
              aspectRatio: "1 / 1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "floatYSlow 7s ease-in-out infinite",
            }}
          >
            {/* Glowing Ring/Aura behind the product cup */}
            <div style={{
              position: "absolute",
              width: "72%",
              height: "72%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(34,217,165,0.22) 0%, rgba(10,155,120,0.06) 50%, transparent 70%)",
              zIndex: 0,
              filter: "blur(18px)",
              animation: "pulseCircle 5s infinite ease-in-out",
            }} />

            {/* The relative context box for Next.js Image fill */}
            <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 1 }}>
              <Image
                src="/images/herosection.png"
                alt="Nutein Organic Fuel – protein thực vật với nguyên liệu tự nhiên"
                fill
                sizes="(max-width: 900px) 100vw, 500px"
                priority
                style={{
                  objectFit: "contain",
                  objectPosition: "center center",
                  mixBlendMode: "multiply",
                  filter: "drop-shadow(0 24px 56px rgba(10,155,120,0.18))",
                  transform: "scale(1.10)",
                }}
              />
            </div>

            {/* ── Floating badges (nested inside square container) ── */}

            {/* 1. Top-left: Thuần tự nhiên */}
            <FloatingBadge style={{ top: badgeTop, left: badgeXSide, zIndex: 5 }} delay="0.4s" className="hero-badge">
              <IconBox bg="linear-gradient(135deg, #D1FAE5, #A7F3D0)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                </svg>
              </IconBox>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>Thuần tự nhiên</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: "var(--font-sans), sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>100% Natural</div>
              </div>
            </FloatingBadge>

            {/* 2. Top-right: 20g Protein */}
            <FloatingBadge style={{ top: badgeTop, right: badgeXSide, zIndex: 5 }} delay="0.6s" className="hero-badge">
              <IconBox bg="linear-gradient(135deg, #EDE9FE, #DDD6FE)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </IconBox>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>20g Protein</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: "var(--font-sans), sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>Plant-Based</div>
              </div>
            </FloatingBadge>

            {/* 3. Bottom-left: 120 kcal */}
            <FloatingBadge style={{ bottom: badgeBottom, left: badgeXSide, zIndex: 5 }} delay="0.8s" className="hero-badge">
              <IconBox bg="linear-gradient(135deg, #FEF3C7, #FDE68A)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </IconBox>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>120 kcal</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: "var(--font-sans), sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>/ ly tiêu chuẩn</div>
              </div>
            </FloatingBadge>

            {/* 4. Bottom-right: 0g Sugar */}
            <FloatingBadge style={{ bottom: badgeBottom, right: badgeXSide, zIndex: 5 }} delay="1.0s" className="hero-badge">
              <IconBox bg="linear-gradient(135deg, #DBEAFE, #BFDBFE)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </IconBox>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>0g Sugar Added</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: "var(--font-sans), sans-serif", fontWeight: 600, letterSpacing: "0.02em" }}>Ngọt thanh tự nhiên</div>
              </div>
            </FloatingBadge>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA Bar */}
      {showStickyCta && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(255, 255, 255, 0.90)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: `1px solid ${T.border}`,
            padding: "12px 24px",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
            animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
          className="md:hidden"
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>Nutein Protein</div>
            <div style={{ fontSize: 11, color: T.primary, fontWeight: 700, fontFamily: "var(--font-sans), sans-serif" }}>100% Thực vật tinh khiết</div>
          </div>
          <Link
            href="#san-pham"
            style={{
              background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(10,155,120,0.3)",
              fontFamily: "var(--font-sans), sans-serif",
            }}
          >
            Mua ngay
          </Link>
        </div>
      )}

      {/* Scroll indicator */}
      <div
        className="hidden md:flex"
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          opacity: 0.6,
          zIndex: 10,
          animation: "fadeInDelay 2s ease-in-out forwards",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.18em", fontFamily: "var(--font-sans), sans-serif" }}>Cuộn để khám phá</span>
        <div style={{
          width: 20,
          height: 32,
          borderRadius: 99,
          border: `2px solid ${T.primary}`,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          paddingTop: 6,
        }}>
          <div style={{
            width: 4,
            height: 8,
            borderRadius: 99,
            backgroundColor: T.primary,
            animation: "scrollDot 1.6s infinite ease-in-out",
          }} />
        </div>
      </div>

      <style>{`
        @keyframes floatYSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-8px) rotate(0.5deg); }
          66%       { transform: translateY(-4px) rotate(-0.5deg); }
        }
        @keyframes ambientPulse {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -30px) scale(1.08); }
        }
        @keyframes pulseCircle {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes scrollDot {
          0% { transform: translateY(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 0; }
        }
        @keyframes fadeInDelay {
          from { opacity: 0; }
          to { opacity: 0.6; }
        }
        .chip-hover {
          transition: all 0.25s ease-in-out !important;
          cursor: pointer;
        }
        .chip-hover:hover {
          transform: translateY(-2px) scale(1.03) !important;
          border-color: #0A9B78 !important;
          box-shadow: 0 6px 16px rgba(10,155,120,0.12) !important;
          background-color: rgba(10,155,120,0.02) !important;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) both; }

        /* Pulsing Glow Animation for Primary Button */
        .pulse-button-glow {
          position: relative;
          overflow: hidden;
          animation: pulseGlow 2.5s infinite alternate ease-in-out;
        }
        @keyframes pulseGlow {
          0% {
            box-shadow: 0 6px 20px rgba(10,155,120,0.3);
          }
          100% {
            box-shadow: 0 12px 35px rgba(34,217,165,0.6), 0 0 15px rgba(34,217,165,0.3);
          }
        }
        .pulse-button-glow::after {
          content: '';
          position: absolute;
          top: -50%; left: -60%;
          width: 30%; height: 200%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(25deg);
          animation: shimmerSweep 4s infinite linear;
        }
        @keyframes shimmerSweep {
          0% { left: -60%; }
          30%, 100% { left: 140%; }
        }

        /* Interactive Badge Scaling & Shadow */
        .hover-badge-interactive {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, border-color 0.3s !important;
          cursor: pointer;
        }
        .hover-badge-interactive:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 12px 36px rgba(10,155,120,0.18), 0 2px 10px rgba(0,0,0,0.04) !important;
          border-color: rgba(10,155,120,0.3) !important;
        }

        /* Sticky CTA slide up animation */
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-text-col {
            padding: 48px 24px 32px !important;
            align-items: center !important;
            text-align: center !important;
            order: 1;
          }
          .hero-text-col > div { justify-content: center !important; }
          .hero-img-col {
            min-height: 360px !important;
            order: 2;
          }
          .hero-badge { display: none !important; }
        }
        @media (max-width: 480px) {
          .hero-text-col { padding: 36px 20px 24px !important; }
          .hero-img-col  { min-height: 280px !important; }
        }
      `}</style>
    </section>
  );
}
