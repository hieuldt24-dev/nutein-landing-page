"use client";

import { useState } from "react";
import { MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { notify } from "@/lib/toast";
import type { UpsertAddressInput } from "@/features/account/schemas/address.schema";
import type { ShippingAddress } from "@/features/account/types";
import { AccountAddressForm } from "@/components/account/AccountAddressForm";
import { FillButton } from "@/components/ui/FillButton";
import { useAddresses } from "@/lib/useAddresses";
import { cn } from "@/lib/utils";

export function AccountAddressList() {
  const {
    addresses,
    isLoading,
    error,
    createAddress,
    updateAddress,
    removeAddress,
    setDefaultAddress,
  } = useAddresses();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ShippingAddress | null>(null);

  const handleSave = async (input: UpsertAddressInput) => {
    if (input.id) {
      await updateAddress(input.id, input);
    } else {
      await createAddress(input);
    }
    setMode("list");
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-ink/5" />
    );
  }

  if (error) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-600">
        Không tải được sổ địa chỉ. Thử tải lại trang.
      </p>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">
            Sổ địa chỉ
          </h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Địa chỉ mặc định sẽ được điền sẵn ở trang thanh toán.
          </p>
        </div>
        {mode === "list" ? (
          <FillButton
            variant="cream"
            className="px-4 py-2 text-[13px] font-bold"
            onClick={() => {
              setEditing(null);
              setMode("create");
            }}
          >
            Thêm địa chỉ
          </FillButton>
        ) : null}
      </div>

      {mode === "create" || mode === "edit" ? (
        <div className="mt-5">
          <AccountAddressForm
            initial={mode === "edit" ? editing : null}
            onSubmitAddress={handleSave}
            onCancel={() => {
              setMode("list");
              setEditing(null);
            }}
          />
        </div>
      ) : null}

      {mode === "list" ? (
        addresses.length === 0 ? (
          <p className="mt-5 rounded-[var(--radius-md)] border border-dashed border-ink/20 px-4 py-6 text-center text-sm text-text-muted">
            Chưa có địa chỉ nhận hàng.
          </p>
        ) : (
          <ul className="mt-5 flex list-none flex-col gap-3">
            {addresses.map((addr) => (
              <li
                key={addr.id}
                className={cn(
                  "rounded-[var(--radius-md)] border px-4 py-4",
                  addr.isDefault
                    ? "border-primary/50 bg-primary/5"
                    : "border-ink/10",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MapPin size={16} className="text-primary-deep" />
                      <p className="font-bold text-ink">
                        {addr.label || "Địa chỉ"}
                        {addr.isDefault ? (
                          <span className="ml-2 text-[11px] font-extrabold tracking-[0.04em] text-primary uppercase">
                            Mặc định
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] text-text-body">
                      {addr.street}, {addr.ward}, {addr.province}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!addr.isDefault ? (
                      <button
                        type="button"
                        title="Đặt mặc định"
                        onClick={() => {
                          void setDefaultAddress(addr.id).catch((err) =>
                            notify.error(
                              err instanceof Error
                                ? err.message
                                : "Không đặt được mặc định",
                            ),
                          );
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/70 hover:bg-ink/5"
                      >
                        <Star size={14} />
                        Mặc định
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Sửa"
                      onClick={() => {
                        setEditing(addr);
                        setMode("edit");
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/70 hover:bg-ink/5"
                    >
                      <Pencil size={14} />
                      Sửa
                    </button>
                    <button
                      type="button"
                      title="Xoá"
                      onClick={() => {
                        void removeAddress(addr.id)
                          .then(() => notify.success("Đã xoá địa chỉ."))
                          .catch((err) =>
                            notify.error(
                              err instanceof Error
                                ? err.message
                                : "Xoá thất bại",
                            ),
                          );
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-red-700/80 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Xoá
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
