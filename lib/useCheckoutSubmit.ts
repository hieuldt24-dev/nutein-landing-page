"use client";

import { useCallback, useState } from "react";
import type { CreateOrderRequest } from "@/features/checkout/schemas/checkout.schema";
import type { CreateOrderResult } from "@/features/checkout/types";
import { apiRequest } from "@/lib/api-client";

/**
 * Submit checkout — POST /api/checkout + cờ isSubmitting (loading guide).
 * Tự remint JWT khi thiếu/hết hạn cookie access.
 */
export function useCheckoutSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitOrder = useCallback(async (body: CreateOrderRequest) => {
    setIsSubmitting(true);
    try {
      return await apiRequest<CreateOrderResult>("/api/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitOrder, isSubmitting };
}
