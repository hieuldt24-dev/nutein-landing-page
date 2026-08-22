import { BounceChars } from "@/components/ui/BounceChars";

/** Hero — chỉ headline, filter nằm hàng riêng bên dưới. */
export function BlogHero() {
  return (
    <header className="mx-auto max-w-[1200px] px-6 pb-8 md:px-10 md:pb-10">
      <h1 className="max-w-[10ch] font-display text-[clamp(48px,9vw,96px)] font-black uppercase leading-tight tracking-[-0.045em] text-ink">
        <BounceChars staggerMs={22}>Blog.</BounceChars>
      </h1>
      <p className="mt-4 max-w-[42ch] text-[13px] font-bold tracking-[0.06em] text-ink/65 uppercase md:text-sm">
        Công thức, protein, lối sống và dinh dưỡng.
      </p>
    </header>
  );
}
