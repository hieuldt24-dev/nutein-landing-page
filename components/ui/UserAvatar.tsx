import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/user-initials";

type UserAvatarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<UserAvatarSize, string> = {
  sm: "size-6 text-[10px]",
  md: "size-9 text-[13px]",
  lg: "size-14 text-[18px]",
};

/**
 * Avatar gen (initials) — cùng ngôn ngữ AdminShell khi chưa có ảnh hồ sơ.
 */
export function UserAvatar({
  fullName,
  email,
  size = "md",
  className,
}: {
  fullName?: string | null;
  email?: string | null;
  size?: UserAvatarSize;
  className?: string;
}) {
  const initials = getUserInitials(fullName, email);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-extrabold text-bg",
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
