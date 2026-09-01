import { DEFAULT_PRODUCT_VARIANT_ID } from "../constants";
import {
  DEFAULT_PRODUCT_GALLERY,
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_PRODUCT_IMAGE_ALT,
} from "./product-media";
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
  unitPrice: 449_000,
  currency: "VND",
  rating: { average: 4.9, count: 128 },
  image: DEFAULT_PRODUCT_IMAGE,
  imageAlt: DEFAULT_PRODUCT_IMAGE_ALT,
  unitLabel: "Hộp 1 hũ · Protein thực vật",
  defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,
  gallery: DEFAULT_PRODUCT_GALLERY,
  specs: [
    { id: "spec-protein", value: "11g", label: "PROTEIN / GÓI 30G" },
    { id: "spec-plant", value: "ĐẠM", label: "THỰC VẬT LÀNH TÍNH" },
    { id: "spec-fiber", value: "1.8g", label: "CHẤT XƠ HÒA TAN" },
    { id: "spec-serve", value: "20", label: "KHẨU PHẦN / HỘP" },
  ],
  variants: [
    {
      id: "pack-1",
      label: "1 hộp",
      units: 1,
      price: 449_000,
      offer: { freeShipping: true },
    },
    {
      id: "pack-2",
      label: "2 hộp",
      units: 2,
      price: 778_000,
      offer: { freeShipping: true, giftDescription: "Tặng 1 bình nước", giftUnits: 1 },
    },
    {
      id: "pack-3",
      label: "3 hộp",
      units: 3,
      price: 1_167_000,
      offer: {
        freeShipping: true,
        giftDescription: "Tặng 1 hộp + 1 bình nước",
        giftUnits: 1,
      },
    },
    {
      id: "pack-5",
      label: "5 hộp",
      units: 5,
      price: 1_945_000,
      offer: {
        freeShipping: true,
        giftDescription: "Tặng 1 hộp + 1 bình nước",
        giftUnits: 1,
      },
    },
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
