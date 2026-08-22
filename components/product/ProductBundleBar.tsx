import type { CSSProperties } from "react";
import { cn, formatCurrencyVnd } from "@/lib/utils";
import { productService } from "@/features/product/services/product.service";
import type { ProductDetail } from "@/features/product/types";

/**
 * Bundle sticker bar (Joy Rush–style):
 * thanh gradient + divider | ngưỡng + sticker ưu đãi.
 * Nhãn 2 dòng tiếng Việt — giữ bề ngang ổn trong cột ~480px.
 */
interface ProductBundleBarProps {
  product: ProductDetail;
  className?: string;
}

export function ProductBundleBar({ product, className }: ProductBundleBarProps) {
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 items-stretch overflow-hidden rounded-[999px]",
        className
      )}
      role="note"
      aria-label="Ưu đãi combo tiết kiệm"
      style={{
        background:
          "linear-gradient(105deg, var(--color-primary-deep) 0%, var(--color-primary) 48%, #E8B56A 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 120% at 10% 120%, #fff 0%, transparent 55%), radial-gradient(ellipse 70% 100% at 90% -20%, #fff 0%, transparent 50%)",
        }}
      />

      <div
        className="relative z-[1] grid grid-cols-2 items-stretch sm:grid-cols-[auto_repeat(var(--bundle-count),minmax(0,1fr))]"
        style={{ "--bundle-count": product.variants.length } as CSSProperties}
      >
        <div className="col-span-2 flex items-center justify-center px-3 py-2.5 sm:col-span-1 sm:px-4">
          <p className="text-center text-[10px] leading-[1.15] font-extrabold tracking-[0.03em] text-white uppercase sm:text-[11px]">
            Combo
            <br />
            tiết kiệm
          </p>
        </div>

        {product.variants.map((variant) => {
          const offer = variant.offer;
          const price = productService.packPrice(product, variant);
          const reward = offer?.giftDescription
            ? `Quà + ${offer.freeShipping ? "FS" : "ưu đãi"}`
            : offer?.freeShipping
              ? "Freeship"
              : "Ưu đãi";

          return (
            <div
              key={variant.id}
              className="flex min-w-0 items-center justify-center gap-1 border-l border-white/45 px-1.5 py-2.5 sm:gap-1.5 sm:px-2"
            >
              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-white sm:text-[11px]">
                {variant.label}
              </span>
              <span className="inline-flex min-w-0 items-center justify-center rounded-md bg-white px-1.5 py-1 text-center text-[9px] leading-none font-extrabold tracking-[-0.01em] text-primary-deep sm:px-2 sm:text-[10px]">
                <span className="sr-only">{formatCurrencyVnd(price)} — </span>
                {reward}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
