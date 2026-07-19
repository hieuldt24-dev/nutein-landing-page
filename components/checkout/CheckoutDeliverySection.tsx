"use client";

import { useEffect, useState } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { toast } from "sonner";
import type { CheckoutFormValues } from "@/features/checkout/schemas/checkout.schema";
import {
  listVnProvinces,
  listVnWardsByProvince,
  type VnProvinceOption,
  type VnWardOption,
} from "@/features/checkout/vn-divisions";
import {
  CheckoutField,
  CheckoutSelect,
  CheckoutTextArea,
  CheckoutTextInput,
} from "@/components/checkout/CheckoutField";
import { CheckoutSectionHeading } from "@/components/checkout/CheckoutSectionHeading";

interface CheckoutDeliverySectionProps {
  register: UseFormRegister<CheckoutFormValues>;
  setValue: UseFormSetValue<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  isSubmitting: boolean;
  provinceCode: string;
  wardCode: string;
}

export function CheckoutDeliverySection({
  register,
  setValue,
  errors,
  isSubmitting,
  provinceCode,
  wardCode,
}: CheckoutDeliverySectionProps) {
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProvinces(true);
    void listVnProvinces()
      .then((list) => {
        if (!cancelled) setProvinces(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Không tải được danh sách tỉnh/thành.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!provinceCode) {
      setWards([]);
      setLoadingWards(false);
      return;
    }

    setLoadingWards(true);
    void listVnWardsByProvince(provinceCode)
      .then((list) => {
        if (!cancelled) setWards(list);
      })
      .catch(() => {
        if (!cancelled) {
          setWards([]);
          toast.error("Không tải được danh sách phường/xã.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWards(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  return (
    <section>
      <CheckoutSectionHeading title="Giao hàng" />
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckoutField
            label="Tỉnh / Thành"
            error={errors.address?.provinceCode?.message || errors.address?.province?.message}
          >
            <CheckoutSelect
              disabled={isSubmitting || loadingProvinces}
              error={Boolean(errors.address?.provinceCode || errors.address?.province)}
              value={provinceCode}
              onChange={(e) => {
                const id = e.target.value;
                const selected = provinces.find((p) => p.id === id);
                setValue("address.provinceCode", id, { shouldValidate: true });
                setValue("address.province", selected?.name ?? "", {
                  shouldValidate: true,
                });
                setValue("address.wardCode", "", { shouldValidate: true });
                setValue("address.ward", "", { shouldValidate: true });
              }}
            >
              <option value="">
                {loadingProvinces ? "Đang tải…" : "Chọn tỉnh / thành"}
              </option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </CheckoutSelect>
          </CheckoutField>
          <CheckoutField
            label="Phường / Xã"
            error={errors.address?.wardCode?.message || errors.address?.ward?.message}
          >
            <CheckoutSelect
              disabled={isSubmitting || !provinceCode || loadingWards}
              error={Boolean(errors.address?.wardCode || errors.address?.ward)}
              value={wardCode}
              onChange={(e) => {
                const id = e.target.value;
                const selected = wards.find((w) => w.id === id);
                setValue("address.wardCode", id, { shouldValidate: true });
                setValue("address.ward", selected?.name ?? "", { shouldValidate: true });
              }}
            >
              <option value="">
                {!provinceCode
                  ? "Chọn tỉnh trước"
                  : loadingWards
                    ? "Đang tải…"
                    : "Chọn phường / xã"}
              </option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </CheckoutSelect>
          </CheckoutField>
        </div>
        <CheckoutField label="Số nhà, đường" error={errors.address?.street?.message}>
          <CheckoutTextInput
            autoComplete="street-address"
            placeholder="123 Nguyễn Huệ"
            disabled={isSubmitting}
            error={Boolean(errors.address?.street)}
            {...register("address.street")}
          />
        </CheckoutField>
        <CheckoutField label="Ghi chú đơn hàng (tuỳ chọn)" error={errors.note?.message}>
          <CheckoutTextArea
            placeholder="Giao giờ hành chính, gọi trước khi giao…"
            disabled={isSubmitting}
            error={Boolean(errors.note)}
            {...register("note")}
          />
        </CheckoutField>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-body">
          <input
            type="checkbox"
            disabled={isSubmitting}
            className="size-4 accent-[var(--color-primary)]"
            {...register("saveInfo")}
          />
          Lưu thông tin cho lần sau
        </label>
      </div>
    </section>
  );
}
