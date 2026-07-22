import { NUTEIN_PRODUCT_DETAIL } from "@/features/product/data/product.mock";
import type { AdminProduct } from "../types";

/** Seed từ PDP mock + stock — chỉ service import. */
export const MOCK_ADMIN_PRODUCT: AdminProduct = {
  id: NUTEIN_PRODUCT_DETAIL.id,
  sku: "NUTEIN-PV-001",
  slug: NUTEIN_PRODUCT_DETAIL.slug,
  name: NUTEIN_PRODUCT_DETAIL.name,
  tagline: NUTEIN_PRODUCT_DETAIL.tagline,
  description: NUTEIN_PRODUCT_DETAIL.description ?? "",
  unitPrice: NUTEIN_PRODUCT_DETAIL.unitPrice,
  stock: 48,
  unitLabel: NUTEIN_PRODUCT_DETAIL.unitLabel,
  image: NUTEIN_PRODUCT_DETAIL.image,
  imageAlt: NUTEIN_PRODUCT_DETAIL.imageAlt,
  defaultVariantId: NUTEIN_PRODUCT_DETAIL.defaultVariantId,
  gallery: structuredClone(NUTEIN_PRODUCT_DETAIL.gallery),
  specs: structuredClone(NUTEIN_PRODUCT_DETAIL.specs),
  variants: structuredClone(NUTEIN_PRODUCT_DETAIL.variants),
  updatedAt: "2026-07-18T00:00:00.000Z",
};
