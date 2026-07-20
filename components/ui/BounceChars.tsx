"use client";

import {
  useRef,
  useEffect,
  useLayoutEffect,
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

/**
 * Tách React children (text + <br /> hoặc "\n") thành word / br / space —
 * giống Joy Rush. Nhận "\n" trong text tương đương <br /> vì <br /> element
 * đi qua ranh giới Server Component -> Client Component (props RSC) có thể
 * không được React 19/Next 16 (bản dev, kèm debug/owner info) tái tạo đúng
 * thành isValidElement + type "br" khi client hydrate — dù SSR HTML render
 * đúng, client vẫn tính thiếu <br>, gây hydration mismatch (đã xác nhận thực
 * tế qua incognito, không phải do extension). "\n" là primitive string nên
 * luôn an toàn qua mọi ranh giới serialize; callers là Server Component
 * (IntroSection) nên dùng {"\n"} thay vì <br /> — callers vốn đã là Client
 * Component (không qua boundary) vẫn dùng <br /> bình thường, không cần đổi.
 */
function toSegments(children: ReactNode): Segment[] {
  const segments: Segment[] = [];

  const pushText = (raw: string) => {
    const parts = raw.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        segments.push(part.includes("\n") ? { type: "br" } : { type: "space" });
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
    .map((s) => (s.type === "word" ? s.text : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heading split kiểu Joy Rush: word → char, bounce stagger khi vào viewport (1 lần).
 *
 * SSR + lần hydrate đầu render children plain (DOM khớp server/client).
 * Sau mount mới tách char và chạy bounce — tránh hydration mismatch.
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
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const segments = useMemo(() => toSegments(children), [children]);
  const label = useMemo(() => plainText(segments), [segments]);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Bật bounce trước paint nếu đã trong viewport — tránh nháy chữ khi chuyển
  // plain markup → char-split (bc-char mặc định opacity: 0).
  useLayoutEffect(() => {
    if (!mounted) return;

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
  }, [mounted, rootMargin]);

  // Plain markup cho SSR/hydrate — cùng children với server, không split char.
  if (!mounted) {
    return (
      <Comp ref={rootRef as never} className={cn("bounce-chars", className)}>
        {children}
      </Comp>
    );
  }

  let charIndex = 0;

  return (
    <Comp
      ref={rootRef as never}
      className={cn("bounce-chars", active && "is-active", className)}
    >
      {/* suppressHydrationWarning: text thuần cho screen reader, không ảnh hưởng
          hiển thị (phần thật là span aria-hidden bên dưới) — đã xác nhận SSR
          HTML/RSC payload đúng, nếu client vẫn lệch thì đây chỉ là sai khác vô
          hại ở bản sao a11y, không đáng để React quăng bỏ + render lại cả cây. */}
      <span className="sr-only" suppressHydrationWarning>
        {label}
      </span>
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
                const style: CSSProperties | undefined = reduceMotion
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
