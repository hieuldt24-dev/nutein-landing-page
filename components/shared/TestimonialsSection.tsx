"use client";

import React from "react";
import { Star } from "lucide-react";

const REVIEWS = [
  {
    name: "Nguyễn Minh Thư",
    age: "26 tuổi",
    role: "Huấn luyện viên Yoga",
    avatar: "MT",
    comment: "Sản phẩm uống siêu thơm, thanh mát và nhẹ bụng. Trước đây mình dùng Whey động vật thường bị đầy hơi và lên mụn ẩn, từ khi đổi qua Nutein thì cơ thể nhẹ nhõm hẳn, da dẻ mịn màng và cơ bắp vẫn rất săn chắc.",
    rating: 5,
  },
  {
    name: "Trần Quốc Bảo",
    age: "31 tuổi",
    role: "Kỹ sư Phần mềm",
    avatar: "QB",
    comment: "Đặc thù công việc bận rộn khiến mình hay bỏ bữa sáng. Từ ngày mua Nutein, cứ sáng ra lắc nhanh 1 ly trong 2 phút là đủ dinh dưỡng và no đến tận trưa, năng lượng làm việc tập trung rõ rệt.",
    rating: 5,
  },
  {
    name: "Phạm Hoài An",
    age: "35 tuổi",
    role: "Mẹ bỉm sữa & Ăn chay",
    avatar: "HA",
    comment: "Tìm kiếm một loại đạm thực vật lành tính không chứa đường hóa học rất khó cho đến khi biết tới Nutein. Độ ngọt thanh từ hạt tự nhiên rất dễ uống, cả gia đình mình đều dùng hàng ngày để bổ sung dinh dưỡng.",
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      style={{
        padding: "100px 24px",
        backgroundColor: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
            Đánh giá khách hàng
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
            Khách hàng nói gì về Nutein?
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
            Hơn 50,000+ khách hàng đã tin tưởng và thay đổi thói quen dinh dưỡng cùng Nutein để hướng tới cuộc sống khỏe mạnh mỗi ngày.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 30,
          }}
        >
          {REVIEWS.map((review, idx) => (
            <div
              key={idx}
              className="testimonial-card animate-fade-up"
              suppressHydrationWarning
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.05)",
                borderRadius: 24,
                padding: "36px 32px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.015)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                animationDelay: `${idx * 0.15}s`,
              }}
            >
              {/* Stars & Top visual */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={15} fill="#F59E0B" stroke="#F59E0B" />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    color: "rgba(10, 155, 120, 0.08)",
                    lineHeight: 0.1,
                    fontFamily: "Georgia, serif",
                    transform: "translateY(12px)",
                  }}
                >
                  “
                </span>
              </div>

              {/* Comment text */}
              <p
                style={{
                  fontSize: 14.5,
                  color: "#4B5563",
                  lineHeight: 1.7,
                  margin: 0,
                  fontStyle: "italic",
                  fontFamily: "var(--font-sans), sans-serif",
                  flexGrow: 1,
                }}
              >
                {review.comment}
              </p>

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)" }} />

              {/* User Info Row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }} suppressHydrationWarning>
                {/* Initials Avatar */}
                <div
                  suppressHydrationWarning
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "rgba(10, 155, 120, 0.08)",
                    color: "#0A9B78",
                    fontWeight: 800,
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display), sans-serif",
                  }}
                >
                  {review.avatar}
                </div>
                <div suppressHydrationWarning>
                  <h4
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#080E1A",
                      fontFamily: "var(--font-display), sans-serif",
                      margin: 0,
                    }}
                  >
                    {review.name}
                  </h4>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      margin: "2px 0 0",
                      fontFamily: "var(--font-sans), sans-serif",
                    }}
                  >
                    {review.age} • {review.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .testimonial-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 48px rgba(8, 14, 26, 0.06) !important;
          border-color: rgba(10, 155, 120, 0.18) !important;
        }
      `}</style>
    </section>
  );
}
