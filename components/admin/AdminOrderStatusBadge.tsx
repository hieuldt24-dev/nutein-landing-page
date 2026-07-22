import { cn } from "@/lib/utils";
import { ADMIN_ORDER_STATUS_LABEL } from "@/features/admin-orders/constants";
import type { AdminOrderStatus } from "@/features/admin-orders/types";

const STATUS_CLASS: Record<AdminOrderStatus, string> = {
  pending: "bg-sage/40 text-ink",
  processing: "bg-sky/40 text-ink",
  shipped: "bg-primary/25 text-primary-deep",
  delivered: "bg-lime/50 text-forest",
  cancelled: "bg-ink/10 text-text-muted",
  returned: "bg-[color:var(--color-primary-soft)] text-primary-deep",
};

export function AdminOrderStatusBadge({ status }: { status: AdminOrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.02em] uppercase",
        STATUS_CLASS[status]
      )}
    >
      {ADMIN_ORDER_STATUS_LABEL[status]}
    </span>
  );
}
