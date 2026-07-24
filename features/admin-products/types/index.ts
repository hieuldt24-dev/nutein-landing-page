import type { ProductGalleryImage, ProductSpec, ProductVariant } from "@/features/product/types";

/**
 * Admin product (S4) — single-SKU Nutein + stock + editable marketing fields.
 * Map gần `products` + variants JSON; storefront `ProductDetail` khi sync API.
 */
export interface AdminProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  unitPrice: number;
  stock: number;
  unitLabel: string;
  image: string;
  imageAlt: string;
  defaultVariantId: string;
  gallery: ProductGalleryImage[];
  specs: ProductSpec[];
  variants: ProductVariant[];
  updatedAt: string;
}

export type AdminProductUpdate = Partial<
  Omit<AdminProduct, "id" | "sku" | "updatedAt">
>;
