"use client";

import React from "react";
import { Smile, Shield, Sparkles, Globe } from "lucide-react";

const BENEFITS = [
  {
    icon: <Smile size={24} />,
    title: "Nhẹ bụng, Dễ tiêu hóa",
    desc: "Không chứa Lactose và Gluten - hai tác nhân chính gây chướng bụng. Nhờ đạm peptide siêu nhỏ từ hạt hữu cơ thủy phân, bạn sẽ cảm thấy bụng luôn êm dịu, dễ chịu.",
  },
  {
    icon: <Shield size={24} />,
    title: "Bảo vệ hệ tim mạch",
    desc: "Hàm lượng Cholesterol bằng 0 cùng nguồn chất béo chưa bão hòa dồi dào từ hạt óc chó giúp làm sạch mạch máu, kiểm soát huyết áp và bảo vệ trái tim khỏe mạnh.",
  },
  {
    icon: <Sparkles size={24} />,
    title: "Trẻ hóa làn da, Giữ vóc dáng",
    desc: "Chứa nhiều chất chống oxy hóa tự nhiên và vitamin E từ rau củ quả giúp nuôi dưỡng làn da sáng khỏe, đồng thời hỗ trợ kiểm soát calo nạp vào cho vóc dáng thon gọn.",
  },
  {
    icon: <Globe size={24} />,
    title: "Bền vững cho môi trường",
    desc: "Canh tác nguồn đạm thực vật tiêu tốn ít hơn 90% lượng nước và tạo ra lượng khí thải nhà kính cực thấp so với đạm động vật, góp phần bảo vệ hành tinh xanh.",
  },
];

export default function BenefitsSection() {
  return (
    <section
      id="benefits"
      style={{
        padding: "100px 24px",
        backgroundColor: "#F6F9F8", // Sage green tint
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div
          className="benefits-split"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 60,
            alignItems: "center",
          }}
        >
          {/* Column 1: Text list of benefits */}
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
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
                Giá trị sức khỏe
              </span>
              <h2
                style={{
                  fontSize: "clamp(28px, 3.8vw, 42px)",
                  fontWeight: 900,
                  color: "#080E1A",
                  fontFamily: "var(--font-display), sans-serif",
                  marginTop: 10,
                  marginBottom: 16,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                }}
              >
                Lợi ích vượt trội từ đạm thực vật sạch
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: "#4B5563",
                  lineHeight: 1.6,
                  margin: 0,
                  fontFamily: "var(--font-sans), sans-serif",
                }}
              >
                Khoa học đã chứng minh đạm thực vật hữu cơ là chìa khóa vàng giúp thanh lọc cơ thể nhẹ nhàng, phòng ngừa các bệnh mạn tính và kéo dài tuổi thọ dẻo dai.
              </p>
            </div>

            {/* List of benefits */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {BENEFITS.map((item, idx) => (
                <div
                  key={idx}
                  className="animate-fade-up"
                  style={{
                    display: "flex",
                    gap: 20,
                    alignItems: "flex-start",
                    animationDelay: `${idx * 0.12}s`,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: "rgba(10, 155, 120, 0.08)",
                      color: "#0A9B78",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#080E1A",
                        fontFamily: "var(--font-display), sans-serif",
                        margin: "0 0 6px",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 13.5,
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

          {/* Column 2: Visual feature graphic block */}
          <div
            className="benefits-visual-col"
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Background design circle */}
            <div
              style={{
                position: "absolute",
                width: "90%",
                height: "90%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(34, 217, 165, 0.08) 0%, transparent 70%)",
                zIndex: 0,
                filter: "blur(20px)",
              }}
            />

            {/* Infographic premium card */}
            <div
              className="animate-badge-pop"
              style={{
                position: "relative",
                zIndex: 1,
                backgroundColor: "#FFFFFF",
                borderRadius: 32,
                border: "1px solid rgba(10, 155, 120, 0.1)",
                boxShadow: "0 20px 48px rgba(10, 155, 120, 0.06)",
                padding: "48px 40px",
                width: "100%",
                maxWidth: 400,
                display: "flex",
                flexDirection: "column",
                gap: 24,
                textAlign: "center",
                animationDelay: "0.4s",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#D97706",
                  backgroundColor: "rgba(234, 179, 8, 0.08)",
                  padding: "6px 14px",
                  borderRadius: 99,
                  alignSelf: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "var(--font-sans), sans-serif",
                }}
              >
                Cam kết 4 Không
              </div>
              <h4
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#080E1A",
                  fontFamily: "var(--font-display), sans-serif",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                An Toàn Cho Sức Khỏe
              </h4>
              
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  textAlign: "left",
                  marginTop: 8,
                }}
              >
                {[
                  "Không bổ sung đường hóa học",
                  "Không chứa Gluten & Lactose",
                  "Không biến đổi gen (Non-GMO)",
                  "Không chất bảo quản nhân tạo",
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 99,
                        backgroundColor: "rgba(10, 155, 120, 0.1)",
                        color: "#0A9B78",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#374151",
                        fontFamily: "var(--font-sans), sans-serif",
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .benefits-split {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .benefits-visual-col {
            order: 2;
          }
        }
      `}</style>
    </section>
  );
}
