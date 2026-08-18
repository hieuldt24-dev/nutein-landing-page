import { DEFAULT_PRODUCT_VARIANT_ID } from "../constants";
import {
  NUTEIN_PRODUCT,
  NUTEIN_PRODUCT_DETAIL,
} from "../data/product.mock";
import {
  DEFAULT_PRODUCT_GALLERY,
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_PRODUCT_IMAGE_ALT,
  isLegacyProductGallery,
  isLegacyProductImage,
} from "../data/product-media";
import type {
  Product,
  ProductDetail,
  ProductGalleryImage,
  ProductSpec,
  ProductVariant,
} from "../types";

export interface ProductMarketingMeta {
  tagline?: string;
  unitLabel?: string;
  image?: string;
  imageAlt?: string;
  defaultVariantId?: string;
  gallery?: ProductGalleryImage[];
  specs?: ProductSpec[];
  variants?: ProductVariant[];
}

/** Database row shape used only by the server catalog reader. */
export interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  price: number | string;
  marketing_meta: ProductMarketingMeta | null;
  stock: number;
}

// This module is deliberately free of Supabase imports. The browser has one
// auth client (supabaseBrowser); server and API code hydrate this cache.
let cachedDetail: ProductDetail = NUTEIN_PRODUCT_DETAIL;
let cachedCatalog: Product = NUTEIN_PRODUCT;

export function rowToProductDetail(row: ProductRow): ProductDetail {
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
    gallery: meta.gallery?.length && !isLegacyProductGallery(meta.gallery)
      ? meta.gallery
      : DEFAULT_PRODUCT_GALLERY,
    specs: meta.specs?.length ? meta.specs : NUTEIN_PRODUCT_DETAIL.specs,
    variants: meta.variants?.length ? meta.variants : NUTEIN_PRODUCT_DETAIL.variants,
    defaultVariantId: meta.defaultVariantId || DEFAULT_PRODUCT_VARIANT_ID,
    image: meta.image && !isLegacyProductImage(meta.image)
      ? meta.image
      : DEFAULT_PRODUCT_IMAGE,
    imageAlt: meta.imageAlt || DEFAULT_PRODUCT_IMAGE_ALT,
    unitLabel: meta.unitLabel || NUTEIN_PRODUCT_DETAIL.unitLabel,
  };
}

function setProductDetail(product: ProductDetail): void {
  cachedDetail = product;
  cachedCatalog = {
    id: product.id,
    name: product.name,
    unitLabel: product.unitLabel,
    price: product.unitPrice,
    image: product.image,
    imageAlt: product.imageAlt,
  };
}

/**
 * Returns the lowest valid bundle price for an exact number of jars.
 *
 * The cart stores a selected package plus its quantity, but the offer table
 * is based on the total number of jars. Dynamic programming keeps that rule
 * true for every combination (for example, 1 hộp × 2 uses the 2-hộp price)
 * and also remains compatible with future variants edited by Staff.
 */
function bundlePrice(product: ProductDetail, totalUnits: number): number {
  const units = Math.max(0, Math.floor(totalUnits));
  if (units === 0) return 0;

  const best = Array<number>(units + 1).fill(Number.POSITIVE_INFINITY);
  best[0] = 0;

  for (let target = 1; target <= units; target += 1) {
    for (const variant of product.variants) {
      if (variant.units > target) continue;
      const packagePrice = productService.packPrice(product, variant);
      const previous = best[target - variant.units];
      if (Number.isFinite(previous)) {
        best[target] = Math.min(best[target], previous + packagePrice);
      }
    }
  }

  return Number.isFinite(best[units])
    ? best[units]
    : product.unitPrice * units;
}

/** Product domain helpers shared by server pricing and client UI. */
export const productService = {
  /** Hydrate the sync cache from the server reader or public catalog API. */
  setProductDetail,

  getProductDetail(): ProductDetail {
    return cachedDetail;
  },

  getCatalogProduct(): Product {
    return cachedCatalog;
  },

  resolveVariant(
    product: ProductDetail,
    variantId: string | undefined | null,
  ): ProductVariant {
    const id = variantId || product.defaultVariantId || DEFAULT_PRODUCT_VARIANT_ID;
    return (
      product.variants.find((variant) => variant.id === id) ??
      product.variants.find((variant) => variant.id === product.defaultVariantId) ??
      product.variants[0]
    );
  },

  packPrice(product: ProductDetail, variant: ProductVariant): number {
    if (typeof variant.price === "number") return variant.price;
    return product.unitPrice * variant.units;
  },

  bundlePrice,

  lineTotal(product: ProductDetail, variantId: string, qty: number): number {
    const variant = productService.resolveVariant(product, variantId);
    return productService.bundlePrice(product, variant.units * Math.max(1, qty));
  },

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
