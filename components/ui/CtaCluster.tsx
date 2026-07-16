"use client";

import { useRef, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CtaClusterProps {
  label: string;
  href: string;
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
    <>
      <style>{`
        .cta-cluster {
          --label-w: 120px;
          --cta-size: 52px;
          --cta-border: var(--color-ink);
          --cta-fill: var(--color-ink);
          --cta-light: var(--color-bg);
          position: relative;
          display: inline-block;
          height: var(--cta-size);
          width: calc(var(--label-w) + var(--cta-size));
          isolation: isolate;
          text-decoration: none;
          vertical-align: middle;
        }
        .cta-cluster__label,
        .cta-cluster__arrow {
          position: absolute;
          top: 0;
          border: 2px solid var(--cta-border);
          border-radius: 999px;
          height: var(--cta-size);
          box-sizing: border-box;
          transition: left 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
        }
        .cta-cluster__label {
          left: 0;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 var(--cta-pad-x, 1.5rem);
          color: var(--cta-border);
          font-size: var(--cta-font-size, 14px);
          font-weight: var(--cta-font-weight, 700);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
          background: var(--color-bg);
        }
        .cta-cluster__arrow {
          left: var(--label-w);
          z-index: 1;
          width: var(--cta-size);
          color: var(--cta-border);
          background: var(--color-bg);
          overflow: hidden;
        }
        .cta-cluster__arrow::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: var(--cta-fill);
          transform: scale(0);
          transition: transform 0.35s cubic-bezier(0.165, 0.84, 0.44, 1);
          z-index: 0;
        }
        .cta-cluster__icon-default,
        .cta-cluster__icon-hover {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
        }
        .cta-cluster__icon-default {
          transform: translate(-50%, -50%);
          transition:
            transform 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19),
            opacity 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19);
        }
        .cta-cluster__icon-hover {
          color: var(--cta-light);
          opacity: 0;
          transform: translate(calc(-50% - 50%), calc(-50% + 50%));
          transition:
            transform 0.4s cubic-bezier(0.215, 0.61, 0.355, 1),
            opacity 0.4s cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        /* Hover: đổi chỗ — settle cạnh sát (không chồng).
           Trong lúc animate, arrow (z:1) chạy ĐẰNG SAU label (z:2). */
        .cta-cluster:hover .cta-cluster__label {
          left: var(--cta-size);
        }
        .cta-cluster:hover .cta-cluster__arrow {
          left: 0;
        }
        .cta-cluster:hover .cta-cluster__arrow::before {
          transform: scale(1);
        }
        .cta-cluster:hover .cta-cluster__icon-default {
          opacity: 0;
          transform: translate(calc(-50% + 50%), calc(-50% - 50%));
        }
        .cta-cluster:hover .cta-cluster__icon-hover {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      `}</style>
      <Link
        ref={clusterRef}
        href={href}
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
    </>
  );
}
