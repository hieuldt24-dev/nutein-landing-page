"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import {
  ADMIN_COUPONS_SWR_KEY,
  adminCouponDetailSwrKey,
} from "@/features/admin-coupons/constants";
import { adminCouponsService } from "@/features/admin-coupons/services/admin-coupons.service";
import type { AdminDiscountType } from "@/features/admin-coupons/types";
import { useSWRConfig } from "swr";
import { notify } from "@/lib/toast";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium";

interface Props {
  couponId: string | "new";
}

export function AdminCouponForm({ couponId }: Props) {
  const isNew = couponId === "new";
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    isNew ? null : adminCouponDetailSwrKey(couponId),
    () => adminCouponsService.getById(couponId),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<AdminDiscountType>("FIXED");
  const [discount, setDiscount] = useState(30_000);
  const [minOrderValue, setMinOrderValue] = useState<string>("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCode(data.code);
    setDiscountType(data.discountType);
    setDiscount(data.discount);
    setMinOrderValue(data.minOrderValue != null ? String(data.minOrderValue) : "");
    setUsageLimit(data.usageLimit != null ? String(data.usageLimit) : "");
    setIsActive(data.isActive);
    setExpiresAt(data.expiresAt ? data.expiresAt.slice(0, 10) : "");
  }, [data]);

  if (!isNew && isLoading) {
    return (
      <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--color-border-subtle)]" />
    );
  }

  if (!isNew && (error || !data)) {
    return (
      <p className="text-sm font-semibold text-red-700">Không tìm thấy coupon.</p>
    );
  }

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        code,
        discountType,
        discount: Number(discount),
        minOrderValue: minOrderValue === "" ? null : Number(minOrderValue),
        usageLimit: usageLimit === "" ? null : Number(usageLimit),
        isActive,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59.000Z` : null,
      };
      if (isNew) {
        const created = await adminCouponsService.create(payload);
        await globalMutate(ADMIN_COUPONS_SWR_KEY);
        notify.success("Đã tạo coupon.");
        router.replace(`/staff/coupons/${created.id}`);
      } else {
        await adminCouponsService.update(couponId, payload);
        await globalMutate(ADMIN_COUPONS_SWR_KEY);
        await globalMutate(adminCouponDetailSwrKey(couponId));
        notify.success("Đã lưu coupon.");
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-[var(--radius-lg)] border border-ink/15 bg-surface px-5 py-5">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Mã
        <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Loại giảm
        <select
          className={inputClass}
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as AdminDiscountType)}
        >
          <option value="FIXED">Số tiền cố định</option>
          <option value="PERCENTAGE">Phần trăm</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Giá trị giảm
        <input
          type="number"
          min={0}
          className={inputClass}
          value={discount}
          onChange={(e) => setDiscount(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Đơn tối thiểu (để trống = không)
        <input
          type="number"
          min={0}
          className={inputClass}
          value={minOrderValue}
          onChange={(e) => setMinOrderValue(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Giới hạn lượt dùng
        <input
          type="number"
          min={0}
          className={inputClass}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Ngày hết hạn
        <input
          type="date"
          className={inputClass}
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] font-bold">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Đang bật
      </label>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void submit()}
        className="mt-2 inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {isNew ? "Tạo" : "Lưu"}
      </button>
    </div>
  );
}
