import { cn } from "@/lib/utils";

/**
 * Bundle sticker bar (Joy Rush–style):
 * thanh gradient + divider | ngưỡng + sticker ưu đãi.
 * Nhãn 2 dòng tiếng Việt — giữ bề ngang ổn trong cột ~480px.
 */
const BUNDLE_TIERS = [
  { spend: "500k", reward: "5%" },
  { spend: "750k", reward: "Freeship" },
  { spend: "1.5tr", reward: "25%" },
] as const;

interface ProductBundleBarProps {
  className?: string;
}

export function ProductBundleBar({ className }: ProductBundleBarProps) {
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

      <div className="relative z-[1] flex w-full min-w-0 items-stretch">
        <div className="flex shrink-0 items-center px-3.5 py-2.5 sm:px-4">
          <p className="text-center text-[10px] leading-[1.15] font-extrabold tracking-[0.03em] text-white uppercase sm:text-[11px]">
            Combo
            <br />
            tiết kiệm
          </p>
        </div>

        {BUNDLE_TIERS.map((tier) => (
          <div
            key={tier.spend}
            className="flex min-w-0 flex-1 items-center justify-center gap-1 border-l border-white/45 px-1.5 py-2.5 sm:gap-1.5 sm:px-2"
          >
            <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-white sm:text-[12px]">
              {tier.spend}
            </span>
            <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-white px-1.5 py-1 text-[10px] leading-none font-extrabold tracking-[-0.01em] text-primary-deep uppercase sm:px-2 sm:text-[11px]">
              {tier.reward}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
