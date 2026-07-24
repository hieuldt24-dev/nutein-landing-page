import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function AdminSidebarUserCard({
  fullName,
  email,
  roleLabel,
  compactUi,
}: {
  fullName?: string | null;
  email: string;
  roleLabel: string;
  compactUi: boolean;
}) {
  const displayName = fullName?.trim() || email.split("@")[0] || "Tài khoản";

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-ink/10 bg-bg",
        compactUi ? "flex justify-center px-2 py-3" : "px-3 py-3",
      )}
      title={compactUi ? `${displayName} · ${roleLabel}` : undefined}
    >
      <div className={cn("flex items-center gap-3", compactUi && "justify-center")}>
        <UserAvatar fullName={fullName} email={email} size="md" />
        {!compactUi ? (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink">{displayName}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-primary-deep uppercase">
              {roleLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
