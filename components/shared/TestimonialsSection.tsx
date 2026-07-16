"use client";

import { type CSSProperties } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StarRating } from "@/components/ui/StarRating";

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
    <section id="testimonials" className="relative overflow-hidden bg-surface py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <SectionHeading eyebrow="Đánh giá khách hàng" variant="outline" align="left" className="text-[clamp(32px,5vw,68px)] tracking-[-0.03em] mb-4">
          Khách hàng nói gì<br />về Nutein?
        </SectionHeading>
        <p className="text-text-muted text-base max-w-[600px] mb-8 leading-relaxed">
          Hơn 50,000+ khách hàng đã tin tưởng và thay đổi thói quen dinh dưỡng cùng Nutein để hướng tới cuộc sống khỏe mạnh mỗi ngày.
        </p>

        <div className="scrollbar-hide flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-3 md:overflow-visible">
          {REVIEWS.map((review, idx) => (
            <div
              key={idx}
              suppressHydrationWarning
              className="animate-fade-up flex flex-col gap-5 p-8 rounded-[40px] bg-surface w-[300px] md:w-auto shrink-0 snap-start"
              style={{
                animationDelay: `${idx * 0.15}s`,
                border: "2px solid var(--color-ink)",
              } as CSSProperties}
            >
              <div className="flex items-center justify-between">
                <StarRating rating={review.rating} size={15} />
                <span className="font-display text-primary/25 text-5xl leading-none select-none">&ldquo;</span>
              </div>

              <p className="text-[14.5px] text-text-body leading-relaxed italic grow">{review.comment}</p>

              <div className="pt-4 border-t border-[color:var(--color-border)] flex items-center gap-3.5" suppressHydrationWarning>
                <div
                  suppressHydrationWarning
                  className="w-11 h-11 rounded-2xl bg-primary-soft text-primary-deep font-display font-extrabold text-[15px] flex items-center justify-center shrink-0"
                >
                  {review.avatar}
                </div>
                <div suppressHydrationWarning>
                  <h4 className="font-display font-extrabold text-[15px] text-ink">{review.name}</h4>
                  <p className="text-xs text-text-muted mt-0.5">{review.age} • {review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
