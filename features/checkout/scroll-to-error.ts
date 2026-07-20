import type { FieldErrors, FieldPath } from "react-hook-form";
import type { CheckoutFormValues } from "@/features/checkout/schemas/checkout.schema";

/** Thứ tự ưu tiên scroll tới field lỗi (trên → dưới form). */
const CHECKOUT_FIELD_ORDER: FieldPath<CheckoutFormValues>[] = [
  "buyer.email",
  "buyer.fullName",
  "buyer.phone",
  "address.provinceCode",
  "address.province",
  "address.wardCode",
  "address.ward",
  "address.street",
  "note",
  "shippingMethod",
  "paymentMethod",
];

function hasMessage(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as { message?: unknown }).message === "string"
  );
}

function pathHasError(
  errors: FieldErrors<CheckoutFormValues>,
  path: FieldPath<CheckoutFormValues>
): boolean {
  const parts = path.split(".");
  let cur: unknown = errors;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return hasMessage(cur);
}

export function getFirstCheckoutErrorPath(
  errors: FieldErrors<CheckoutFormValues>
): FieldPath<CheckoutFormValues> | null {
  for (const path of CHECKOUT_FIELD_ORDER) {
    if (pathHasError(errors, path)) return path;
  }
  return null;
}

/**
 * Smooth-scroll tới control lỗi đầu tiên + focus nếu focusable.
 * Gọi trong `handleSubmit` onInvalid (sau khi RHF đã gắn lỗi vào DOM).
 */
export function scrollToCheckoutField(
  path: FieldPath<CheckoutFormValues>
): void {
  requestAnimationFrame(() => {
    // path từ schema (vd buyer.fullName) — không dùng CSS.escape trong [name="…"]
    const byName = document.querySelector<HTMLElement>(`[name="${path}"]`);
    const byData = document.querySelector<HTMLElement>(
      `[data-checkout-field="${path}"]`
    );
    const el = byName ?? byData;
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    if (typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* disabled / non-focusable */
      }
    }
  });
}
