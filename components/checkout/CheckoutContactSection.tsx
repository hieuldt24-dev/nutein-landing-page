"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CheckoutFormValues } from "@/features/checkout/schemas/checkout.schema";
import type { AuthUser } from "@/features/auth/types";
import {
  CheckoutField,
  CheckoutTextInput,
} from "@/components/checkout/CheckoutField";
import { CheckoutSectionHeading } from "@/components/checkout/CheckoutSectionHeading";

interface CheckoutContactSectionProps {
  register: UseFormRegister<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  isSubmitting: boolean;
  isLoggedIn: boolean;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function CheckoutContactSection({
  register,
  errors,
  isSubmitting,
  isLoggedIn,
  user,
  onOpenAuth,
  onLogout,
}: CheckoutContactSectionProps) {
  return (
    <section>
      <CheckoutSectionHeading
        title="Liên hệ"
        action={
          isLoggedIn ? (
            <div className="flex max-w-[min(100%,280px)] flex-col items-end gap-0.5 sm:max-w-[320px] sm:flex-row sm:items-baseline sm:gap-2">
              <span className="truncate text-[12px] font-semibold text-text-muted">
                {user?.email ?? "Đã đăng nhập"}
              </span>
              <button
                type="button"
                onClick={onLogout}
                disabled={isSubmitting}
                className="shrink-0 cursor-pointer text-[13px] font-bold text-primary-deep hover:text-primary disabled:opacity-50"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              disabled={isSubmitting}
              className="cursor-pointer text-[13px] font-bold text-primary-deep hover:text-primary disabled:opacity-50"
            >
              Đăng nhập
            </button>
          )
        }
      />
      <div className="flex flex-col gap-3">
        <CheckoutField label="Email" error={errors.buyer?.email?.message}>
          <CheckoutTextInput
            type="email"
            autoComplete="email"
            placeholder="tenban@example.com"
            disabled={isSubmitting || isLoggedIn}
            readOnly={isLoggedIn}
            error={Boolean(errors.buyer?.email)}
            {...register("buyer.email")}
          />
        </CheckoutField>
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckoutField label="Họ và tên" error={errors.buyer?.fullName?.message}>
            <CheckoutTextInput
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              disabled={isSubmitting}
              error={Boolean(errors.buyer?.fullName)}
              {...register("buyer.fullName")}
            />
          </CheckoutField>
          <CheckoutField label="Số điện thoại" error={errors.buyer?.phone?.message}>
            <CheckoutTextInput
              type="tel"
              autoComplete="tel"
              placeholder="0901234567"
              disabled={isSubmitting}
              error={Boolean(errors.buyer?.phone)}
              {...register("buyer.phone")}
            />
          </CheckoutField>
        </div>
      </div>
    </section>
  );
}
