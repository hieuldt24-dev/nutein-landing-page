"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Điều khoản", href: "#" },
  { label: "Bảo mật", href: "#" },
  { label: "Hoàn trả", href: "#" },
  { label: "Tuyển dụng", href: "#" },
];

export default function Footer() {
  return (
    <footer
      id="footer"
      style={{
        backgroundColor: "#f7fbfe",
        borderTop: "1px solid #e2e8f0",
        padding: "28px 24px",
      }}
    >
      <div
        suppressHydrationWarning
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* Left */}
        <div suppressHydrationWarning>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0d1b2a", marginBottom: 4 }} suppressHydrationWarning>
            Nutein
          </div>
          <p style={{ fontSize: 13, color: "#8a9ab0" }}>
            © 2024 Nutein. Bảo tồn giá trị thực vật.
          </p>
        </div>

        {/* Right links */}
        <nav aria-label="Footer navigation">
          <ul style={{ display: "flex", listStyle: "none", gap: 24, flexWrap: "wrap" }}>
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#4a5568",
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "#0c9e82")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "#4a5568")
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
