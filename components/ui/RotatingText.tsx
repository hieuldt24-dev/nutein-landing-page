"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface RotatingTextProps {
  /** Văn bản lặp theo vòng tròn. Dùng ✦ làm dấu phân cách. */
  text?: string;
  /** Bán kính vòng chữ (px). */
  radius?: number;
  /** Cỡ chữ (px). */
  fontSize?: number;
  /** Thời gian 1 vòng quay (giây). */
  duration?: number;
  /** Màu chữ — nhận CSS variable hoặc hex. */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_TEXT = "NUTEIN ✦ ACTIVE PROTEIN POWDER ✦";

/**
 * Dòng chữ xoay tròn liên tục dựa trên SVG textPath.
 * Không dùng pseudo-element hay CSS class toàn cục — toàn bộ animation
 * được drive bởi inline style duy nhất.
 */
export function RotatingText({
  text = DEFAULT_TEXT,
  radius = 80,
  fontSize = 11,
  duration = 14,
  color = "var(--color-primary-deep)",
  className,
  style,
}: RotatingTextProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  /* Kích thước SVG = diameter + padding cho chữ */
  const pad = fontSize * 2.2;
  const size = Math.round((radius + pad) * 2);
  const c = size / 2;
  const r = radius;

  /* Lặp đủ ký tự để phủ đầy chu vi */
  const repeatedText = `${text}  ${text}  ${text}`;

  /* Circle path: bắt đầu từ điểm trái (9 giờ), đi theo chiều kim đồng hồ */
  const circlePath = [
    `M ${c},${c}`,
    `m -${r},0`,
    `a ${r},${r} 0 1,1 ${r * 2},0`,
    `a ${r},${r} 0 1,1 -${r * 2},0`,
  ].join(" ");

  return (
    <>
      <style>{`
        @keyframes rt-spin-${uid} {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <div
        aria-hidden
        className={cn("pointer-events-none select-none shrink-0", className)}
        style={{
          width: size,
          height: size,
          animation: `rt-spin-${uid} ${duration}s linear infinite`,
          ...style,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          focusable="false"
          overflow="visible"
        >
          <defs>
            <path id={`rt-path-${uid}`} d={circlePath} />
          </defs>
          <text
            fontSize={fontSize}
            fontWeight="800"
            letterSpacing="2.8"
            fill={color}
            fontFamily="inherit"
          >
            <textPath href={`#rt-path-${uid}`} startOffset="0%">
              {repeatedText}
            </textPath>
          </text>
        </svg>
      </div>
    </>
  );
}
