"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  ImageIcon,
  Loader2,
  Package,
  Plus,
  Tags,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { AdminFilterChip } from "@/components/admin/ui/AdminFilterChip";
import { FillButton } from "@/components/ui/FillButton";
import { ADMIN_LOW_STOCK_THRESHOLD } from "@/features/admin-dashboard/constants";
import { ADMIN_PRODUCT_SWR_KEY } from "@/features/admin-products/constants";
import { adminProductsService } from "@/features/admin-products/services/admin-products.service";
import type { AdminProduct } from "@/features/admin-products/types";
import type { ProductGalleryImage, ProductVariant } from "@/features/product/types";
import { notify } from "@/lib/toast";
import { revalidateAfterProductMutation } from "@/lib/admin-swr-revalidate";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { cn, formatCurrencyVnd, formatDate } from "@/lib/utils";

type Draft = AdminProduct;
type ProductTabId = "info" | "variants" | "media" | "stock";

const TABS: {
  id: ProductTabId;
  label: string;
  icon: typeof Package;
}[] = [
  { id: "info", label: "Thông tin bán", icon: Package },
  { id: "variants", label: "Gói biến thể", icon: Tags },
  { id: "media", label: "Hình ảnh", icon: ImageIcon },
  { id: "stock", label: "Tồn kho", icon: Warehouse },
];

/**
 * S4 — product atelier: hero band + 4 tab (thông tin / gói / ảnh / tồn).
 */
export function AdminProductEditor() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    ADMIN_PRODUCT_SWR_KEY,
    () => adminProductsService.getProduct(),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [tab, setTab] = useState<ProductTabId>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [stockAdd, setStockAdd] = useState(0);

  useEffect(() => {
    if (!data) return;
    const next = structuredClone(data);
    setDraft(next);
    setBaseline(JSON.stringify(next));
  }, [data]);

  const dirty =
    !isSubmitting &&
    draft != null &&
    baseline != null &&
    JSON.stringify(draft) !== baseline;
  const { dialog: leaveDialog } = useUnsavedChangesGuard(dirty);

  if (isLoading || !draft) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-[20px] bg-border-subtle" />
        <div className="h-10 w-80 animate-pulse rounded-full bg-border-subtle" />
        <div className="h-64 animate-pulse rounded-[20px] bg-border-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-700">
        Không tải được sản phẩm.
      </p>
    );
  }

  const lowStock = draft.stock < ADMIN_LOW_STOCK_THRESHOLD;
  const stockPct = Math.min(
    100,
    Math.round((draft.stock / Math.max(ADMIN_LOW_STOCK_THRESHOLD, 1)) * 100),
  );

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

  const addVariant = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const id = `variant-${Date.now()}`;
      return {
        ...prev,
        variants: [...prev.variants, { id, label: "Gói mới", units: 1 }],
      };
    });
  };

  const removeVariant = (index: number) => {
    setDraft((prev) => {
      if (!prev || prev.variants.length <= 1) return prev;
      const removed = prev.variants[index];
      const variants = prev.variants.filter((_, i) => i !== index);
      const defaultVariantId =
        prev.defaultVariantId === removed?.id
          ? variants[0]?.id ?? prev.defaultVariantId
          : prev.defaultVariantId;
      return { ...prev, variants, defaultVariantId };
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

  const removeGallery = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gallery: prev.gallery.filter((_, i) => i !== index),
      };
    });
  };

  const clearMainImage = () => {
    setField("image", "");
  };

  const addGalleryFromFile = (file: File) => {
    const id = `gallery-${Date.now()}`;
    const uploadKey = `gallery-new-${id}`;
    void handleUpload(uploadKey, file, (url) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gallery: [...prev.gallery, { id, src: url, alt: "" }],
        };
      });
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

  const applyStockAdd = () => {
    if (stockAdd <= 0) {
      notify.error("Nhập số hộp cần cộng.");
      return;
    }
    setField("stock", draft.stock + stockAdd);
    setStockAdd(0);
    notify.success(`Đã cộng ${stockAdd} vào tồn.`);
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
      setDraft(structuredClone(saved));
      setBaseline(JSON.stringify(saved));
      await revalidateAfterProductMutation(globalMutate);
      notify.success("Đã lưu sản phẩm.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      {leaveDialog}
      <div className="flex justify-end">
        <FillButton
          type="button"
          variant="ink-solid"
          disabled={isSubmitting}
          onClick={() => void handleSave()}
          className="h-10 px-5 text-[13px] font-bold"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Lưu thay đổi
        </FillButton>
      </div>

      {/* Hero band */}
      <div className="flex flex-col gap-5 rounded-[20px] border border-ink/10 bg-surface px-5 py-[22px] shadow-sm sm:flex-row sm:items-center md:px-6">
        <div className="relative size-[104px] shrink-0 overflow-hidden rounded-[20px] bg-primary-soft">
          {draft.image ? (
            <Image
              src={draft.image}
              alt={draft.imageAlt || draft.name}
              fill
              className="object-cover"
              sizes="104px"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[11px] font-bold text-primary-deep">
              ảnh sản phẩm
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(22px,3vw,26px)] font-bold tracking-[-0.03em] text-ink">
            {draft.name}
          </h1>
          <p className="mt-1.5 text-[13.5px] font-medium text-text-muted">
            SKU <b className="text-ink">{draft.sku}</b> · Cập nhật{" "}
            {formatDate(draft.updatedAt, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex min-w-[200px] flex-col gap-1.5 rounded-[14px] border border-ink/10 bg-bg px-5 py-4">
          <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase">
            Tồn kho
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-display text-[28px] font-bold tracking-[-0.03em]",
                lowStock ? "text-danger" : "text-ink",
              )}
            >
              {draft.stock}
            </span>
            <span className="text-[13px] font-semibold text-text-muted">
              / ngưỡng {ADMIN_LOW_STOCK_THRESHOLD} hộp
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-ink/10">
            <span
              className={cn(
                "block h-full rounded-full",
                lowStock ? "bg-danger" : "bg-forest",
              )}
              style={{ width: `${stockPct}%` }}
            />
          </span>
          {lowStock ? (
            <span className="text-[12px] font-semibold text-danger">
              Sắp hết hàng
            </span>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Phần chỉnh sửa sản phẩm"
        className="flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <AdminFilterChip
              key={item.id}
              active={active}
              onClick={() => setTab(item.id)}
              className="inline-flex h-[38px] items-center gap-2 px-[18px]"
            >
              {active ? (
                <Icon size={15} strokeWidth={2.1} aria-hidden />
              ) : null}
              {item.label}
            </AdminFilterChip>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="rounded-[20px] border border-ink/10 bg-surface px-5 py-6 shadow-sm md:px-6"
      >
        {tab === "info" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên sản phẩm">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Field>
            <Field label="Đơn giá / hộp">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.unitPrice}
                onChange={(e) => setField("unitPrice", Number(e.target.value))}
              />
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
                value={draft.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
              />
            </Field>
            <Field label="Nhãn đơn vị">
              <input
                className={inputClass}
                value={draft.unitLabel}
                onChange={(e) => setField("unitLabel", e.target.value)}
              />
            </Field>
            <Field label="Gói mặc định">
              <select
                className={inputClass}
                value={draft.defaultVariantId}
                onChange={(e) => setField("defaultVariantId", e.target.value)}
              >
                {draft.variants.map((v) => {
                  const price = v.price ?? draft.unitPrice * v.units;
                  return (
                    <option key={v.id} value={v.id}>
                      {v.label} — {formatCurrencyVnd(price)}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
        ) : null}

        {tab === "variants" ? (
          <div className="flex flex-col gap-4">
            <ul className="m-0 list-none space-y-3 p-0">
              {draft.variants.map((v, i) => {
                const isDefault = v.id === draft.defaultVariantId;
                return (
                  <li
                    key={v.id}
                    className="rounded-[14px] border border-ink/10 bg-bg px-4 py-4"
                  >
                    {isDefault ? (
                      <span className="mb-2 inline-flex rounded-full bg-ink/[0.06] px-3 py-1 text-[10.5px] font-extrabold tracking-[0.02em] text-text-muted uppercase">
                        Mặc định cửa hàng
                      </span>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Field label="Nhãn">
                        <input
                          className={inputClass}
                          value={v.label}
                          onChange={(e) =>
                            updateVariant(i, { label: e.target.value })
                          }
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
                      <Field label="Giá gói">
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
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,120px)] sm:items-end">
                      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-ink/10 bg-surface px-3 text-[12px] font-bold text-text-body">
                        <input
                          type="checkbox"
                          checked={v.offer?.freeShipping ?? false}
                          onChange={(e) =>
                            updateVariant(i, {
                              offer: { ...v.offer, freeShipping: e.target.checked },
                            })
                          }
                        />
                        Freeship
                      </label>
                      <Field label="Quà tặng / quyền lợi">
                        <input
                          className={inputClass}
                          value={v.offer?.giftDescription ?? ""}
                          placeholder="Ví dụ: Tặng 1 bình nước"
                          onChange={(e) =>
                            updateVariant(i, {
                              offer: { ...v.offer, giftDescription: e.target.value || undefined },
                            })
                          }
                        />
                      </Field>
                      <Field label="Số hộp tặng">
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={v.offer?.giftUnits ?? ""}
                          onChange={(e) =>
                            updateVariant(i, {
                              offer: {
                                ...v.offer,
                                giftUnits: e.target.value === "" ? undefined : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!isDefault ? (
                        <button
                          type="button"
                          onClick={() => setField("defaultVariantId", v.id)}
                          className="cursor-pointer rounded-full border border-ink/15 bg-surface px-3 py-1.5 text-[12px] font-bold text-text-body hover:text-ink"
                        >
                          Đặt làm mặc định
                        </button>
                      ) : null}
                      {draft.variants.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="cursor-pointer rounded-full border border-danger/30 px-3 py-1.5 text-[12px] font-bold text-danger hover:bg-danger/5"
                        >
                          Xóa gói
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex h-[42px] w-fit cursor-pointer items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-ink/25 px-5 text-[13px] font-bold text-text-body hover:border-ink/40 hover:text-ink"
            >
              <Plus size={15} strokeWidth={2.4} aria-hidden />
              Thêm gói
            </button>
          </div>
        ) : null}

        {tab === "media" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start gap-2.5">
              {/* Ảnh chính */}
              <div className="w-[100px]">
                <p className="mb-1.5 text-[11px] font-bold tracking-[0.04em] text-text-muted uppercase">
                  Chính
                </p>
                <div className="group relative aspect-square overflow-hidden rounded-[12px] bg-primary-soft">
                  {draft.image ? (
                    <Image
                      src={draft.image}
                      alt={draft.imageAlt || "Ảnh chính"}
                      fill
                      className="object-cover"
                      sizes="100px"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[10px] font-bold text-primary-deep">
                      trống
                    </div>
                  )}
                  {draft.image ? (
                    <button
                      type="button"
                      aria-label="Xóa ảnh chính"
                      onClick={clearMainImage}
                      className="absolute top-1 right-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-ink/80 text-bg opacity-100 transition-opacity md:size-6 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  ) : null}
                </div>
                <label className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-full border border-ink/15 text-[11px] font-bold text-text-body hover:bg-ink/[0.04] hover:text-ink">
                  {uploadingKey === "main" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : draft.image ? (
                    "Đổi"
                  ) : (
                    "Chọn"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingKey === "main"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) {
                        void handleUpload("main", file, (url) =>
                          setField("image", url),
                        );
                      }
                    }}
                  />
                </label>
              </div>

              {/* Gallery */}
              {draft.gallery.map((g, i) => (
                <div key={g.id} className="w-[100px]">
                  <p className="mb-1.5 truncate text-[11px] font-bold tracking-[0.04em] text-text-muted uppercase">
                    Thành phần {i + 1}
                  </p>
                  <div className="group relative aspect-square overflow-hidden rounded-[12px] bg-sky/40">
                    {g.src ? (
                      <Image
                        src={g.src}
                        alt={g.alt || `Gallery ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="100px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] font-bold text-forest">
                        trống
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Xóa gallery ${i + 1}`}
                      onClick={() => removeGallery(i)}
                      className="absolute top-1 right-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-ink/80 text-bg opacity-100 transition-opacity md:size-6 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 size={11} strokeWidth={2.2} />
                    </button>
                  </div>
                  <label className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-full border border-ink/15 text-[11px] font-bold text-text-body hover:bg-ink/[0.04] hover:text-ink">
                    {uploadingKey === `gallery-${i}`
                      ? "…"
                      : g.src
                        ? "Đổi"
                        : "Chọn"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
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
                  </label>
                </div>
              ))}

              <div className="w-[100px]">
                <p className="mb-1.5 text-[11px] font-bold tracking-[0.04em] text-transparent uppercase">
                  Thêm
                </p>
                <label
                  className={cn(
                    "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-ink/25 text-text-muted hover:border-ink/40 hover:text-ink",
                    uploadingKey?.startsWith("gallery-new-") && "opacity-60",
                  )}
                >
                  {uploadingKey?.startsWith("gallery-new-") ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus size={16} strokeWidth={2.2} aria-hidden />
                  )}
                  <span className="text-[11px] font-bold">Thêm</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={Boolean(uploadingKey?.startsWith("gallery-new-"))}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) addGalleryFromFile(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Mô tả ảnh">
                <input
                  className={inputClass}
                  value={draft.imageAlt}
                  onChange={(e) => setField("imageAlt", e.target.value)}
                />
              </Field>
              <Field label="Link ảnh">
                <input
                  className={inputClass}
                  value={draft.image}
                  onChange={(e) => setField("image", e.target.value)}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "stock" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-[14px] border bg-surface px-5 py-5",
                  lowStock ? "border-danger/30" : "border-ink/12",
                )}
              >
                <p className="text-[11px] font-bold tracking-[0.06em] text-text-muted uppercase">
                  Tồn hiện tại
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className={cn(
                      "font-display text-[40px] font-bold tracking-[-0.03em]",
                      lowStock ? "text-danger" : "text-ink",
                    )}
                  >
                    {draft.stock}
                  </span>
                  <span className="text-[14px] font-semibold text-text-muted">
                    {draft.unitLabel || "hộp"}
                  </span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-ink/10">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      lowStock ? "bg-danger" : "bg-forest",
                    )}
                    style={{ width: `${stockPct}%` }}
                  />
                </span>
                {lowStock ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-danger">
                    <span className="size-[7px] rounded-full bg-danger" />
                    Sắp hết hàng
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 rounded-[14px] border border-ink/12 bg-surface px-5 py-5">
                <Field label="Nhập thêm (hộp)">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={stockAdd || ""}
                    onChange={(e) => setStockAdd(Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Đặt tồn mới">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={draft.stock}
                    onChange={(e) => setField("stock", Number(e.target.value))}
                  />
                </Field>
                <button
                  type="button"
                  onClick={applyStockAdd}
                  className="inline-flex h-10 w-fit cursor-pointer items-center rounded-full border-[1.5px] border-ink/20 px-[18px] text-[13px] font-bold text-ink hover:bg-ink/[0.04]"
                >
                  Cộng vào tồn
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[14px] border border-ink/20 bg-bg px-3.5 py-2.5 text-[14px] font-medium text-ink disabled:opacity-60";

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
