"use client";

import type { FieldErrors, UseFormSetValue } from "react-hook-form";
import {
  CHECKOUT_SHIPPING_GATE_MESSAGE,
  SHIPPING_FEES_VND,
  SHIPPING_OPTIONS,
} from "@/features/checkout/constants";
import type { CheckoutFormValues } from "@/features/checkout/schemas/checkout.schema";
import type { VoucherProgress } from "@/features/cart/types";
import { resolveCheckoutShippingFee } from "@/features/cart/pricing";
import { CheckoutRadioCard } from "@/components/checkout/CheckoutRadioCard";
import { CheckoutSectionHeading } from "@/components/checkout/CheckoutSectionHeading";
import { formatCurrencyVnd } from "@/lib/utils";

interface CheckoutShippingSectionProps {
  addressReady: boolean;
  shippingMethod: CheckoutFormValues["shippingMethod"];
  setValue: UseFormSetValue<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  isSubmitting: boolean;
  voucherProgress: VoucherProgress;
}

export function CheckoutShippingSection({
  addressReady,
  shippingMethod,
  setValue,
  errors,
  isSubmitting,
  voucherProgress,
}: CheckoutShippingSectionProps) {
  return (
    <section>
      <CheckoutSectionHeading title="Phương thức giao hàng" />
      {!addressReady ? (
        <div className="rounded-[var(--radius-md)] border border-primary/30 bg-primary/10 px-4 py-4 text-[13px] font-semibold text-ink">
          {CHECKOUT_SHIPPING_GATE_MESSAGE}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {SHIPPING_OPTIONS.map((option) => {
            const feePreview = resolveCheckoutShippingFee(
              option.value,
              voucherProgress,
              SHIPPING_FEES_VND
            );
            return (
              <CheckoutRadioCard
                key={option.value}
                checked={shippingMethod === option.value}
                disabled={isSubmitting}
                onChange={() =>
                  setValue("shippingMethod", option.value, { shouldValidate: true })
                }
                title={option.label}
                description={option.description}
                trailing={
                  <span className="shrink-0 text-[13px] font-bold text-ink">
                    {feePreview.shippingFee === 0
                      ? "Miễn phí"
                      : formatCurrencyVnd(feePreview.shippingFee)}
                  </span>
                }
              />
            );
          })}
        </div>
      )}
      {errors.shippingMethod?.message ? (
        <p className="mt-2 text-[12px] font-semibold text-red-600">
          {errors.shippingMethod.message}
        </p>
      ) : null}
    </section>
  );
}
