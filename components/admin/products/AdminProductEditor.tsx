"use client";

import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ImageIcon, Loader2, Package, Tags } from "lucide-react";
import { ADMIN_PRODUCT_SWR_KEY } from "@/features/admin-products/constants";
import { adminProductsService } from "@/features/admin-products/services/admin-products.service";
import type { AdminProduct } from "@/features/admin-products/types";
import type { ProductGalleryImage, ProductVariant } from "@/features/product/types";
import { notify } from "@/lib/toast";
import { cn, formatCurrencyVnd, formatDate } from "@/lib/utils";

type Draft = AdminProduct;
type ProductTabId = "info" | "variants" | "media";

const TABS: {
  id: ProductTabId;
  label: string;
  icon: typeof Package;
}[] = [
  { id: "info", label: "Thông tin bán", icon: Package },
  { id: "variants", label: "Gói biến thể", icon: Tags },
  { id: "media", label: "Hình ảnh", icon: ImageIcon },
];

/**
 * S4 — editor single-SKU, chia tab cho UX gọn.
 */
export function AdminProductEditor() {
  const { data, error, isLoading, mutate } = useSWR(
    ADMIN_PRODUCT_SWR_KEY,
    () => adminProductsService.getProduct(),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<ProductTabId>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(structuredClone(data));
  }, [data]);

  if (isLoading || !draft) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-border-subtle" />
    );
  }

  if (error) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được sản phẩm.
      </p>
    );
  }

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const variants = prev.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      );
      return { ...prev, variants };
    });
  };

  const updateGallery = (index: number, patch: Partial<ProductGalleryImage>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const gallery = prev.gallery.map((g, i) =>
        i === index ? { ...g, ...patch } : g,
      );
      return { ...prev, gallery };
    });
  };

  const handleUpload = async (
    key: string,
    file: File,
    onDone: (url: string) => void,
  ) => {
    setUploadingKey(key);
    try {
      const url = await adminProductsService.uploadImage(file);
      onDone(url);
      notify.success("Đã tải ảnh lên.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại.");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const saved = await adminProductsService.updateProduct({
        name: draft.name,
        tagline: draft.tagline,
        description: draft.description,
        unitPrice: Number(draft.unitPrice),
        stock: Number(draft.stock),
        unitLabel: draft.unitLabel,
        image: draft.image,
        imageAlt: draft.imageAlt,
        defaultVariantId: draft.defaultVariantId,
        gallery: draft.gallery,
        specs: draft.specs,
        variants: draft.variants,
      });
      await mutate(saved, { revalidate: false });
      notify.success("Đã lưu sản phẩm.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted">
          SKU <span className="font-semibold text-ink">{draft.sku}</span> · Cập nhật{" "}
          {formatDate(draft.updatedAt, { hour: "2-digit", minute: "2-digit" })}
        </p>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleSave()}
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Lưu thay đổi
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Phần chỉnh sửa sản phẩm"
        className="flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-colors",
                active
                  ? "bg-primary-soft text-ink"
                  : "text-text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              <Icon
                size={16}
                strokeWidth={2.1}
                className={active ? "text-primary-deep" : undefined}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="rounded-[var(--radius-lg)] border border-ink/10 bg-surface px-5 py-5 md:px-6"
      >
        {tab === "info" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Field>
            <Field label="Slug">
              <input className={inputClass} value={draft.slug} disabled readOnly />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <input
                className={inputClass}
                value={draft.tagline}
                onChange={(e) => setField("tagline", e.target.value)}
              />
            </Field>
            <Field label="Mô tả" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={4}
                value={draft.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </Field>
            <Field label={`Đơn giá / hũ (${formatCurrencyVnd(draft.unitPrice)})`}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.unitPrice}
                onChange={(e) => setField("unitPrice", Number(e.target.value))}
              />
            </Field>
            <Field label="Tồn kho (đơn vị)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.stock}
                onChange={(e) => setField("stock", Number(e.target.value))}
              />
            </Field>
            <Field label="Nhãn đơn vị" className="sm:col-span-2">
              <input
                className={inputClass}
                value={draft.unitLabel}
                onChange={(e) => setField("unitLabel", e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {tab === "variants" ? (
          <div>
            <p className="mb-4 text-[13px] text-text-muted">
              Mỗi gói = số hũ × đơn giá (trừ khi nhập giá gói riêng).
            </p>
            <ul className="m-0 list-none space-y-4 p-0">
              {draft.variants.map((v, i) => (
                <li
                  key={v.id}
                  className="grid gap-2 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-4 py-4 sm:grid-cols-3"
                >
                  <Field label="Nhãn">
                    <input
                      className={inputClass}
                      value={v.label}
                      onChange={(e) => updateVariant(i, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Số hũ / gói">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={v.units}
                      onChange={(e) =>
                        updateVariant(i, { units: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Giá gói (tuỳ chọn)">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={v.price ?? ""}
                      placeholder="Tự tính từ đơn giá"
                      onChange={(e) =>
                        updateVariant(i, {
                          price:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "media" ? (
          <div>
            <p className="mb-4 text-[13px] text-text-muted">
              Dán URL / path public, hoặc chọn ảnh để upload lên Cloudinary (tối đa 5MB).
            </p>
            <Field label="Ảnh chính">
              <input
                className={inputClass}
                value={draft.image}
                onChange={(e) => setField("image", e.target.value)}
              />
            </Field>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                disabled={uploadingKey === "main"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    void handleUpload("main", file, (url) => setField("image", url));
                  }
                }}
              />
              {uploadingKey === "main" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
            </div>
            <Field label="Alt ảnh chính" className="mt-3">
              <input
                className={inputClass}
                value={draft.imageAlt}
                onChange={(e) => setField("imageAlt", e.target.value)}
              />
            </Field>
            <ul className="mt-4 m-0 list-none space-y-3 p-0">
              {draft.gallery.map((g, i) => (
                <li
                  key={g.id}
                  className="grid gap-2 rounded-[var(--radius-md)] border border-ink/10 bg-bg px-4 py-4 sm:grid-cols-2"
                >
                  <Field label={`Gallery ${i + 1} src`}>
                    <input
                      className={inputClass}
                      value={g.src}
                      onChange={(e) => updateGallery(i, { src: e.target.value })}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingKey === `gallery-${i}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) {
                            void handleUpload(`gallery-${i}`, file, (url) =>
                              updateGallery(i, { src: url }),
                            );
                          }
                        }}
                      />
                      {uploadingKey === `gallery-${i}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Alt">
                    <input
                      className={inputClass}
                      value={g.alt}
                      onChange={(e) => updateGallery(i, { alt: e.target.value })}
                    />
                  </Field>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-ink/20 bg-bg px-3 py-2 text-[14px] font-medium text-ink disabled:opacity-60";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-1.5 text-[13px] font-bold text-ink ${className ?? ""}`}
    >
      {label}
      {children}
    </label>
  );
}
