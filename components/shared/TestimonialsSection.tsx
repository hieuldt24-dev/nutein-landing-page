"use client";

import { type CSSProperties } from "react";
import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StarRating } from "@/components/ui/StarRating";

const TESTIMONIAL_STAR_SRC = "/images/element_stars_4@216x.png";

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
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="relative mb-10 sm:mb-12 md:flex md:items-start md:justify-between md:gap-10">
          <div className="relative z-[1] min-w-0 md:flex-1">
            <SectionHeading
              eyebrow="Đánh giá khách hàng"
              align="left"
              className="mb-4 text-[clamp(36px,7vw,88px)] tracking-[-0.04em]"
            >
              Khách hàng nói gì<br />về Nutein?
            </SectionHeading>
            <p className="max-w-[600px] text-base leading-relaxed text-text-muted">
              Hơn 50,000+ khách hàng đã tin tưởng và thay đổi thói quen dinh dưỡng cùng Nutein để hướng tới cuộc sống khỏe mạnh mỗi ngày.
            </p>
          </div>

          {/*
            Mobile: absolute sau heading (trang trí, không chen flow).
            Desktop: cột phải đối diện heading, to hơn.
          */}
          <div
            className="pointer-events-none absolute top-6 right-0 z-0 size-36 -translate-y-2 translate-x-[12%] opacity-55 animate-float-slow sm:size-44 md:relative md:top-auto md:right-auto md:mt-1 md:size-56 md:translate-x-0 md:translate-y-0 md:opacity-100 lg:size-64 xl:size-72"
            aria-hidden
          >
            <Image
              src={TESTIMONIAL_STAR_SRC}
              alt=""
              fill
              sizes="(max-width: 768px) 176px, (max-width: 1280px) 256px, 288px"
              className="object-contain"
            />
          </div>
        </div>

        <div className="scrollbar-hide flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-3 md:overflow-visible">
          {REVIEWS.map((review, idx) => (
            <div
              key={idx}
              suppressHydrationWarning
              className="animate-fade-up flex w-[300px] shrink-0 snap-start flex-col gap-5 rounded-[40px] bg-surface p-8 md:w-auto"
              style={{
                animationDelay: `${idx * 0.15}s`,
                border: "2px solid var(--color-ink)",
              } as CSSProperties}
            >
              <div className="flex items-center justify-between">
                <StarRating rating={review.rating} size={15} />
                <span className="select-none font-display text-5xl leading-none text-primary/25">&ldquo;</span>
              </div>

              <p className="grow text-[14.5px] italic leading-relaxed text-text-body">{review.comment}</p>

              <div className="flex items-center gap-3.5 border-t border-[color:var(--color-border)] pt-4" suppressHydrationWarning>
                <div
                  suppressHydrationWarning
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-display text-[15px] font-extrabold text-primary-deep"
                >
                  {review.avatar}
                </div>
                <div suppressHydrationWarning>
                  <h4 className="font-display text-[15px] font-extrabold text-ink">{review.name}</h4>
                  <p className="mt-0.5 text-xs text-text-muted">{review.age} • {review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
