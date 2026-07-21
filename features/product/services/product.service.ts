import { DEFAULT_PRODUCT_VARIANT_ID } from "../constants";
import {
  NUTEIN_PRODUCT,
  NUTEIN_PRODUCT_DETAIL,
} from "../data/product.mock";
import type { Product, ProductDetail, ProductVariant } from "../types";

/**
 * Product domain — hiện trả mock từ `data/product.mock`.
 * Khi gắn API/DB: đổi thân `getProduct` / sync accessors, giữ chữ ký để page/UI không đổi.
 */
export const productService = {
  async getProduct(): Promise<ProductDetail> {
    return NUTEIN_PRODUCT_DETAIL;
  },

  /** Sync accessor — cart/pricing/checkout khi chưa cần async. */
  getProductDetail(): ProductDetail {
    return NUTEIN_PRODUCT_DETAIL;
  },

  /** Snapshot catalog cho pricing / order summary. */
  getCatalogProduct(): Product {
    return NUTEIN_PRODUCT;
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
