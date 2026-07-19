import type { Product } from "./types";

/**
 * Sản phẩm chủ lực duy nhất của Nutein (single-SKU).
 *
 * `image` tạm dùng ảnh placeholder có sẵn trong `public/images/` — chưa có
 * ảnh chụp sản phẩm thật (xem docs/frontend-style-overhaul.md về asset còn thiếu).
 * Thay bằng ảnh thật khi có, không cần đổi shape dữ liệu.
 */
export const NUTEIN_PRODUCT: Product = {
  id: "nutein-protein-thuc-vat",
  name: "Nutein",
  unitLabel: "Hộp 1 hũ · Protein thực vật",
  price: 249_000,
  image: "/images/example.jpg",
  imageAlt: "Hộp Protein thực vật Nutein",
};
