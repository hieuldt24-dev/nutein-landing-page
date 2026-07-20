"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/toast";
import {
  upsertAddressSchema,
  type UpsertAddressInput,
} from "@/features/account/schemas/address.schema";
import type { ShippingAddress } from "@/features/account/types";
import {
  listVnProvinces,
  listVnWardsByProvince,
  type VnProvinceOption,
  type VnWardOption,
} from "@/features/checkout/vn-divisions";
import {
  CheckoutField,
  CheckoutSelect,
  CheckoutTextInput,
} from "@/components/checkout/CheckoutField";
import { FillButton } from "@/components/ui/FillButton";

interface AccountAddressFormProps {
  initial?: ShippingAddress | null;
  onSubmitAddress: (input: UpsertAddressInput) => Promise<void>;
  onCancel?: () => void;
}

export function AccountAddressForm({
  initial,
  onSubmitAddress,
  onCancel,
}: AccountAddressFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpsertAddressInput>({
    resolver: zodResolver(upsertAddressSchema),
    defaultValues: {
      id: initial?.id,
      label: initial?.label ?? "",
      provinceCode: initial?.provinceCode ?? "",
      province: initial?.province ?? "",
      wardCode: initial?.wardCode ?? "",
      ward: initial?.ward ?? "",
      street: initial?.street ?? "",
      isDefault: initial?.isDefault ?? false,
    },
  });

  const provinceCode = watch("provinceCode");

  useEffect(() => {
    reset({
      id: initial?.id,
      label: initial?.label ?? "",
      provinceCode: initial?.provinceCode ?? "",
      province: initial?.province ?? "",
      wardCode: initial?.wardCode ?? "",
      ward: initial?.ward ?? "",
      street: initial?.street ?? "",
      isDefault: initial?.isDefault ?? false,
    });
  }, [initial, reset]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProvinces(true);
    void listVnProvinces()
      .then((list) => {
        if (!cancelled) setProvinces(list);
      })
      .catch(() => {
        if (!cancelled) notify.error("Không tải được danh sách tỉnh/thành.");
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
          notify.error("Không tải được danh sách phường/xã.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await onSubmitAddress(values);
      notify.success(initial ? "Đã cập nhật địa chỉ." : "Đã thêm địa chỉ.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu địa chỉ thất bại");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-ink/15 bg-bg px-4 py-5 md:px-5"
    >
      <CheckoutField label="Nhãn (tuỳ chọn)" error={errors.label?.message}>
        <CheckoutTextInput
          placeholder="Nhà, Văn phòng…"
          disabled={isSubmitting}
          {...register("label")}
        />
      </CheckoutField>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckoutField
          label="Tỉnh / Thành"
          error={errors.provinceCode?.message || errors.province?.message}
        >
          <CheckoutSelect
            disabled={isSubmitting || loadingProvinces}
            error={Boolean(errors.provinceCode || errors.province)}
            value={provinceCode}
            onChange={(e) => {
              const id = e.target.value;
              const selected = provinces.find((p) => p.id === id);
              setValue("provinceCode", id, { shouldValidate: true });
              setValue("province", selected?.name ?? "", { shouldValidate: true });
              setValue("wardCode", "", { shouldValidate: true });
              setValue("ward", "", { shouldValidate: true });
            }}
          >
            <option value="">
              {loadingProvinces ? "Đang tải…" : "Chọn tỉnh/thành"}
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
          error={errors.wardCode?.message || errors.ward?.message}
        >
          <CheckoutSelect
            disabled={isSubmitting || !provinceCode || loadingWards}
            error={Boolean(errors.wardCode || errors.ward)}
            value={watch("wardCode")}
            onChange={(e) => {
              const id = e.target.value;
              const selected = wards.find((w) => w.id === id);
              setValue("wardCode", id, { shouldValidate: true });
              setValue("ward", selected?.name ?? "", { shouldValidate: true });
            }}
          >
            <option value="">
              {!provinceCode
                ? "Chọn tỉnh trước"
                : loadingWards
                  ? "Đang tải…"
                  : "Chọn phường/xã"}
            </option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </CheckoutSelect>
        </CheckoutField>
      </div>

      <CheckoutField label="Số nhà, đường" error={errors.street?.message}>
        <CheckoutTextInput
          disabled={isSubmitting}
          error={Boolean(errors.street)}
          {...register("street")}
        />
      </CheckoutField>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border border-ink/10 bg-surface px-3.5 py-3 text-[13px] font-medium text-ink">
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-[var(--color-primary)]"
          disabled={isSubmitting}
          {...register("isDefault")}
        />
        <span>
          Đặt làm địa chỉ mặc định
          <span className="mt-0.5 block text-[12px] font-normal text-text-muted">
            Dùng để điền sẵn khi thanh toán
          </span>
        </span>
      </label>

      <div className="mt-1 flex flex-wrap gap-3">
        <FillButton
          type="submit"
          variant="ink"
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-bold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Đang lưu…
            </>
          ) : initial ? (
            "Cập nhật địa chỉ"
          ) : (
            "Thêm địa chỉ"
          )}
        </FillButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-bold text-ink/70 hover:bg-ink/5"
          >
            Huỷ
          </button>
        ) : null}
      </div>
    </form>
  );
}
