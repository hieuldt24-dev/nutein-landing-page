import "server-only";

import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";
import type {
  ProductGalleryImage,
  ProductSpec,
  ProductVariant,
} from "@/features/product/types";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";
import type { AdminProduct, AdminProductUpdate } from "../types";

interface ProductMarketingMeta {
  tagline?: string;
  unitLabel?: string;
  image?: string;
  imageAlt?: string;
  defaultVariantId?: string;
  gallery?: ProductGalleryImage[];
  specs?: ProductSpec[];
  variants?: ProductVariant[];
}

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  price: number | string;
  stock: number;
  marketing_meta: ProductMarketingMeta | null;
  updated_at: string;
}

const PRODUCT_SELECT = "id, sku, slug, name, description, price, stock, marketing_meta, updated_at";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * `marketing_meta` gom mọi field marketing/cosmetic (tagline, ảnh gallery,
 * gói biến thể...) chưa có cột riêng ở `products` — xem migration
 * `20260724010000_admin_content_extra_columns.sql`. `price`/`stock`/`name`/
 * `description` dùng thẳng cột thật (stock là CÙNG cột checkout đọc để
 * chặn oversell).
 */
function toAdminProduct(row: ProductRow): AdminProduct {
  const meta = row.marketing_meta ?? {};
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    tagline: meta.tagline ?? "",
    description: row.description ?? "",
    unitPrice: Number(row.price),
    stock: row.stock,
    unitLabel: meta.unitLabel ?? "",
    image: meta.image ?? "",
    imageAlt: meta.imageAlt ?? "",
    defaultVariantId: meta.defaultVariantId ?? "",
    gallery: meta.gallery ?? [],
    specs: meta.specs ?? [],
    variants: meta.variants ?? [],
    updatedAt: row.updated_at,
  };
}

async function getProduct(): Promise<AdminProduct> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", NUTEIN_PRODUCT_DB_ID)
    .single();

  if (error) {
    throw new Error(`Không tải được sản phẩm: ${error.message}`);
  }
  return toAdminProduct(data as ProductRow);
}

/**
 * Read-modify-write trên `marketing_meta` — Postgres JSONB không hỗ trợ
 * merge một phần qua supabase-js query builder, nên đọc bản hiện tại rồi
 * gộp field trước khi ghi lại nguyên khối.
 */
async function updateProduct(
  patch: AdminProductUpdate,
  staffUserId: string,
): Promise<AdminProduct> {
  const client = requireAdminClient();
  const current = await getProduct();

  const nextMeta: ProductMarketingMeta = {
    tagline: patch.tagline ?? current.tagline,
    unitLabel: patch.unitLabel ?? current.unitLabel,
    image: patch.image ?? current.image,
    imageAlt: patch.imageAlt ?? current.imageAlt,
    defaultVariantId: patch.defaultVariantId ?? current.defaultVariantId,
    gallery: patch.gallery ?? current.gallery,
    specs: patch.specs ?? current.specs,
    variants: patch.variants ?? current.variants,
  };

  const updatePayload: Record<string, unknown> = {
    marketing_meta: nextMeta,
  };
  if (patch.name !== undefined) updatePayload.name = patch.name;
  if (patch.description !== undefined) updatePayload.description = patch.description;
  if (patch.unitPrice !== undefined) updatePayload.price = patch.unitPrice;
  if (patch.stock !== undefined) updatePayload.stock = patch.stock;

  const { data, error } = await client
    .from("products")
    .update(updatePayload)
    .eq("id", NUTEIN_PRODUCT_DB_ID)
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    throw new Error(`Không cập nhật được sản phẩm: ${error.message}`);
  }

  const updated = toAdminProduct(data as ProductRow);
  // Best-effort, không ảnh hưởng response — chạy sau khi Staff đã nhận kết
  // quả cập nhật thay vì chờ thêm 1 round-trip DB ghi audit log.
  after(async () => {
    await auditLogRepository.record({
      userId: staffUserId,
      action: "UPDATE",
      tableName: "products",
      recordId: NUTEIN_PRODUCT_DB_ID,
      oldData: {
        name: current.name,
        description: current.description,
        price: current.unitPrice,
        stock: current.stock,
      },
      newData: {
        name: updated.name,
        description: updated.description,
        price: updated.unitPrice,
        stock: updated.stock,
      },
    });
  });

  return updated;
}

export const adminProductsRepository = {
  getProduct,
  updateProduct,
};
