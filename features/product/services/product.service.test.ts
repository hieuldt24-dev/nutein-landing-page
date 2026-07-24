import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mocks.from }),
}));

import { productService } from "./product.service";
import { NUTEIN_PRODUCT_DB_ID } from "../constants";
import { NUTEIN_PRODUCT_DETAIL } from "../data/product.mock";

const productRow = {
  id: NUTEIN_PRODUCT_DB_ID,
  sku: "NUTEIN-PV-001",
  slug: "nutein",
  name: "Nutein (DB)",
  description: "Mô tả thật từ DB",
  price: 259000,
  marketing_meta: {
    tagline: "Tagline thật",
    unitLabel: "Hộp thật",
    image: "/images/db.jpg",
    imageAlt: "Alt thật",
    defaultVariantId: "pack-3",
    gallery: [{ id: "g1", src: "/images/db.jpg", alt: "DB" }],
    specs: [{ id: "s1", value: "25g", label: "Protein" }],
    variants: [{ id: "pack-3", label: "3 hộp (DB)", units: 3 }],
  },
};

describe("productService.refreshCatalogCache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cập nhật cache từ DB -> getProductDetail()/getCatalogProduct() phản ánh giá trị mới", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: productRow, error: null }));

    await productService.refreshCatalogCache();

    const detail = productService.getProductDetail();
    expect(detail.name).toBe("Nutein (DB)");
    expect(detail.unitPrice).toBe(259000);
    expect(detail.tagline).toBe("Tagline thật");
    expect(detail.variants).toEqual([{ id: "pack-3", label: "3 hộp (DB)", units: 3 }]);

    const catalog = productService.getCatalogProduct();
    expect(catalog.price).toBe(259000);
    expect(catalog.name).toBe("Nutein (DB)");
  });

  it("marketing_meta rỗng -> fallback field cosmetic về mock (không rỗng/undefined)", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: { ...productRow, marketing_meta: {} },
        error: null,
      }),
    );

    await productService.refreshCatalogCache();

    const detail = productService.getProductDetail();
    expect(detail.gallery).toEqual(NUTEIN_PRODUCT_DETAIL.gallery);
    expect(detail.variants).toEqual(NUTEIN_PRODUCT_DETAIL.variants);
  });

  it("lỗi query (vd chưa apply migration) -> giữ nguyên cache trước đó, không throw", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: productRow, error: null }));
    await productService.refreshCatalogCache();
    const beforeError = productService.getProductDetail();

    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "column does not exist" } }),
    );
    await expect(productService.refreshCatalogCache()).resolves.toBeUndefined();

    expect(productService.getProductDetail()).toEqual(beforeError);
  });
});
