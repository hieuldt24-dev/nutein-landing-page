"use client";

import { Toaster } from "sonner";

/**
 * Sonner host — top-right, unstyled (chrome từ `Toast` + `notify`).
 * z-[110] trên AuthModal / CartDrawer (z-[100]) để login error vẫn thấy.
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      offset={{ top: "1.25rem", right: "1.25rem" }}
      gap={12}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
          classNames: {
            toast: "!w-auto",
          },
      }}
      className="z-[110]"
    />
  );
}
