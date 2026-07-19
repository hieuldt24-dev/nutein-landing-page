"use client";

import { useCallback, useState } from "react";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import type { CreateOrderResult } from "@/features/checkout/types";
import type { FetchError } from "@/lib/swr-fetcher";
import type { ApiResponse } from "@/src/api/response";

async function postCheckout(body: CreateOrderRequest): Promise<CreateOrderResult> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json: ApiResponse<CreateOrderResult> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: { message: "Không đọc được phản hồi máy chủ", code: "PARSE_ERROR" },
  }));

  if (!res.ok || !json.success || !json.data) {
    const error = new Error(
      json.error?.message || "Đặt hàng thất bại — vui lòng thử lại"
    ) as FetchError;
    error.status = res.status;
    error.code = json.error?.code || "CHECKOUT_ERROR";
    throw error;
  }

  return json.data;
}

/**
 * Submit checkout — fetch POST /api/checkout + cờ isSubmitting (loading guide).
 */
export function useCheckoutSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = useCallback(async (body: CreateOrderRequest) => {
    setIsSubmitting(true);
    try {
      return await postCheckout(body);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitOrder, isSubmitting };
}
