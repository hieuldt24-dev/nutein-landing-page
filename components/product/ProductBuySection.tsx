"use client";

import { useState } from "react";
import type { ProductDetail } from "@/features/product/types";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";

interface ProductBuySectionProps {
  product: ProductDetail;
}

/**
 * Buy-box Joy Rush: 2 cột — trái (ảnh + specs + thumbs) | phải (purchase).
 * Mobile: gallery → purchase.
 */
export default function ProductBuySection({ product }: ProductBuySectionProps) {
  const [activeImageId, setActiveImageId] = useState(
    product.gallery[0]?.id ?? "gallery-1"
  );

  return (
    <section className="bg-bg px-6 pt-28 pb-16 md:px-10 md:pt-32 md:pb-20 lg:pb-24">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10 xl:gap-12">
          <ProductGallery
            images={product.gallery}
            specs={product.specs}
            activeImageId={activeImageId}
            onSelect={setActiveImageId}
          />

          <ProductPurchasePanel product={product} />
        </div>
      </div>
    </section>
  );
}
