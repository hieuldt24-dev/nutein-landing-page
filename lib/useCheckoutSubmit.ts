"use client";

import { useCallback, useState } from "react";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import type { CreateOrderResult } from "@/features/checkout/types";
import { apiRequest } from "@/lib/api-client";

/**
 * Submit checkout — POST /api/checkout + cờ isSubmitting (loading guide).
 * Tự remint JWT khi thiếu/hết hạn cookie access.
 *
 * RFC-3: gửi kèm header `Idempotency-Key`.
 *
 * Key được GIỮ theo "ý định đặt hàng", không phải theo lần bấm nút. Cùng một
 * nội dung đơn -> cùng một key, kể cả khi khách bấm lại sau timeout mạng, sau
 * khi JWT được remint, hay sau khi F5. Đó chính là lúc cần idempotency nhất:
 * request đầu có thể đã tạo đơn thành công rồi response mới mất.
 *
 * Key CHỈ đổi khi nội dung đơn đổi thật (địa chỉ, giỏ, phương thức...). Sinh
 * key mới sau timeout là lỗi kinh điển — nó biến một đơn thành hai.
 */

const IDEMPOTENCY_STORAGE_KEY = "nutein:checkout-idempotency-key";

/** JSON có khoá được sắp xếp — để `{a,b}` và `{b,a}` ra cùng một chuỗi. */
function stablePayloadKey(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return val;
  });
}

function newUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback cho môi trường không có crypto.randomUUID (browser cũ, test env).
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Lấy key cho payload này: tái dùng key đã lưu nếu payload không đổi, sinh key
 * mới nếu đổi. sessionStorage (không phải localStorage) vì một "ý định đặt
 * hàng" thuộc về tab/phiên hiện tại.
 */
export function resolveIdempotencyKey(body: CreateOrderRequest): string {
  const payloadKey = stablePayloadKey(body);

  if (typeof window === "undefined" || !window.sessionStorage) {
    return newUuid();
  }

  try {
    const raw = window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as { payloadKey?: string; key?: string };
      if (stored.payloadKey === payloadKey && typeof stored.key === "string") {
        return stored.key;
      }
    }
  } catch {
    // storage hỏng/bị chặn -> coi như chưa có key, đi tiếp.
  }

  const key = newUuid();
  try {
    window.sessionStorage.setItem(
      IDEMPOTENCY_STORAGE_KEY,
      JSON.stringify({ payloadKey, key }),
    );
  } catch {
    // Không lưu được (private mode) -> key vẫn dùng cho request này, chỉ mất
    // khả năng tái dùng sau reload. Không phải lý do để chặn đặt hàng.
  }
  return key;
}

export function useCheckoutSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = useCallback(async (body: CreateOrderRequest) => {
    setIsSubmitting(true);
    try {
      return await apiRequest<CreateOrderResult>("/api/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": resolveIdempotencyKey(body) },
        body: JSON.stringify(body),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitOrder, isSubmitting };
}
