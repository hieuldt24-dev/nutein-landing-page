import type { Metadata } from "next";
import ProductBuySection from "@/components/product/ProductBuySection";
import { PRODUCT_PAGE_META } from "@/features/product/constants";
import { getProductDetailServer } from "@/features/product/services/product-catalog.server";

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

// ISR — cache 1h, Staff sửa giá/tồn kho ở /staff/products thấy ngay nhờ
// revalidatePath("/product") gọi trong PATCH app/api/staff/products/route.ts.
export const revalidate = 3600;

/**
 * Product PDP — buy-box. CTA cuối trang nằm trong Footer (marketing layout).
 */
export default async function ProductPage() {
  const product = await getProductDetailServer();

  return (
    <main>
      <ProductBuySection product={product} />
    </main>
  );
}
