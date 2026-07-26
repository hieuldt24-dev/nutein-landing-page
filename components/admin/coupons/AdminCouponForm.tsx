"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Loader2 } from "lucide-react";
import { AdminBackLink } from "@/components/admin/ui/AdminBackLink";
import { AdminToggle } from "@/components/admin/ui/AdminToggle";
import { FillButton } from "@/components/ui/FillButton";
import {
  ADMIN_COUPONS_SWR_KEY,
  adminCouponDetailSwrKey,
} from "@/features/admin-coupons/constants";
import { adminCouponsService } from "@/features/admin-coupons/services/admin-coupons.service";
import type { AdminDiscountType } from "@/features/admin-coupons/types";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { notify } from "@/lib/toast";
import { cn, formatCurrencyVnd } from "@/lib/utils";

const inputClass =
  "w-full rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium text-ink";

const EXAMPLE_ORDER = 450_000;

const EMPTY_SNAPSHOT = JSON.stringify({
  code: "",
  discountType: "FIXED",
  discount: 30_000,
  minOrderValue: "",
  usageLimit: "",
  isActive: true,
  expiresAt: "",
});

interface Props {
  couponId: string | "new";
}

function snapshotOf(fields: {
  code: string;
  discountType: AdminDiscountType;
  discount: number;
  minOrderValue: string;
  usageLimit: string;
  isActive: boolean;
  expiresAt: string;
}): string {
  return JSON.stringify(fields);
}

export function AdminCouponForm({ couponId }: Props) {
  const isNew = couponId === "new";
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    isNew ? null : adminCouponDetailSwrKey(couponId),
    () => adminCouponsService.getById(couponId),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<AdminDiscountType>("FIXED");
  const [discount, setDiscount] = useState(30_000);
  const [minOrderValue, setMinOrderValue] = useState<string>("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseline, setBaseline] = useState(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!data) return;
    const next = {
      code: data.code,
      discountType: data.discountType,
      discount: data.discount,
      minOrderValue:
        data.minOrderValue != null ? String(data.minOrderValue) : "",
      usageLimit: data.usageLimit != null ? String(data.usageLimit) : "",
      isActive: data.isActive,
      expiresAt: data.expiresAt ? data.expiresAt.slice(0, 10) : "",
    };
    setCode(next.code);
    setDiscountType(next.discountType);
    setDiscount(next.discount);
    setMinOrderValue(next.minOrderValue);
    setUsageLimit(next.usageLimit);
    setIsActive(next.isActive);
    setExpiresAt(next.expiresAt);
    setBaseline(snapshotOf(next));
  }, [data]);

  const currentSnapshot = useMemo(
    () =>
      snapshotOf({
        code,
        discountType,
        discount,
        minOrderValue,
        usageLimit,
        isActive,
        expiresAt,
      }),
    [code, discountType, discount, minOrderValue, usageLimit, isActive, expiresAt],
  );

  const dirty = !isSubmitting && currentSnapshot !== baseline;
  const { dialog: leaveDialog } = useUnsavedChangesGuard(dirty);

  const example = useMemo(() => {
    const minOk =
      minOrderValue === "" || EXAMPLE_ORDER >= Number(minOrderValue);
    if (!minOk) {
      return {
        ok: false as const,
        message: `Đơn mẫu ${formatCurrencyVnd(EXAMPLE_ORDER)} chưa đạt tối thiểu.`,
      };
    }
    const cut =
      discountType === "PERCENTAGE"
        ? Math.round((EXAMPLE_ORDER * discount) / 100)
        : discount;
    const pay = Math.max(0, EXAMPLE_ORDER - cut);
    return {
      ok: true as const,
      cut,
      pay,
    };
  }, [discount, discountType, minOrderValue]);

  const previewLabel =
    discountType === "PERCENTAGE"
      ? `Giảm ${discount}%`
      : `Giảm ${formatCurrencyVnd(discount)}`;

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
        setBaseline(currentSnapshot);
        notify.success("Đã tạo coupon.");
        router.replace(`/staff/coupons/${created.id}`);
      } else {
        await adminCouponsService.update(couponId, payload);
        await globalMutate(ADMIN_COUPONS_SWR_KEY);
        await globalMutate(adminCouponDetailSwrKey(couponId));
        setBaseline(currentSnapshot);
        notify.success("Đã lưu coupon.");
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="h-48 animate-pulse rounded-[20px] border border-ink/10 bg-border-subtle" />
    );
  }

  if (!isNew && (error || !data)) {
    return (
      <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tìm thấy coupon.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      {leaveDialog}
      <AdminBackLink href="/staff/coupons">Coupon</AdminBackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(26px,6vw,32px)] font-bold tracking-[-0.03em] text-ink">
          {isNew ? "Tạo coupon" : "Sửa coupon"}
        </h1>
        <FillButton
          type="button"
          variant="ink-solid"
          disabled={isSubmitting}
          onClick={() => void submit()}
          className="h-11 px-5 text-[13px] font-bold"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isNew ? "Tạo coupon" : "Lưu"}
        </FillButton>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4 rounded-[20px] border border-ink/10 bg-surface px-5 py-5 shadow-sm md:px-6">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Mã
            <input
              className={cn(inputClass, "font-mono tracking-wide uppercase")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>

          <div>
            <p className="mb-1.5 text-[13px] font-bold text-ink">Loại giảm</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["PERCENTAGE", "Phần trăm"],
                  ["FIXED", "Số tiền"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiscountType(value)}
                  className={cn(
                    "h-9 cursor-pointer rounded-full px-4 text-[12.5px] font-bold transition-colors",
                    discountType === value
                      ? "bg-ink text-bg"
                      : "border border-ink/15 bg-bg text-text-body hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Giá trị giảm
            <input
              type="number"
              min={0}
              className={inputClass}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Đơn tối thiểu
            <input
              type="number"
              min={0}
              className={inputClass}
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Giới hạn lượt dùng
            <input
              type="number"
              min={0}
              className={inputClass}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Không giới hạn"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Ngày hết hạn
            <input
              type="date"
              className={inputClass}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold text-ink">Đang bật</span>
            <AdminToggle
              checked={isActive}
              onChange={setIsActive}
              label="Bật coupon"
            />
          </div>
        </div>

        <aside className="rounded-[20px] border border-ink/10 bg-surface px-5 py-5 shadow-sm">
          <p className="text-[11px] font-extrabold tracking-[0.06em] text-text-muted uppercase">
            Xem trước
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-primary/40 bg-primary-soft px-4 py-2">
            <span className="font-mono text-[14px] font-extrabold tracking-wide text-ink">
              {code.trim() || "MÃ-COUPON"}
            </span>
            <span className="mx-2 text-text-faint">·</span>
            <span className="text-[13px] font-bold text-primary-deep">
              {previewLabel}
            </span>
          </div>
          <p className="mt-4 text-[13px] font-medium leading-relaxed text-text-muted">
            {example.ok ? (
              <>
                Ví dụ đơn {formatCurrencyVnd(EXAMPLE_ORDER)} được giảm{" "}
                <b className="text-forest">{formatCurrencyVnd(example.cut)}</b>,
                khách trả{" "}
                <b className="text-ink">{formatCurrencyVnd(example.pay)}</b>.
              </>
            ) : (
              example.message
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}
