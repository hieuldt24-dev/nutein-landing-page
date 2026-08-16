// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NUTEIN_PRODUCT_DB_ID } from "../constants";
import { NUTEIN_PRODUCT_DETAIL } from "../data/product.mock";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

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
import { refreshProductCatalogServer } from "./product-catalog.server";

const productRow = {
  id: NUTEIN_PRODUCT_DB_ID,
  sku: "NUTEIN-PV-001",
  slug: "nutein",
  name: "Nutein (DB)",
  description: "Mô tả thật từ DB",
  price: 259000,
  stock: 42,
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

describe("refreshProductCatalogServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productService.setProductDetail(NUTEIN_PRODUCT_DETAIL);
  });

  it("hydrates the synchronous cache and returns the live stock", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: productRow, error: null }));

    await expect(refreshProductCatalogServer()).resolves.toEqual({ stock: 42 });

    const detail = productService.getProductDetail();
    expect(detail.name).toBe("Nutein (DB)");
    expect(detail.unitPrice).toBe(259000);
    expect(detail.tagline).toBe("Tagline thật");
    expect(detail.variants).toEqual([{ id: "pack-3", label: "3 hộp (DB)", units: 3 }]);
    expect(productService.getCatalogProduct()).toMatchObject({
      price: 259000,
      name: "Nutein (DB)",
    });
  });

  it("uses mock cosmetic fields when marketing_meta is empty", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: { ...productRow, marketing_meta: {} }, error: null }),
    );

    await refreshProductCatalogServer();

    const detail = productService.getProductDetail();
    expect(detail.gallery).toEqual(NUTEIN_PRODUCT_DETAIL.gallery);
    expect(detail.variants).toEqual(NUTEIN_PRODUCT_DETAIL.variants);
  });

  it("retains the last valid cache when the query fails", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: productRow, error: null }));
    await refreshProductCatalogServer();
    const beforeError = productService.getProductDetail();

    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "column does not exist" } }),
    );

    await expect(refreshProductCatalogServer()).resolves.toBeNull();
    expect(productService.getProductDetail()).toEqual(beforeError);
  });
});
