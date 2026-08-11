"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmLeaveDialog } from "@/components/admin/ui/AdminConfirmLeaveDialog";

type PendingAction =
  | { kind: "href"; href: string }
  | { kind: "back" }
  | { kind: "run"; run: () => void };

function sameLocation(url: URL): boolean {
  return (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  );
}

function isModifiedClick(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

/**
 * Chặn rời trang khi còn thay đổi chưa lưu:
 * - Link / sidebar / back link (click capture)
 * - router.push / replace (patch history)
 * - nút Back trình duyệt (popstate)
 * - đóng tab / reload (beforeunload — dialog native của browser)
 */
export function useUnsavedChangesGuard(enabled: boolean): {
  dialog: ReactNode;
  /** Chạy action sau khi user xác nhận (vd. đổi tab nội dung). */
  requestConfirm: (run: () => void) => void;
} {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingAction | null>(null);
  const allowNextRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const closeDialog = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
  }, []);

  const openDialog = useCallback((pending: PendingAction) => {
    pendingRef.current = pending;
    // Next.js gọi history.push/replace trong useInsertionEffect —
    // setState đồng bộ ở đó sẽ lỗi "useInsertionEffect must not schedule updates".
    window.setTimeout(() => setOpen(true), 0);
  }, []);

  const requestConfirm = useCallback(
    (run: () => void) => {
      if (!enabledRef.current) {
        run();
        return;
      }
      openDialog({ kind: "run", run });
    },
    [openDialog],
  );

  const confirmLeave = useCallback(() => {
    const pending = pendingRef.current;
    setOpen(false);
    pendingRef.current = null;
    if (!pending) return;

    allowNextRef.current = true;
    try {
      if (pending.kind === "href") {
        router.push(pending.href);
      } else if (pending.kind === "back") {
        window.history.go(-1);
      } else {
        pending.run();
      }
    } finally {
      queueMicrotask(() => {
        allowNextRef.current = false;
      });
    }
  }, [router]);

  // Đóng tab / reload
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);

  // Click Link (sidebar, back, v.v.)
  useEffect(() => {
    if (!enabled) return;

    const onClick = (e: MouseEvent) => {
      if (allowNextRef.current || !enabledRef.current) return;
      if (e.defaultPrevented || isModifiedClick(e)) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      if (
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:") ||
        hrefAttr.startsWith("javascript:")
      ) {
        return;
      }

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (sameLocation(next)) return;

      e.preventDefault();
      e.stopPropagation();
      openDialog({
        kind: "href",
        href: `${next.pathname}${next.search}${next.hash}`,
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, openDialog]);

  // router.push / replace → history.pushState / replaceState
  useEffect(() => {
    if (!enabled) return;

    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);

    const wrap =
      (original: typeof window.history.pushState) =>
      (data: unknown, unused: string, url?: string | URL | null) => {
        if (allowNextRef.current || !enabledRef.current || url == null) {
          return original(data, unused, url);
        }
        const next = new URL(String(url), window.location.href);
        if (sameLocation(next)) {
          return original(data, unused, url);
        }
        openDialog({
          kind: "href",
          href: `${next.pathname}${next.search}${next.hash}`,
        });
      };

    window.history.pushState = wrap(originalPush);
    window.history.replaceState = wrap(originalReplace);

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    };
  }, [enabled, openDialog]);

  // Nút Back / Forward trình duyệt
  useEffect(() => {
    if (!enabled) return;

    const onPopState = () => {
      if (allowNextRef.current || !enabledRef.current) return;
      // Đảo ngược ngay, rồi hỏi
      window.history.go(1);
      openDialog({ kind: "back" });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, openDialog]);

  // Esc → ở lại
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDialog, titleId]);

  const dialog = (
    <AdminConfirmLeaveDialog
      open={open}
      onStay={closeDialog}
      onLeave={confirmLeave}
    />
  );

  return { dialog, requestConfirm };
}
