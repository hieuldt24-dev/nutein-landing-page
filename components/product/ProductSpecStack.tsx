import { cn } from "@/lib/utils";
import type { ProductSpec } from "@/features/product/types";

interface ProductSpecStackProps {
  specs: ProductSpec[];
  className?: string;
}

/**
 * Ô USP cạnh ảnh chính — Joy Rush: 4 box xếp dọc, cao bằng ảnh,
 * viền ink mỏng, số lớn / label nhỏ, gap hẹp, bo góc vừa.
 */
export function ProductSpecStack({ specs, className }: ProductSpecStackProps) {
  return (
    <ul
      className={cn(
        "grid h-full min-h-0 grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-2",
        className
      )}
    >
      {specs.map((spec) => (
        <li
          key={spec.id}
          className="flex min-h-0 flex-col justify-center rounded-[14px] border-[1.5px] border-ink bg-bg px-3 py-2.5 sm:flex-1 sm:px-3.5 sm:py-3"
        >
          <p className="font-display text-[clamp(28px,2.6vw,40px)] font-bold leading-none tracking-[-0.04em] text-ink">
            {spec.value}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.02em] text-ink/70 sm:text-[11px]">
            {spec.label}
          </p>
        </li>
      ))}
    </ul>
  );
}
