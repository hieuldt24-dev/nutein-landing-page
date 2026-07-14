"use client";

import React from "react";
import { Briefcase, Heart, Flame, ShieldAlert } from "lucide-react";

const PERSONAS = [
  {
    icon: <Briefcase size={26} />,
    title: "Dân Văn Phòng Bận Rộn",
    focus: "Tiết kiệm thời gian",
    desc: "Bữa sáng dinh dưỡng trọn vẹn chỉ trong 2 phút pha nhanh. Đảm bảo đủ đạm và năng lượng sạch để duy trì tỉnh táo suốt ngày làm việc mà không thèm ăn vặt.",
    border: "rgba(10, 155, 120, 0.1)",
    color: "#0A9B78",
  },
  {
    icon: <Flame size={26} />,
    title: "Người Tập Gym, Yoga & Pilates",
    focus: "Phục hồi cơ bắp",
    desc: "Nạp đạm tinh khiết chất lượng cao hỗ trợ xây dựng cơ bắp săn chắc, tăng độ bền bỉ khi tập luyện và hồi phục cơ nhanh chóng sau các buổi tập cường độ cao.",
    border: "rgba(234, 179, 8, 0.1)",
    color: "#D97706",
  },
  {
    icon: <Heart size={26} />,
    title: "Tín Đồ Ăn Chay & Eat Clean",
    focus: "100% Thuần thực vật",
    desc: "Nguồn đạm lý tưởng thay thế thịt cá, hoàn toàn từ hạt tự nhiên. Không chứa lactose, không gluten và không chất bảo quản, tuyệt đối an lành cho cơ thể.",
    border: "rgba(34, 217, 165, 0.1)",
    color: "#077A5F",
  },
  {
    icon: <ShieldAlert size={26} />,
    title: "Gia Đình & Người Lớn Tuổi",
    focus: "Dinh dưỡng dễ tiêu hóa",
    desc: "Nhờ công nghệ thủy phân enzyme thực vật, sản phẩm cực kỳ dễ hấp thu, nhẹ bụng. Thích hợp bổ sung dưỡng chất thiết yếu hàng ngày cho ông bà và cha mẹ.",
    border: "rgba(59, 130, 246, 0.1)",
    color: "#2563EB",
  },
];

export default function TargetAudienceSection() {
  return (
    <section
      id="target-audience"
      style={{
        padding: "100px 24px",
        backgroundColor: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative ambient lighting dots */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "-10%",
          width: 320,
          height: 320,
          borderRadius: 9999,
          backgroundColor: "rgba(234, 179, 8, 0.04)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "-10%",
          width: 320,
          height: 320,
          borderRadius: 9999,
          backgroundColor: "rgba(10, 155, 120, 0.04)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        
        {/* Section Title */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
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
            Phân nhóm đối tượng
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
            Protein Nutein dành cho ai?
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
            Nutein cung cấp nguồn đạm thực vật sạch, lành và dễ tiêu hóa, đáp ứng nhu cầu dinh dưỡng đa dạng của mọi thành viên.
          </p>
        </div>

        {/* Audience Card Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 30,
          }}
        >
          {PERSONAS.map((item, idx) => (
            <div
              key={idx}
              className="audience-card animate-fade-up"
              style={{
                backgroundColor: "#FFFFFF",
                border: `1px solid ${item.border}`,
                borderRadius: 24,
                padding: "36px 32px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.015)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                position: "relative",
                overflow: "hidden",
                animationDelay: `${idx * 0.12}s`,
              }}
            >
              {/* Subtle top visual corner accent */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: 4,
                  backgroundColor: item.color,
                  opacity: 0.8,
                }}
              />

              {/* Icon & Title Row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: "rgba(8, 14, 26, 0.03)",
                    color: item.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: "#080E1A",
                      fontFamily: "var(--font-display), sans-serif",
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.title}
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: item.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-sans), sans-serif",
                      display: "block",
                      marginTop: 2,
                    }}
                  >
                    {item.focus}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: 14,
                  color: "#4B5563",
                  lineHeight: 1.65,
                  margin: 0,
                  fontFamily: "var(--font-sans), sans-serif",
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .audience-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 48px rgba(8, 14, 26, 0.08) !important;
          border-color: rgba(10, 155, 120, 0.2) !important;
        }
      `}</style>
    </section>
  );
}
