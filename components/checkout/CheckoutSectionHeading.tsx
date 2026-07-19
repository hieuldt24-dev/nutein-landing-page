import type { ReactNode } from "react";

export function CheckoutSectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}
