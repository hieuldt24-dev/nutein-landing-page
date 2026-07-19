"use client";

import { useRef, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CtaClusterProps {
  label: string;
  href: string;
  /** Khi truyền vào, click sẽ chạy handler này (vd. thêm vào giỏ) thay vì điều hướng theo `href`. */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  /** Circle diameter in px — default 52 */
  size?: number;
  /** Label font-size in px — default 14 */
  fontSize?: number;
  /** Label font-weight — default 700 */
  fontWeight?: number;
  /** Horizontal padding on the text pill (CSS length) — default 1.5rem */
  labelPaddingX?: string;
  /** Override --cta-border CSS var */
  borderColor?: string;
  /** Override --cta-fill CSS var */
  fillColor?: string;
  /** Override --cta-light CSS var (arrow icon color on hover) */
  lightColor?: string;
  /** Icon size passed to ArrowUpRight */
  iconSize?: number;
}

/**
 * CTA cluster: [TEXT PILL][CIRCLE] cạnh sát nhau, không chồng.
 * Hover: đổi chỗ bằng `left` (absolute), không translate đè lên nhau.
 */
export function CtaCluster({
  label,
  href,
  onClick,
  className,
  size = 52,
  fontSize = 14,
  fontWeight = 700,
  labelPaddingX = "1.5rem",
  borderColor,
  fillColor,
  lightColor,
  iconSize = 20,
}: CtaClusterProps) {
  const clusterRef = useRef<HTMLAnchorElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const measure = () => {
      const el = clusterRef.current;
      const lbl = labelRef.current;
      if (el && lbl) {
        // getBoundingClientRect tránh lệch subpixel so với offsetWidth
        const w = Math.ceil(lbl.getBoundingClientRect().width);
        el.style.setProperty("--label-w", `${w}px`);
      }
    };
    measure();
    // Remeasure sau font load
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [size, fontSize, fontWeight, labelPaddingX, label]);

  const style: CSSProperties = {
    "--cta-size": `${size}px`,
    "--cta-font-size": `${fontSize}px`,
    "--cta-font-weight": String(fontWeight),
    "--cta-pad-x": labelPaddingX,
    ...(borderColor && { "--cta-border": borderColor }),
    ...(fillColor && { "--cta-fill": fillColor }),
    ...(lightColor && { "--cta-light": lightColor }),
  } as CSSProperties;

  return (
    <Link
      ref={clusterRef}
      href={href}
      onClick={onClick}
      className={cn("cta-cluster", className)}
      style={style}
    >
      <span ref={labelRef} className="cta-cluster__label">
        {label}
      </span>
      <span className="cta-cluster__arrow" aria-hidden="true">
        <ArrowUpRight
          size={iconSize}
          strokeWidth={2.2}
          className="cta-cluster__icon-default"
        />
        <ArrowUpRight
          size={iconSize}
          strokeWidth={2.2}
          className="cta-cluster__icon-hover"
        />
      </span>
    </Link>
  );
}
