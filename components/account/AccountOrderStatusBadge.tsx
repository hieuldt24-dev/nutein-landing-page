import { cn } from "@/lib/utils";
import { ACCOUNT_ORDER_STATUS_LABEL } from "@/features/account/constants";
import type { AccountOrderStatus } from "@/features/account/types";

const STATUS_CLASS: Record<AccountOrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  processing: "bg-sky/40 text-ink",
  shipping: "bg-primary/25 text-primary-deep",
  completed: "bg-lime/50 text-forest",
  cancelled: "bg-ink/10 text-text-muted",
};

export function AccountOrderStatusBadge({ status }: { status: AccountOrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.02em] uppercase",
        STATUS_CLASS[status]
      )}
    >
      {ACCOUNT_ORDER_STATUS_LABEL[status]}
    </span>
  );
}
