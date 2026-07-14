"use client";

import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";

const NAV_LINKS = [
  { label: "Sản phẩm", href: "#san-pham" },
  { label: "Về chúng tôi", href: "#ve-chung-toi" },
  { label: "Kiến thức", href: "#kien-thuc" },
  { label: "Liên hệ", href: "#lien-he" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutate } = useSWRConfig();
  const setAuthOpen = (val: boolean) => mutate("auth-modal", val, { revalidate: false });

  return (
    <header
      id="navbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "rgba(246,249,248,0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 40px",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          id="nav-logo"
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#080E1A",
            textDecoration: "none",
            letterSpacing: "-0.04em",
            flexShrink: 0,
          }}
        >
          Nutein
        </Link>

        {/* Desktop nav links */}
        <ul
          style={{ display: "flex", listStyle: "none", gap: 4, alignItems: "center" }}
          className="hidden md:flex"
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  transition: "color 0.15s ease, background-color 0.15s ease",
                  display: "block",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.color = "#080E1A";
                  el.style.backgroundColor = "rgba(0,0,0,0.05)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.color = "#374151";
                  el.style.backgroundColor = "transparent";
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            id="nav-cart"
            aria-label="Giỏ hàng"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, color: "#374151", display: "flex", alignItems: "center",
              borderRadius: 8, transition: "background-color 0.15s ease",
            }}
            className="hidden md:flex"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>

          <button
            id="nav-user"
            aria-label="Tài khoản"
            onClick={() => setAuthOpen(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, color: "#374151", display: "flex", alignItems: "center",
              borderRadius: 8, transition: "background-color 0.15s ease",
            }}
            className="hidden md:flex"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          <Link
            href="#san-pham"
            id="nav-cta"
            style={{
              background: "linear-gradient(135deg, #0A9B78 0%, #077A5F 100%)",
              color: "#ffffff",
              padding: "9px 20px",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              boxShadow: "0 4px 16px rgba(10,155,120,0.3)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(10,155,120,0.4)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(10,155,120,0.3)";
            }}
          >
            Mua ngay
          </Link>

          {/* Mobile burger */}
          <button
            id="nav-burger"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, color: "#080E1A",
              flexDirection: "column", gap: 5,
            }}
            className="flex md:hidden"
          >
            {[0,1,2].map(i => (
              <span
                key={i}
                style={{
                  display: "block", width: 20, height: 2,
                  backgroundColor: "currentColor", borderRadius: 2,
                  transition: "transform 0.2s, opacity 0.2s",
                  transform: menuOpen
                    ? i === 0 ? "rotate(45deg) translateY(7px)"
                    : i === 2 ? "rotate(-45deg) translateY(-7px)"
                    : "none"
                    : "none",
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            backgroundColor: "rgba(245,250,248,0.97)",
            padding: "12px 24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
          className="md:hidden"
        >
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontSize: 15, fontWeight: 500, color: "#374151",
                textDecoration: "none", padding: "10px 8px",
                borderRadius: 8, borderBottom: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              setAuthOpen(true);
            }}
            style={{
              fontSize: 15, fontWeight: 500, color: "#374151",
              background: "none", border: "none", textAlign: "left",
              padding: "10px 8px", cursor: "pointer",
              borderRadius: 8, borderBottom: "1px solid rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", gap: 8,
              width: "100%",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Tài khoản
          </button>
        </div>
      )}
    </header>
  );
}
