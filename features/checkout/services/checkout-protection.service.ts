import "server-only";

import { createHash } from "node:crypto";
import type { CreateOrderRequest } from "../schemas/checkout.schema";

/**
 * Phiên bản canonical hóa. TĂNG khi đổi quy tắc chuẩn hóa bên dưới — hai key
 * cùng chuỗi nhưng khác `hash_version` được DB coi là payload khác (RPC so cả
 * `request_hash` LẪN `hash_version`), nên đổi quy tắc không âm thầm biến một
 * replay hợp lệ thành trùng khớp sai.
 */
export const CHECKOUT_REQUEST_HASH_VERSION = 1;

/** Gộp khoảng trắng liên tiếp + trim — "Nguyễn  Văn A" ≡ "Nguyễn Văn A". */
function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * `+84912345678` và `0912345678` là CÙNG một số điện thoại. Không chuẩn hóa thì
 * khách bấm lại với cùng số ở dạng khác sẽ bị 409 nhầm.
 */
function normalizePhone(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "");
  return trimmed.startsWith("+84") ? `0${trimmed.slice(3)}` : trimmed;
}

interface CanonicalLine {
  variantId: string;
  quantity: number;
}

/**
 * Gộp các dòng TRÙNG variant và sắp xếp theo `variantId`.
 * `[{a,1},{b,2}]` và `[{b,2},{a,1}]` và `[{a,1},{b,1},{b,1}]` phải ra CÙNG hash:
 * chúng là cùng một đơn hàng về mặt nghiệp vụ.
 */
function canonicalizeLines(
  lines: CreateOrderRequest["lines"],
): CanonicalLine[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    const variantId = line.variantId.trim();
    merged.set(variantId, (merged.get(variantId) ?? 0) + line.quantity);
  }
  return [...merged.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Payload nghiệp vụ đã chuẩn hóa.
 *
 * CÓ: lines, buyer, address, note, shippingMethod, paymentMethod, couponCode.
 * KHÔNG CÓ (chủ đích — plan §Idempotency): giá hiện tại, số tiền, timestamp,
 * token/JWT, userId, orderCode. Giá đổi giữa hai lần submit KHÔNG được biến một
 * retry mạng thành đơn thứ hai; ngược lại nó cũng không được làm hash trùng cho
 * hai đơn khác nhau về nghiệp vụ.
 */
export function buildCanonicalCheckoutPayload(
  input: CreateOrderRequest,
): Record<string, unknown> {
  return {
    v: CHECKOUT_REQUEST_HASH_VERSION,
    lines: canonicalizeLines(input.lines),
    buyer: {
      fullName: normalizeText(input.buyer.fullName),
      phone: normalizePhone(input.buyer.phone),
      email: normalizeText(input.buyer.email).toLowerCase(),
    },
    address: {
      provinceCode: normalizeText(input.address.provinceCode),
      province: normalizeText(input.address.province),
      wardCode: normalizeText(input.address.wardCode),
      ward: normalizeText(input.address.ward),
      street: normalizeText(input.address.street),
    },
    note: normalizeText(input.note) || null,
    shippingMethod: input.shippingMethod,
    paymentMethod: input.paymentMethod,
    couponCode: normalizeText(input.couponCode).toUpperCase() || null,
  };
}

/**
 * SHA-256 hex của payload canonical.
 *
 * `JSON.stringify` giữ đúng thứ tự chèn key, và mọi key ở trên được chèn theo
 * thứ tự cố định trong `buildCanonicalCheckoutPayload` — nên chuỗi sinh ra là
 * xác định, không phụ thuộc thứ tự field trong JSON body của client.
 */
export function buildCheckoutRequestHash(input: CreateOrderRequest): string {
  const canonical = JSON.stringify(buildCanonicalCheckoutPayload(input));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export const checkoutProtectionService = {
  hashVersion: CHECKOUT_REQUEST_HASH_VERSION,
  buildCanonicalPayload: buildCanonicalCheckoutPayload,
  buildRequestHash: buildCheckoutRequestHash,
};
