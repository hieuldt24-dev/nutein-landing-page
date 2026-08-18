/**
 * Type của sản phẩm Nutein — single-SKU (xem PROJECT_REQUIREMENTS.md mục 1).
 * Không có `productId` tham chiếu tới nhiều bản ghi sản phẩm khác nhau,
 * chỉ 1 entity sản phẩm chủ lực duy nhất + variant đóng gói.
 */

/** Snapshot gọn cho cart line / checkout summary. */
export interface Product {
  id: string;
  name: string;
  /** Nhãn đơn vị đóng gói đang chọn, ví dụ "Hộp 1 hũ". */
  unitLabel: string;
  /** Đơn giá mỗi hũ, đơn vị VND. */
  price: number;
  image: string;
  imageAlt: string;
}

/** Gói đóng (1 / 3 / 6 hộp…) — variant của 1 SKU, không phải sản phẩm khác. */
export interface ProductVariant {
  id: string;
  label: string;
  /** Số hũ tương ứng 1 đơn vị gói — dùng nhân quantity khi ATC. */
  units: number;
  /** Giá gói (VND). Nếu omit, UI/service tính `unitPrice * units`. */
  price?: number;
  /** Ưu đãi gắn với chính gói này; được lưu trong marketing_meta để Admin chỉnh được. */
  offer?: ProductVariantOffer;
}

export interface ProductVariantOffer {
  freeShipping?: boolean;
  giftDescription?: string;
  giftUnits?: number;
}

export interface ProductGalleryImage {
  id: string;
  src: string;
  alt: string;
  /** Preserve the entire artwork in the PDP focal panel when it contains copy. */
  fit?: "cover" | "contain";
}

export interface ProductSpec {
  id: string;
  value: string;
  label: string;
}

export interface ProductRating {
  average: number;
  count: number;
}

/**
 * DTO trang PDP / API product tương lai.
 * UI nhận shape này từ `productService.getProduct()` — không hardcode field rời.
 */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description?: string;
  /** Đơn giá mỗi hũ (VND). */
  unitPrice: number;
  currency: string;
  rating: ProductRating;
  gallery: ProductGalleryImage[];
  specs: ProductSpec[];
  variants: ProductVariant[];
  defaultVariantId: string;
  image: string;
  imageAlt: string;
  /** Nhãn mặc định khi chưa resolve variant (cart empty / fallback). */
  unitLabel: string;
}
