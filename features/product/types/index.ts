/**
 * Type của sản phẩm Nutein — single-SKU (xem PROJECT_REQUIREMENTS.md mục 1).
 * Không có `productId` tham chiếu tới nhiều bản ghi sản phẩm khác nhau,
 * chỉ 1 entity sản phẩm chủ lực duy nhất.
 */
export interface Product {
  id: string;
  name: string;
  /** Nhãn đơn vị đóng gói, ví dụ "Hộp 1 hũ" — chỗ đứng cho biến thể/combo tương lai. */
  unitLabel: string;
  /** Đơn giá, đơn vị VND. */
  price: number;
  image: string;
  imageAlt: string;
}
