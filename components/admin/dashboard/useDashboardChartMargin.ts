"use client";

import { useEffect, useState } from "react";

/**
 * Margin trong chart — thu nhỏ để vùng plot (grid dash) rộng hơn,
 * không đụng tới khung card bên ngoài.
 */
export function useDashboardChartMargin() {
  const [margin, setMargin] = useState({
    top: 28,
    right: 16,
    bottom: 32,
    left: 12,
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      setMargin(
        mq.matches
          ? { top: 36, right: 28, bottom: 36, left: 24 }
          : { top: 28, right: 16, bottom: 32, left: 12 },
      );
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return margin;
}
