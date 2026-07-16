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
 * CTA cluster matching JoyRush style:
 * [TEXT PILL] [CIRCLE ARROW PILL] — hover swaps positions (text right, arrow left)
 * with spring easing. Circle fills dark; dark arrow fades, light arrow appears.
 */
export function CtaCluster({
  label,
  href,
  className,
  size = 52,
  borderColor,
  fillColor,
  lightColor,
  iconSize = 20,
}: CtaClusterProps) {
  const clusterRef = useRef<HTMLAnchorElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const measure = () => {
      const el  = clusterRef.current;
      const lbl = labelRef.current;
      if (el && lbl) {
        el.style.setProperty("--label-w", `${lbl.offsetWidth}px`);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const style: CSSProperties = {
    "--cta-size":   `${size}px`,
    ...(borderColor && { "--cta-border": borderColor }),
    ...(fillColor   && { "--cta-fill":   fillColor }),
    ...(lightColor  && { "--cta-light":  lightColor }),
  } as CSSProperties;

  return (
    <>
      <style>{`
        .cta-cluster {
          --label-w: 120px;
          --cta-size: 52px;
          --cta-border: var(--color-ink);
          --cta-fill:   var(--color-ink);
          --cta-light:  var(--color-bg);
          display: inline-flex;
          align-items: center;
          isolation: isolate;
          text-decoration: none;
        }
        .cta-cluster__label,
        .cta-cluster__arrow {
          border: 2px solid var(--cta-border);
          border-radius: 999px;
          height: var(--cta-size);
          transition: transform 0.4s cubic-bezier(0.34, 1.6, 0.64, 1);
        }
        .cta-cluster__label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 1.5rem;
          color: var(--cta-border);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          white-space: nowrap;
          background: var(--color-bg);
          z-index: 2;
        }
        .cta-cluster__arrow {
          position: relative;
          width: var(--cta-size);
          color: var(--cta-border);
          flex-shrink: 0;
          background: var(--color-bg);
        }
        .cta-cluster__arrow::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 999px;
          background: var(--cta-fill);
          transform: scale(0);
          transition: transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
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
            opacity   0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19);
        }
        .cta-cluster__icon-hover {
          color: var(--cta-light);
          opacity: 0;
          transform: translate(calc(-50% - 50%), calc(-50% + 50%));
          transition:
            transform 0.4s cubic-bezier(0.215, 0.61, 0.355, 1),
            opacity   0.4s cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        .cta-cluster:hover .cta-cluster__label {
          transform: translateX(var(--cta-size));
        }
        .cta-cluster:hover .cta-cluster__arrow {
          transform: translateX(calc(-1 * var(--label-w)));
        }
        .cta-cluster:hover .cta-cluster__arrow::before {
          transform: scale(1);
          transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
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
          {/* Dark arrow — visible by default, exits on hover */}
          <ArrowUpRight
            size={iconSize}
            strokeWidth={2.2}
            className="cta-cluster__icon-default"
          />
          {/* Light arrow — hidden by default, enters on hover */}
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
