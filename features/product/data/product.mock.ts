import { DEFAULT_PRODUCT_VARIANT_ID } from "../constants";
import type { Product, ProductDetail } from "../types";

/**
 * Chi tiết sản phẩm chủ lực (mock).
 * Khi có API: `productService.getProduct()` đổi nguồn, giữ nguyên shape.
 *
 * Ảnh gallery tạm dùng placeholder trong `public/images/` —
 * thay ảnh thật khi có, không cần đổi shape.
 * Chỉ service được import file này — UI không import mock trực tiếp.
 */
export const NUTEIN_PRODUCT_DETAIL: ProductDetail = {
  id: "nutein-protein-thuc-vat",
  slug: "nutein",
  name: "Nutein",
  tagline: "Protein thực vật — năng lượng sạch cho lối sống lành mạnh mỗi ngày.",
  description:
    "Bột protein thực vật Nutein, dễ pha, phù hợp người ăn chay và tập luyện nhẹ nhàng.",
  unitPrice: 249_000,
  currency: "VND",
  rating: { average: 4.9, count: 128 },
  image: "/images/example.jpg",
  imageAlt: "Hộp Protein thực vật Nutein",
  unitLabel: "Hộp 1 hũ · Protein thực vật",
  defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,
  gallery: [
    {
      id: "gallery-1",
      src: "/images/example.jpg",
      alt: "Hộp Protein thực vật Nutein — góc chính",
    },
    {
      id: "gallery-2",
      src: "/images/yogurt.jpg",
      alt: "Nutein dùng cùng sữa chua",
    },
    {
      id: "gallery-3",
      src: "/images/beans.jpg",
      alt: "Nguyên liệu đậu protein thực vật",
    },
    {
      id: "gallery-4",
      src: "/images/vegetables.jpg",
      alt: "Lối sống xanh cùng Nutein",
    },
  ],
  specs: [
    { id: "spec-protein", value: "20g", label: "Protein / khẩu phần" },
    { id: "spec-plant", value: "100%", label: "Thực vật" },
    { id: "spec-sugar", value: "0g", label: "Đường thêm" },
    { id: "spec-serve", value: "15", label: "Khẩu phần / hộp" },
  ],
  variants: [
    { id: "pack-1", label: "1 hộp", units: 1 },
    { id: "pack-3", label: "3 hộp", units: 3 },
    { id: "pack-6", label: "6 hộp", units: 6 },
  ],
};

/** Snapshot gọn cho cart / checkout — đồng bộ từ detail. */
export const NUTEIN_PRODUCT: Product = {
  id: NUTEIN_PRODUCT_DETAIL.id,
  name: NUTEIN_PRODUCT_DETAIL.name,
  unitLabel: NUTEIN_PRODUCT_DETAIL.unitLabel,
  price: NUTEIN_PRODUCT_DETAIL.unitPrice,
  image: NUTEIN_PRODUCT_DETAIL.image,
  imageAlt: NUTEIN_PRODUCT_DETAIL.imageAlt,
};
