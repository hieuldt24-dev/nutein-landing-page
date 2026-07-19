"use client";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating?: number;
  /** Text bên cạnh sao — vd. "50,000+ đánh giá" */
  label?: string;
  size?: number;
  className?: string;
  /**
   * Hover jitter kiểu Joy Rush (sao lệch + label xoay nhẹ).
   * Chỉ bật ở section Differentiators theo yêu cầu.
   */
  interactive?: boolean;
}

const STAR_PATH =
  "M9.35055 1.81345C9.90865 0.727931 11.4605 0.727932 12.0186 1.81345L13.8825 5.43889C14.1055 5.87251 14.5253 6.17072 15.0081 6.23848L19.075 6.8092C20.3239 6.98445 20.8122 8.52891 19.8911 9.39025L17.03 12.0657C16.6587 12.4129 16.4885 12.9246 16.5779 13.4251L17.2634 17.2624C17.4809 18.4798 16.2147 19.4226 15.1108 18.8652L11.3606 16.9718C10.9355 16.7571 10.4337 16.7571 10.0085 16.9718L6.25838 18.8652C5.15447 19.4226 3.88822 18.4798 4.10569 17.2624L4.7912 13.4251C4.8806 12.9246 4.71043 12.4129 4.3391 12.0657L1.47804 9.39025C0.556949 8.52891 1.04527 6.98445 2.29411 6.8092L6.36104 6.23848C6.84389 6.17072 7.26367 5.87251 7.48661 5.43889L9.35055 1.81345Z";

function fillAmount(rating: number, index: number): number {
  const d = rating - index;
  if (d >= 1) return 1;
  if (d <= 0) return 0;
  return d;
}

function StarIcon() {
  return (
    <svg viewBox="0 0 22 21" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d={STAR_PATH}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Rating stars kiểu Joy Rush:
 * - Sao bo tròn chunky + partial fill (--fill)
 * - Label uppercase + underline bar
 * - `interactive`: hover jitter từng sao + label (chỉ Differentiators)
 * Màu fill: --color-primary
 */
export function StarRating({
  rating = 5,
  label,
  size = 22,
  className,
  interactive = false,
}: StarRatingProps) {
  return (
    <span
      className={cn(
        "star-rating inline-flex items-center gap-3",
        interactive && "star-rating--interactive",
        className
      )}
      style={{ ["--star-size" as string]: `${size}px` }}
    >
      <span className="star-rating__stars" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="star-rating__star"
            style={{ ["--fill" as string]: fillAmount(rating, i) }}
          >
            <span className="star-rating__star-empty">
              <StarIcon />
            </span>
            <span className="star-rating__star-full">
              <StarIcon />
            </span>
          </span>
        ))}
      </span>

      {label ? (
        <span className="star-rating__label">
          <span className="star-rating__label-text">{label}</span>
          <span className="star-rating__underline" aria-hidden />
        </span>
      ) : null}

      <span className="sr-only">
        {rating.toFixed(1)} trên 5{label ? ` — ${label}` : ""}
      </span>
    </span>
  );
}
