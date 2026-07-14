"use client";

import React from "react";
import { Leaf, Award, CheckCircle } from "lucide-react";

const DIFFERENCES = [
  {
    icon: <Leaf size={28} />,
    title: "100% Nguyên Liệu Thật (Real Food)",
    desc: "Nói không với bột sữa động vật, chất độn rẻ tiền và hương liệu hóa học. Vị ngọt thanh tao của Nutein hoàn toàn từ cỏ ngọt Stevia và các loại hạt tự nhiên, mang lại hương vị ngậy bùi đặc trưng mà không ngấy.",
    tag: "Đinh vị sạch",
  },
  {
    icon: <Award size={28} />,
    title: "Chiết Xuất Enzyme Hấp Thu Nhanh",
    desc: "Ứng dụng công nghệ thủy phân bằng enzyme thực vật tiên tiến, phân tách các chuỗi đạm lớn thành peptide siêu nhỏ. Giúp cơ thể hấp thu trọn vẹn chỉ sau 30 phút mà không gây nóng trong hay chướng bụng khó chịu.",
    tag: "Khoa học đột phá",
  },
  {
    icon: <CheckCircle size={28} />,
    title: "Canh Tác Hữu Cơ & Truy Xuất Rõ Ràng",
    desc: "Toàn bộ nguyên liệu hạt đậu nành, đậu Hà Lan, óc chó và rau củ quả đều được tuyển chọn kỹ càng từ các nông trại sạch đạt tiêu chuẩn hữu cơ, cam kết Non-GMO và tuyệt đối không tồn dư hóa chất bảo vệ thực vật.",
    tag: "Cam kết 100% Organic",
  },
];

export default function DifferentiatorsSection() {
  return (
    <section
      id="differentiators"
      style={{
        padding: "100px 24px",
        backgroundColor: "#F6F9F8", // Soft green/sage background tint
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative ambient color blur */}
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "-5%",
          width: 400,
          height: 400,
          borderRadius: 9999,
          backgroundColor: "rgba(10, 155, 120, 0.04)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        
        {/* Asymmetric Header Structure */}
        <div
          className="differentiators-header"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 40,
            alignItems: "end",
            marginBottom: 64,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0A9B78",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                fontFamily: "var(--font-sans), sans-serif",
              }}
            >
              Triết lý phát triển
            </span>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 900,
                color: "#080E1A",
                fontFamily: "var(--font-display), sans-serif",
                marginTop: 10,
                marginBottom: 0,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              Vì sao Protein Nutein khác biệt?
            </h2>
          </div>
          <div>
            <p
              style={{
                fontSize: 16,
                color: "#4B5563",
                lineHeight: 1.7,
                margin: 0,
                fontFamily: "var(--font-sans), sans-serif",
              }}
            >
              Chúng tôi tin rằng cơ thể bạn xứng đáng nhận được nguồn dinh dưỡng lành mạnh nhất. Không chỉ cung cấp năng lượng sạch, Nutein là lời cam kết bền vững cho sức khỏe của bạn và hệ sinh thái thiên nhiên.
            </p>
          </div>
        </div>

        {/* Features Column Layout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {DIFFERENCES.map((item, idx) => (
            <div
              key={idx}
              className="diff-row animate-fade-up"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid rgba(10, 155, 120, 0.06)",
                borderRadius: 28,
                padding: "40px 48px",
                display: "grid",
                gridTemplateColumns: "80px 1.5fr 1fr",
                gap: 32,
                alignItems: "center",
                boxShadow: "0 4px 20px rgba(10, 155, 120, 0.015)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                animationDelay: `${idx * 0.15}s`,
              }}
            >
              {/* Left: Icon circle */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: "rgba(10, 155, 120, 0.07)",
                  color: "#0A9B78",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 20px rgba(10, 155, 120, 0.05)",
                }}
              >
                {item.icon}
              </div>

              {/* Middle: Title & Description */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#080E1A",
                    fontFamily: "var(--font-display), sans-serif",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#4B5563",
                    lineHeight: 1.6,
                    margin: 0,
                    fontFamily: "var(--font-sans), sans-serif",
                  }}
                >
                  {item.desc}
                </p>
              </div>

              {/* Right: Premium Tag/Label */}
              <div style={{ justifySelf: "end" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 750,
                    color: "#077A5F",
                    backgroundColor: "rgba(10, 155, 120, 0.08)",
                    padding: "8px 18px",
                    borderRadius: 99,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFamily: "var(--font-sans), sans-serif",
                  }}
                >
                  {item.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .diff-row:hover {
          transform: scale(1.01) translateY(-2px);
          box-shadow: 0 20px 40px rgba(10, 155, 120, 0.08) !important;
          border-color: rgba(10, 155, 120, 0.25) !important;
          background-color: #FAFCFB !important;
        }
        
        @media (max-width: 900px) {
          .differentiators-header {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .diff-row {
            grid-template-columns: 1fr !important;
            padding: 32px 28px !important;
            gap: 20px !important;
          }
          .diff-row > div:last-child {
            justify-self: start !important;
            margin-top: 8px;
          }
        }
      `}</style>
    </section>
  );
}
