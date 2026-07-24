import { getSupabaseClient } from "@/lib/supabase";
import { DEFAULT_PRODUCT_VARIANT_ID, NUTEIN_PRODUCT_DB_ID } from "../constants";
import {
  NUTEIN_PRODUCT,
  NUTEIN_PRODUCT_DETAIL,
} from "../data/product.mock";
import type {
  Product,
  ProductDetail,
  ProductGalleryImage,
  ProductSpec,
  ProductVariant,
} from "../types";

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
  marketing_meta: ProductMarketingMeta | null;
}

const PRODUCT_SELECT = "id, sku, slug, name, description, price, marketing_meta";

/**
 * Cache module-level — nguồn cho `getProductDetail()`/`getCatalogProduct()`
 * (sync, dùng khắp cart/checkout client-side). `refreshCatalogCache()` là
 * best-effort: lỗi/chưa cấu hình Supabase thì giữ nguyên giá trị cache
 * trước đó (khởi tạo = mock) — không throw, không chặn UI render giỏ hàng.
 * `rating` chưa có bảng reviews thật nên vẫn lấy từ mock (ngoài scope).
 */
let cachedDetail: ProductDetail = NUTEIN_PRODUCT_DETAIL;
let cachedCatalog: Product = NUTEIN_PRODUCT;

function rowToProductDetail(row: ProductRow): ProductDetail {
  const meta = row.marketing_meta ?? {};
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: meta.tagline || NUTEIN_PRODUCT_DETAIL.tagline,
    description: row.description ?? NUTEIN_PRODUCT_DETAIL.description,
    unitPrice: Number(row.price),
    currency: "VND",
    rating: NUTEIN_PRODUCT_DETAIL.rating,
    gallery: meta.gallery?.length ? meta.gallery : NUTEIN_PRODUCT_DETAIL.gallery,
    specs: meta.specs?.length ? meta.specs : NUTEIN_PRODUCT_DETAIL.specs,
    variants: meta.variants?.length ? meta.variants : NUTEIN_PRODUCT_DETAIL.variants,
    defaultVariantId: meta.defaultVariantId || DEFAULT_PRODUCT_VARIANT_ID,
    image: meta.image || NUTEIN_PRODUCT_DETAIL.image,
    imageAlt: meta.imageAlt || NUTEIN_PRODUCT_DETAIL.imageAlt,
    unitLabel: meta.unitLabel || NUTEIN_PRODUCT_DETAIL.unitLabel,
  };
}

/**
 * Đọc lại sản phẩm chủ lực từ DB thật (cùng row Staff "Sản phẩm" sửa) và
 * làm mới cache. Gọi ở đầu checkout (server) để đảm bảo giá tính tiền đúng
 * giá Staff đang set, và ở client (useCartStore) để giỏ hàng/hiển thị theo
 * kịp thay đổi mà không cần đổi bất kỳ call site sync nào.
 */
async function refreshCatalogCache(): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", NUTEIN_PRODUCT_DB_ID)
      .maybeSingle();

    if (error || !data) return;

    cachedDetail = rowToProductDetail(data as ProductRow);
    cachedCatalog = {
      id: cachedDetail.id,
      name: cachedDetail.name,
      unitLabel: cachedDetail.unitLabel,
      price: cachedDetail.unitPrice,
      image: cachedDetail.image,
      imageAlt: cachedDetail.imageAlt,
    };
  } catch {
    // best-effort — network/config lỗi thì giữ cache cũ, không chặn UI
  }
}

/**
 * Product domain — `getProductDetail()`/`getCatalogProduct()` sync đọc
 * cache (mock ban đầu, DB thật sau khi `refreshCatalogCache()` chạy xong ít
 * nhất 1 lần). `getProduct()` async luôn refresh trước khi trả — dùng cho
 * PDP Server Component.
 */
export const productService = {
  async getProduct(): Promise<ProductDetail> {
    await refreshCatalogCache();
    return cachedDetail;
  },

  refreshCatalogCache,

  /** Sync accessor — cart/pricing/checkout khi chưa cần async. */
  getProductDetail(): ProductDetail {
    return cachedDetail;
  },

  /** Snapshot catalog cho pricing / order summary. */
  getCatalogProduct(): Product {
    return cachedCatalog;
  },

  resolveVariant(
    product: ProductDetail,
    variantId: string | undefined | null
  ): ProductVariant {
    const id = variantId || product.defaultVariantId || DEFAULT_PRODUCT_VARIANT_ID;
    return (
      product.variants.find((v) => v.id === id) ??
      product.variants.find((v) => v.id === product.defaultVariantId) ??
      product.variants[0]
    );
  },

  /** Giá 1 đơn vị gói (1 pill pack) — `variant.price` hoặc `unitPrice * units`. */
  packPrice(product: ProductDetail, variant: ProductVariant): number {
    if (typeof variant.price === "number") return variant.price;
    return product.unitPrice * variant.units;
  },

  /** Tổng dòng trên PDP: packPrice × qty. */
  lineTotal(product: ProductDetail, variantId: string, qty: number): number {
    const variant = productService.resolveVariant(product, variantId);
    return productService.packPrice(product, variant) * Math.max(1, qty);
  },

  /** Snapshot Product cho cart line — gắn nhãn + giá / gói đang chọn. */
  toCartProduct(product: ProductDetail, variantId?: string | null): Product {
    const variant = productService.resolveVariant(product, variantId);
    return {
      id: product.id,
      name: product.name,
      unitLabel: variant.label,
      price: productService.packPrice(product, variant),
      image: product.image,
      imageAlt: product.imageAlt,
    };
  },
};
