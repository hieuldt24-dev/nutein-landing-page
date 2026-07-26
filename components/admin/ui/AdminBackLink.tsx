import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back control — ghost pill + chevron (mock UI kit). Không dùng “← text” trần.
 */
export function AdminBackLink({
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
        "inline-flex h-9 items-center gap-1.5 self-start rounded-full border border-ink/15 bg-surface px-3.5 text-[13px] font-bold text-text-body transition-colors hover:bg-ink/[0.04] hover:text-ink",
        className,
      )}
    >
      <ChevronLeft size={15} strokeWidth={2.2} className="shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
