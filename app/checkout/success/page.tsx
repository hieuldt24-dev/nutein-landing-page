"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckoutSuccessView } from "@/components/checkout/CheckoutSuccessView";
import { CHECKOUT_ORDER_SNAPSHOT_KEY } from "@/features/checkout/constants";
import type { CreateOrderResult } from "@/features/checkout/types";
import { apiRequest } from "@/lib/api-client";

type LivePaymentStatus = "UNPAID" | "PAID" | null;

/**
 * Poll ngắn (tối đa 5 lần × 3s) — bù cho webhook payOS cần public HTTPS URL
 * (không bắn được ở local dev nếu chưa tunnel). Route status tự đối soát
 * qua payOS nếu DB còn UNPAID.
 */
function usePayosLiveStatus(order: CreateOrderResult | null): LivePaymentStatus {
  const [liveStatus, setLiveStatus] = useState<LivePaymentStatus>(null);

  useEffect(() => {
    if (!order || order.paymentMethod !== "bank_transfer") return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await apiRequest<{ paymentStatus: LivePaymentStatus }>(
          `/api/checkout/payos/status?orderCode=${encodeURIComponent(order.orderCode)}`,
        );
        if (cancelled) return;
        setLiveStatus(res.paymentStatus);
        attempts += 1;
        if (res.paymentStatus !== "PAID" && attempts < 5) {
          timer = setTimeout(poll, 3000);
        }
      } catch {
        /* success page vẫn hiển thị được từ snapshot */
      }
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order]);

  return liveStatus;
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("orderCode");
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [ready, setReady] = useState(false);
  const livePaymentStatus = usePayosLiveStatus(order);

  useEffect(() => {
    let snapshot: CreateOrderResult | null = null;
    try {
      const raw = sessionStorage.getItem(CHECKOUT_ORDER_SNAPSHOT_KEY);
      if (raw) {
        snapshot = JSON.parse(raw) as CreateOrderResult;
      }
    } catch {
      snapshot = null;
    }

    if (snapshot && (!orderCode || snapshot.orderCode === orderCode)) {
      setOrder(snapshot);
      setReady(true);
      return;
    }

    setReady(true);
    router.replace("/");
  }, [orderCode, router]);

  if (!ready || !order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">Đang tải xác nhận đơn…</p>
      </div>
    );
  }

  return <CheckoutSuccessView order={order} livePaymentStatus={livePaymentStatus} />;
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-6">
          <p className="text-sm font-semibold text-text-muted">Đang tải…</p>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
