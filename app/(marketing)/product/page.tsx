import type { Metadata } from "next";
import ProductBuySection from "@/components/product/ProductBuySection";
import { PRODUCT_PAGE_META } from "@/features/product/constants";
import { productService } from "@/features/product/services/product.service";

export const metadata: Metadata = {
  title: PRODUCT_PAGE_META.title,
  description: PRODUCT_PAGE_META.description,
  openGraph: {
    title: PRODUCT_PAGE_META.title,
    description: PRODUCT_PAGE_META.description,
    locale: "vi_VN",
    type: "website",
  },
};

/**
 * Product PDP — buy-box. CTA cuối trang nằm trong Footer (marketing layout).
 */
export default async function ProductPage() {
  const product = await productService.getProduct();

  return (
    <main>
      <ProductBuySection product={product} />
    </main>
  );
}
