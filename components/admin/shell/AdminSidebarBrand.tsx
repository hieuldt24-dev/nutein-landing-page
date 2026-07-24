import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const NUTEIN_MARK_SRC = "/images/favicon-color-3232-10x_2.svg";

export function AdminSidebarBrand({
  homeHref,
  compactUi,
  compactMode,
  onToggleCompact,
}: {
  homeHref: string;
  compactUi: boolean;
  /** Trạng thái compact đã lưu (không phụ thuộc hover). */
  compactMode?: boolean;
  onToggleCompact?: () => void;
}) {
  const pressed = compactMode ?? compactUi;
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compactUi ? "justify-center" : "justify-between",
      )}
    >
      <Link
        href={homeHref}
        className={cn(
          "flex min-w-0 items-center gap-2",
          compactUi && "justify-center",
        )}
        title="Nutein Quản trị"
      >
        {compactUi ? (
          <Image
            src={NUTEIN_MARK_SRC}
            alt="Nutein"
            width={32}
            height={32}
            className="size-8"
            priority
          />
        ) : (
          <Image
            src="/images/logo-horizontal-2x_1.svg"
            alt="Nutein"
            width={112}
            height={28}
            className="h-7 w-auto"
            priority
          />
        )}
      </Link>

      {onToggleCompact && !compactUi ? (
        <button
          type="button"
          onClick={onToggleCompact}
          aria-label={pressed ? "Tắt compact mode" : "Bật compact mode"}
          aria-pressed={pressed}
          title={pressed ? "Tắt compact" : "Bật compact"}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:bg-ink/5"
        >
          {pressed ? (
            <PanelLeftOpen size={16} strokeWidth={2.2} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={2.2} />
          )}
        </button>
      ) : null}
    </div>
  );
}
