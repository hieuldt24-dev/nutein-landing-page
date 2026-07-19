"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckoutSuccessView } from "@/components/checkout/CheckoutSuccessView";
import { CHECKOUT_ORDER_SNAPSHOT_KEY } from "@/features/checkout/constants";
import type { CreateOrderResult } from "@/features/checkout/types";

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("orderCode");
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [ready, setReady] = useState(false);

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

  return <CheckoutSuccessView order={order} />;
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
