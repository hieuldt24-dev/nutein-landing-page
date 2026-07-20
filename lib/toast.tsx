"use client";

import { toast } from "sonner";
import { Toast, type ToastVariant } from "@/components/ui/Toast";

export type NotifyOptions = {
  description?: string;
};

const DURATION: Record<ToastVariant, number> = {
  success: 3500,
  error: 5000,
  info: 3500,
};

function show(variant: ToastVariant, message: string, opts?: NotifyOptions) {
  return toast.custom(
    (id) => (
      <Toast
        id={id}
        variant={variant}
        message={message}
        description={opts?.description}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: DURATION[variant] }
  );
}

/**
 * Toast API Nutein — call sites chỉ dùng `notify.*`, không gọi Sonner raw.
 * Field validate → inline error, không toast.
 */
export const notify = {
  success(message: string, opts?: NotifyOptions) {
    return show("success", message, opts);
  },
  error(message: string, opts?: NotifyOptions) {
    return show("error", message, opts);
  },
  info(message: string, opts?: NotifyOptions) {
    return show("info", message, opts);
  },
};
