"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/features/account/schemas/profile.schema";
import {
  CheckoutField,
  CheckoutTextInput,
} from "@/components/checkout/CheckoutField";
import { FillButton } from "@/components/ui/FillButton";
import { useAccountProfile } from "@/lib/useAccountProfile";

export function AccountProfileForm() {
  const { profile, email, isLoading, updateProfile } = useAccountProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** false = xem (khóa form); true = đang chỉnh sửa */
  const [isEditing, setIsEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  useEffect(() => {
    if (!profile || hydrated) return;
    reset({
      fullName: profile.fullName ?? "",
      phone: profile.phone ?? "",
    });
    // Đã có dữ liệu → khóa; lần đầu trống → mở chỉnh sửa
    setIsEditing(!(profile.fullName && profile.phone));
    setHydrated(true);
  }, [profile, reset, hydrated]);

  const onSubmit = handleSubmit(async (values) => {
    if (!isEditing || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateProfile(values);
      toast.success("Đã cập nhật thông tin cá nhân.");
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setIsSubmitting(false);
    }
  });

  const startEdit = () => {
    reset({
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? "",
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    reset({
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? "",
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-ink/5" />
    );
  }

  const fieldsLocked = !isEditing || isSubmitting;

  return (
    <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Thông tin cá nhân</h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Dùng để điền sẵn khi thanh toán.
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Pencil size={15} strokeWidth={2.2} />
            Chỉnh sửa
          </button>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        <CheckoutField label="Email">
          <CheckoutTextInput value={email ?? ""} disabled readOnly />
        </CheckoutField>
        <CheckoutField label="Họ và tên" error={errors.fullName?.message}>
          <CheckoutTextInput
            autoComplete="name"
            disabled={fieldsLocked}
            error={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </CheckoutField>
        <CheckoutField label="Số điện thoại" error={errors.phone?.message}>
          <CheckoutTextInput
            autoComplete="tel"
            inputMode="tel"
            disabled={fieldsLocked}
            error={Boolean(errors.phone)}
            placeholder="09xxxxxxxx"
            {...register("phone")}
          />
        </CheckoutField>

        {isEditing ? (
          <div className="mt-1 flex flex-wrap gap-3">
            <FillButton
              type="submit"
              variant="ink"
              disabled={isSubmitting}
              className="w-full justify-center px-6 py-3 text-sm font-bold sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Đang lưu…
                </>
              ) : (
                "Lưu thông tin"
              )}
            </FillButton>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSubmitting}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-bold text-ink/70 hover:bg-ink/5 disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
