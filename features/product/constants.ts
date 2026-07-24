/** Variant mặc định — dùng khi cart chưa có / migrate localStorage cũ. */
export const DEFAULT_PRODUCT_VARIANT_ID = "pack-1";

/**
 * UUID sản phẩm chủ lực trong `products`
 * (migration `20260721000000_seed_product_order_code_cart_variant.sql`).
 */
export const NUTEIN_PRODUCT_DB_ID =
  "a0000000-0000-4000-8000-000000000001";

export const PRODUCT_PAGE_META = {
  title: "Sản phẩm Nutein | Protein thực vật",
  description:
    "Mua Protein thực vật Nutein — chọn gói 1, 3 hoặc 6 hộp, giao hàng toàn quốc.",
} as const;
