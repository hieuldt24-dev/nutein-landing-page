import type { VoucherTier } from "./types";

/** SWR-as-store key — danh sách dòng giỏ `{ variantId, quantity }[]`. */
export const CART_LINES_SWR_KEY = "cart-lines";
/** @deprecated — dùng CART_LINES_SWR_KEY. */
export const CART_QUANTITY_SWR_KEY = "cart-quantity";
/** @deprecated — dùng CART_LINES_SWR_KEY. */
export const CART_VARIANT_SWR_KEY = "cart-variant-id";
/** SWR-as-store key — cart đang mutate (add/qty/remove), dùng overlay loading. */
export const CART_UPDATING_SWR_KEY = "cart-updating";
/**
 * localStorage key legacy — chỉ tổng số gói (số). Repository vẫn ghi để migrate.
 * @deprecated Dùng `CART_STATE_STORAGE_KEY`.
 */
export const CART_QUANTITY_STORAGE_KEY = "nutein:cart-quantity";
/** localStorage key persist `{ lines: CartLine[] }`. */
export const CART_STATE_STORAGE_KEY = "nutein:cart-state";
/** SWR-as-store key cho trạng thái mở/đóng CartDrawer. */
export const CART_DRAWER_SWR_KEY = "cart-drawer-open";

/** URL thật — giỏ khi đã đăng nhập. */
export const CART_API_PATH = "/api/cart";

export const MIN_CART_QUANTITY = 0;
export const MAX_CART_QUANTITY = 20;

/**
 * Delay giả lập latency mạng khi mutate qua local repository.
 * Khi gắn API thật: bỏ delay trong repository/service, giữ nguyên flow async + loading UI.
 */
export const CART_LOCAL_LATENCY_MS = 280;

/** Nutein chưa có bảng phí ship — hiển thị copy chờ tính ở bước checkout. */
export const SHIPPING_FEE_NOTE = "Tính phí khi thanh toán";

/**
 * Tiêu đề CartDrawer — không đếm “X sản phẩm” (multi-product Joy Rush).
 * Số lượng nằm trên từng dòng gói.
 */
export const CART_DRAWER_TITLE = "Giỏ hàng của bạn";

/** Empty state — chữ lớn giữa drawer, không kèm icon (tham chiếu Joy Rush). */
export const CART_EMPTY_HEADING = "Giỏ hàng của bạn đang trống";
export const CART_CONTINUE_SHOPPING_LABEL = "Tiếp tục mua sắm";
export const CART_CHECKOUT_LABEL = "Tiến hành thanh toán";

/** Thời lượng slide in/out của CartDrawer (khớp keyframe trong globals.css). */
export const CART_DRAWER_ANIMATION_MS = 380;

/**
 * Các mốc ưu đãi theo tổng tiền, tham khảo cấu trúc bar của Joy Rush.
 * Ngưỡng tăng dần — mốc cuối dùng làm mẫu số tính % progress bar.
 */
export const VOUCHER_TIERS: VoucherTier[] = [
  { id: "discount-5", thresholdVnd: 500_000, label: "Giảm 5%", kind: "discount", discountPercent: 5 },
  { id: "free-shipping", thresholdVnd: 750_000, label: "Miễn phí vận chuyển", kind: "free_shipping" },
  { id: "discount-10", thresholdVnd: 1_000_000, label: "Giảm 10%", kind: "discount", discountPercent: 10 },
  { id: "discount-15", thresholdVnd: 1_250_000, label: "Giảm 15%", kind: "discount", discountPercent: 15 },
  { id: "discount-25", thresholdVnd: 1_500_000, label: "Giảm 25%", kind: "discount", discountPercent: 25 },
];
