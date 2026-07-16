import * as React from "react";
import { cn } from "@/lib/utils";

interface CloudFrameProps {
  children: React.ReactNode;
  className?: string;
  /** Số thùy (lobes) của khung mây/bông hoa. Mặc định 6, giống cụm ảnh reference. */
  lobes?: number;
  /** Biên độ lồi/lõm của thùy — 0.05 (bo tròn gần hết) tới 0.12 (thùy rõ, sâu). */
  amplitude?: number;
  style?: React.CSSProperties;
  /**
   * Màu border bao quanh viền mây — CSS color string (vd "#C08635").
   * Dùng multi-layer drop-shadow vì CSS border/outline bị clip-path cắt mất,
   * chỉ filter:drop-shadow mới follow đúng contour polygon.
   * Độ dày ~5px (8 hướng để phủ đều).
   */
  borderColor?: string;
}

/** Sinh chuỗi `polygon()` dạng mây/bông hoa nhiều thùy bằng cách điều biến bán kính
 *  theo cos(lobes·θ) — nhiều điểm (96) nên nhìn mượt như đường cong dù polygon chỉ
 *  gồm đoạn thẳng. Toạ độ tính theo %, tự scale theo kích thước khung thật. */
function buildCloudPath(lobes: number, amplitude: number): string {
  const points: string[] = [];
  const segments = 96;
  const baseRadius = 42;
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = baseRadius + amplitude * 100 * Math.cos(lobes * theta);
    const x = 50 + r * Math.cos(theta);
    const y = 50 + r * Math.sin(theta);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${points.join(", ")})`;
}

/**
 * Khung ảnh dạng mây/bông hoa nhiều thùy (scalloped) — đúng motif khung ảnh
 * collage của reference (drinkjoyrush.com), thay cho SparkleFrame (sao 4 cánh)
 * trước đây. Dùng bọc ảnh nguyên liệu/lifestyle ở Differentiators/Benefits/Footer.
 */
export function CloudFrame({ children, className, lobes = 6, amplitude = 0.08, style, borderColor }: CloudFrameProps) {
  const clipPath = React.useMemo(() => buildCloudPath(lobes, amplitude), [lobes, amplitude]);

  const borderFilter = React.useMemo(() => {
    if (!borderColor) return undefined;
    const c = borderColor;
    const d = 5;
    const d2 = Math.round(d * 0.7);
    return [
      `drop-shadow(${d}px 0 0 ${c})`,
      `drop-shadow(-${d}px 0 0 ${c})`,
      `drop-shadow(0 ${d}px 0 ${c})`,
      `drop-shadow(0 -${d}px 0 ${c})`,
      `drop-shadow(${d2}px ${d2}px 0 ${c})`,
      `drop-shadow(-${d2}px ${d2}px 0 ${c})`,
      `drop-shadow(${d2}px -${d2}px 0 ${c})`,
      `drop-shadow(-${d2}px -${d2}px 0 ${c})`,
    ].join(" ");
  }, [borderColor]);

  return (
    <div
      className={cn("relative aspect-square overflow-hidden", className)}
      style={{ clipPath, filter: borderFilter, ...style }}
    >
      {children}
    </div>
  );
}
