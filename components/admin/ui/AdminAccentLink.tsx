import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accent action — icon + verb ngắn (mock UI kit). Không dùng “→” trần.
 */
export function AdminAccentLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-deep transition-colors hover:text-primary",
        className,
      )}
    >
      <ArrowUpRight size={14} strokeWidth={2.4} className="shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
