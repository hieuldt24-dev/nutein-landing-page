"use client";

import type { UseFormSetValue } from "react-hook-form";
import { PAYMENT_OPTIONS } from "@/features/checkout/constants";
import type { CheckoutFormValues } from "@/features/checkout/schemas/checkout.schema";
import { CheckoutRadioCard } from "@/components/checkout/CheckoutRadioCard";
import { CheckoutSectionHeading } from "@/components/checkout/CheckoutSectionHeading";

interface CheckoutPaymentSectionProps {
  paymentMethod: CheckoutFormValues["paymentMethod"];
  setValue: UseFormSetValue<CheckoutFormValues>;
  isSubmitting: boolean;
}

export function CheckoutPaymentSection({
  paymentMethod,
  setValue,
  isSubmitting,
}: CheckoutPaymentSectionProps) {
  const selectedPayment = PAYMENT_OPTIONS.find((o) => o.value === paymentMethod);

  return (
    <section>
      <CheckoutSectionHeading title="Thanh toán" />
      <p className="mb-3 text-[12px] font-medium text-text-muted">
        Đơn được xử lý an toàn.
      </p>
      <div className="flex flex-col gap-2.5">
        {PAYMENT_OPTIONS.map((option) => (
          <CheckoutRadioCard
            key={option.value}
            checked={paymentMethod === option.value}
            disabled={isSubmitting}
            onChange={() =>
              setValue("paymentMethod", option.value, { shouldValidate: true })
            }
            title={option.label}
            description={option.description}
          />
        ))}
      </div>
      {selectedPayment && paymentMethod !== "cod" ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-4 py-3 text-[12px] font-medium text-text-body">
          {selectedPayment.description}
        </div>
      ) : null}
    </section>
  );
}
