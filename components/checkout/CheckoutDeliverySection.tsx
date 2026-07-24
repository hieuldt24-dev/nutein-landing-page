"use client";

import { useEffect, useState } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { notify } from "@/lib/toast";
import type { ShippingAddress } from "@/features/account/types";
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
import { CheckoutRadioCard } from "@/components/checkout/CheckoutRadioCard";
import { CheckoutSectionHeading } from "@/components/checkout/CheckoutSectionHeading";

interface CheckoutDeliverySectionProps {
  register: UseFormRegister<CheckoutFormValues>;
  setValue: UseFormSetValue<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  isSubmitting: boolean;
  provinceCode: string;
  wardCode: string;
  /** Đã đăng nhập — để hiện empty-state sổ địa chỉ (khác guest). */
  isLoggedIn?: boolean;
  /** Địa chỉ đã lưu (account) — chỉ hiện picker khi có ≥ 1 địa chỉ. */
  savedAddresses?: ShippingAddress[];
  savedAddressesLoading?: boolean;
  /** Id địa chỉ đang chọn (đồng bộ prefill mặc định từ form cha). */
  selectedSavedAddressId?: string;
  onSelectedSavedAddressIdChange?: (id: string) => void;
}

export function CheckoutDeliverySection({
  register,
  setValue,
  errors,
  isSubmitting,
  provinceCode,
  wardCode,
  isLoggedIn = false,
  savedAddresses = [],
  savedAddressesLoading = false,
  selectedSavedAddressId = "",
  onSelectedSavedAddressIdChange,
}: CheckoutDeliverySectionProps) {
  const [provinces, setProvinces] = useState<VnProvinceOption[]>([]);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);

  const hasSavedAddresses = savedAddresses.length > 0;
  const showEmptyAddressBook =
    isLoggedIn && !savedAddressesLoading && !hasSavedAddresses;

  const applySavedAddress = (addr: ShippingAddress) => {
    setValue("address.provinceCode", addr.provinceCode, { shouldValidate: true });
    setValue("address.province", addr.province, { shouldValidate: true });
    setValue("address.wardCode", addr.wardCode, { shouldValidate: true });
    setValue("address.ward", addr.ward, { shouldValidate: true });
    setValue("address.street", addr.street, { shouldValidate: true });
    onSelectedSavedAddressIdChange?.(addr.id);
  };

  const clearSavedSelection = () => {
    onSelectedSavedAddressIdChange?.("");
    setValue("address.provinceCode", "", { shouldValidate: false });
    setValue("address.province", "", { shouldValidate: false });
    setValue("address.wardCode", "", { shouldValidate: false });
    setValue("address.ward", "", { shouldValidate: false });
    setValue("address.street", "", { shouldValidate: false });
  };

  /** Có sổ địa chỉ: form nhập chỉ khi chọn "Nhập địa chỉ khác". */
  const showManualAddressForm = !hasSavedAddresses || !selectedSavedAddressId;

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

  return (
    <section>
      <CheckoutSectionHeading title="Giao hàng" />
      <div className="flex flex-col gap-3">
        {isLoggedIn && savedAddressesLoading ? (
          <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-ink/5" />
        ) : null}

        {showEmptyAddressBook ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-3 text-[13px] leading-relaxed text-text-muted">
            Bạn chưa có địa chỉ đã lưu. Nhập địa chỉ giao hàng bên dưới — có thể
            tick <span className="font-semibold text-ink/80">Lưu địa chỉ này cho lần sau</span>{" "}
            để dùng lại ở đơn tiếp theo.
          </p>
        ) : null}

        {hasSavedAddresses ? (
          <div className="flex flex-col gap-2" data-checkout-field="savedAddressId">
            <p className="text-[13px] font-bold text-ink">Địa chỉ đã lưu</p>
            <div className="flex flex-col gap-2">
              {savedAddresses.map((addr) => (
                <CheckoutRadioCard
                  key={addr.id}
                  checked={selectedSavedAddressId === addr.id}
                  disabled={isSubmitting}
                  onChange={() => applySavedAddress(addr)}
                  title={addr.label?.trim() || "Địa chỉ"}
                  description={[addr.street, addr.ward, addr.province]
                    .filter(Boolean)
                    .join(", ")}
                  trailing={
                    addr.isDefault ? (
                      <span className="shrink-0 text-[11px] font-extrabold tracking-[0.04em] text-primary uppercase">
                        Mặc định
                      </span>
                    ) : undefined
                  }
                />
              ))}
              <CheckoutRadioCard
                checked={!selectedSavedAddressId}
                disabled={isSubmitting}
                onChange={clearSavedSelection}
                title="Nhập địa chỉ khác"
                description="Điền tỉnh, phường và số nhà bên dưới"
              />
            </div>
          </div>
        ) : null}

        {showManualAddressForm ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckoutField
                label="Tỉnh / Thành"
                error={errors.address?.provinceCode?.message || errors.address?.province?.message}
              >
                <CheckoutSelect
                  name="address.provinceCode"
                  data-checkout-field="address.provinceCode"
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
                  name="address.wardCode"
                  data-checkout-field="address.wardCode"
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
          </>
        ) : null}

        <CheckoutField label="Ghi chú đơn hàng (tuỳ chọn)" error={errors.note?.message}>
          <CheckoutTextArea
            placeholder="Giao giờ hành chính, gọi trước khi giao…"
            disabled={isSubmitting}
            error={Boolean(errors.note)}
            {...register("note")}
          />
        </CheckoutField>
        {showManualAddressForm ? (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-body">
            <input
              type="checkbox"
              disabled={isSubmitting}
              className="size-4 accent-[var(--color-primary)]"
              {...register("saveInfo")}
            />
            Lưu địa chỉ này cho lần sau
          </label>
        ) : null}
      </div>
    </section>
  );
}
