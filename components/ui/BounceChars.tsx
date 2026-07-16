"use client";

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
  type CSSProperties,
  isValidElement,
} from "react";
import { cn } from "@/lib/utils";

interface BounceCharsProps {
  children: ReactNode;
  className?: string;
  /** Delay giữa mỗi ký tự (ms) */
  staggerMs?: number;
  /** Delay trước khi bắt đầu (ms) — dùng khi xếp nhiều heading liên tiếp */
  delayMs?: number;
  /** Root margin cho IntersectionObserver */
  rootMargin?: string;
  as?: "span" | "div";
}

type Segment =
  | { type: "word"; text: string }
  | { type: "br" }
  | { type: "space" };

/** Tách React children (text + <br />) thành word / br / space — giống Joy Rush. */
function toSegments(children: ReactNode): Segment[] {
  const segments: Segment[] = [];

  const pushText = (raw: string) => {
    const parts = raw.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        segments.push({ type: "space" });
      } else {
        segments.push({ type: "word", text: part });
      }
    }
  };

  const walk = (node: ReactNode) => {
    if (node == null || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") {
      pushText(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (isValidElement<{ children?: ReactNode }>(node)) {
      if (node.type === "br") {
        segments.push({ type: "br" });
        return;
      }
      walk(node.props.children);
    }
  };

  walk(children);
  return segments;
}

function plainText(segments: Segment[]): string {
  return segments
    .map((s) => (s.type === "word" ? s.text : s.type === "br" ? "\n" : " "))
    .join("");
}

/**
 * Heading split kiểu Joy Rush: word → char, bounce stagger khi vào viewport (1 lần).
 */
export function BounceChars({
  children,
  className,
  staggerMs = 28,
  delayMs = 0,
  rootMargin = "0px 0px -8% 0px",
  as: Comp = "span",
}: BounceCharsProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const segments = useMemo(() => toSegments(children), [children]);
  const label = useMemo(() => plainText(segments), [segments]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    if (mq.matches) {
      setActive(true);
      return;
    }

    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.25, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  let charIndex = 0;

  return (
    <Comp
      ref={rootRef as never}
      className={cn("bounce-chars", active && "is-active", className)}
    >
      <style>{`
        .bounce-chars .bc-char {
          display: inline-block;
          position: relative;
          will-change: transform, opacity;
          opacity: 0;
          transform: translateY(0.55em) scale(0.45);
        }
        .bounce-chars.is-active .bc-char {
          animation: bc-bounce-in 0.7s cubic-bezier(0.34, 1.45, 0.64, 1) both;
          animation-delay: var(--bc-delay, 0ms);
        }
        .bounce-chars .bc-word {
          display: inline-block;
          white-space: nowrap;
        }
        @keyframes bc-bounce-in {
          0% {
            opacity: 0;
            transform: translateY(0.55em) scale(0.45);
          }
          55% {
            opacity: 1;
            transform: translateY(-0.1em) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bounce-chars .bc-char {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <span className="sr-only">{label}</span>
      <span aria-hidden="true">
        {segments.map((seg, i) => {
          if (seg.type === "br") {
            return <br key={`br-${i}`} />;
          }
          if (seg.type === "space") {
            return <span key={`sp-${i}`}>{"\u00A0"}</span>;
          }

          const wordChars = [...seg.text];
          return (
            <span key={`w-${i}`} className="bc-word">
              {wordChars.map((ch, ci) => {
                const idx = charIndex++;
                const style: CSSProperties = reduceMotion
                  ? undefined
                  : {
                      ["--bc-delay" as string]: `${delayMs + idx * staggerMs}ms`,
                    };
                return (
                  <span key={`${i}-${ci}`} className="bc-char" style={style}>
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </Comp>
  );
}

/** Fade nhẹ cho eyebrow — trigger cùng viewport. */
export function FadeInOnView({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block transition-opacity duration-700 ease-out",
        active ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </span>
  );
}

