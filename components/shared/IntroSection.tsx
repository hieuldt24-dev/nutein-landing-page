"use client";

import React from "react";
import { Zap, Activity, Heart, Sparkles } from "lucide-react";

const INGREDIENTS = [
  {
    icon: <Zap size={24} />,
    title: "20g Protein Thực Vật",
    desc: "Được chiết xuất tinh khiết từ hạt đậu nành hữu cơ, đậu Hà Lan và hạt óc chó, hỗ trợ tái tạo cơ bắp và duy trì năng lượng suốt ngày dài.",
    bg: "rgba(10, 155, 120, 0.05)",
    border: "rgba(10, 155, 120, 0.15)",
    color: "#0A9B78",
  },
  {
    icon: <Activity size={24} />,
    title: "1 Tỷ Lợi Khuẩn Probiotics",
    desc: "Bổ sung lượng lớn men vi sinh đường ruột giúp tăng cường hệ miễn dịch, kích thích tiêu hóa khỏe mạnh và ngăn ngừa chứng đầy bụng khó tiêu.",
    bg: "rgba(34, 217, 165, 0.05)",
    border: "rgba(34, 217, 165, 0.15)",
    color: "#077A5F",
  },
  {
    icon: <Heart size={24} />,
    title: "5g Chất Xơ Hòa Tan",
    desc: "Hỗ trợ ổn định đường huyết, tạo cảm giác no lâu tự nhiên, kiểm soát cơn thèm ăn hiệu quả và bảo vệ thành mạch tim mạch khỏe mạnh.",
    bg: "rgba(234, 179, 8, 0.05)",
    border: "rgba(234, 179, 8, 0.15)",
    color: "#D97706",
  },
  {
    icon: <Sparkles size={24} />,
    title: "23+ Vitamin & Khoáng Chất",
    desc: "Hội tụ đầy đủ dinh dưỡng từ 10 loại rau củ hữu cơ tươi ngon giúp làm sáng da, chống oxy hóa và bù đắp khoáng chất thiết yếu mỗi ngày.",
    bg: "rgba(59, 130, 246, 0.05)",
    border: "rgba(59, 130, 246, 0.15)",
    color: "#2563EB",
  },
];

export default function IntroSection() {
  return (
    <section
      id="intro"
      style={{
        padding: "90px 24px",
        backgroundColor: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient light */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "-10%",
          width: 350,
          height: 350,
          borderRadius: 9999,
          backgroundColor: "rgba(34, 217, 165, 0.05)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Section Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
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
            Thành phần dinh dưỡng
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 3.5vw, 40px)",
              fontWeight: 900,
              color: "#080E1A",
              fontFamily: "var(--font-display), sans-serif",
              marginTop: 10,
              marginBottom: 16,
              letterSpacing: "-0.03em",
            }}
          >
            Một ly Protein Nutein có gì?
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#6B7280",
              maxWidth: 600,
              margin: "0 auto",
              lineHeight: 1.6,
              fontFamily: "var(--font-sans), sans-serif",
            }}
          >
            Khám phá nguồn dinh dưỡng thực vật dồi dào từ nguyên liệu thật, đem đến giải pháp bổ sung đạm an lành cho cuộc sống bận rộn.
          </p>
        </div>

        {/* Ingredients Grid */}
        <div
          className="ingredients-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 28,
          }}
        >
          {INGREDIENTS.map((item, idx) => (
            <div
              key={idx}
              className="ingredient-card animate-fade-up"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.05)",
                borderRadius: 24,
                padding: 32,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02), 0 2px 4px rgba(0, 0, 0, 0.01)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                animationDelay: `${idx * 0.12}s`,
              }}
            >
              {/* Icon Circle */}
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: item.bg,
                  border: `1px solid ${item.border}`,
                  color: item.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 8px 16px ${item.bg}`,
                }}
              >
                {item.icon}
              </div>

              {/* Text */}
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#080E1A",
                    fontFamily: "var(--font-display), sans-serif",
                    margin: "0 0 10px",
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
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .ingredient-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(10, 155, 120, 0.02) !important;
          border-color: rgba(10, 155, 120, 0.18) !important;
        }
      `}</style>
    </section>
  );
}
