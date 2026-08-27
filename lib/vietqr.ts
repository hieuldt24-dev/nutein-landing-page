import "server-only";

/**
 * VietQR Quick Link — sinh URL ảnh QR chuyển khoản từ thông tin tài khoản
 * ngân hàng của shop. Không gateway, không SDK, không auth: chỉ là 1 URL ảnh
 * GET công khai.
 *
 * Mirror lib/payos.ts / lib/resend.ts: trả `null` khi chưa cấu hình env thay
 * vì throw — bên gọi phải tự null-check và hiển thị fallback.
 *
 * Env đọc tại thời điểm gọi (không phải lúc import) để tránh bẫy "throw khi
 * import" và để test không cần vi.resetModules().
 */
const VIETQR_IMAGE_BASE = "https://img.vietqr.io/image";
const DEFAULT_TEMPLATE = "compact2";

export interface BuildVietQrImageUrlInput {
  /** Số tiền cần chuyển (VND, số nguyên). */
  amount: number;
  /** Nội dung chuyển khoản — dùng mã đơn, VD "NT-20260827-AB12". */
  addInfo: string;
}

export function buildVietQrImageUrl(
  input: BuildVietQrImageUrlInput,
): string | null {
  const bankId = process.env.VIETQR_BANK_ID?.trim();
  const accountNo = process.env.VIETQR_ACCOUNT_NO?.trim();
  if (!bankId || !accountNo) {
    return null;
  }

  const accountName = process.env.VIETQR_ACCOUNT_NAME?.trim() ?? "";
  const template = process.env.VIETQR_TEMPLATE?.trim() || DEFAULT_TEMPLATE;

  const params = new URLSearchParams();
  params.set("amount", String(Math.round(input.amount)));
  params.set("addInfo", input.addInfo);
  if (accountName) {
    params.set("accountName", accountName);
  }

  return `${VIETQR_IMAGE_BASE}/${bankId}-${accountNo}-${template}.png?${params.toString()}`;
}

/** Thông tin tài khoản hiển thị dạng chữ (fallback khi khách không quét được QR). */
export function getVietQrBankAccount(): {
  bankId: string;
  accountNo: string;
  accountName: string;
} | null {
  const bankId = process.env.VIETQR_BANK_ID?.trim();
  const accountNo = process.env.VIETQR_ACCOUNT_NO?.trim();
  if (!bankId || !accountNo) {
    return null;
  }
  return {
    bankId,
    accountNo,
    accountName: process.env.VIETQR_ACCOUNT_NAME?.trim() ?? "",
  };
}
