// @vitest-environment node
// admin-products.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

// next/server thật: after() throw nếu gọi ngoài request scope (Next quản lý
// qua AsyncLocalStorage) — không có request nào trong test. Chạy callback
// ngay (không ai trong file này assert riêng nội dung audit log).
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));

import { adminProductsRepository } from "./admin-products.repository";
import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";

const productRow = {
  id: NUTEIN_PRODUCT_DB_ID,
  sku: "NUTEIN-PV-001",
  slug: "nutein",
  name: "Nutein",
  description: "Bột protein thực vật",
  price: 249000,
  stock: 48,
  marketing_meta: {
    tagline: "Năng lượng sạch",
    unitLabel: "Hộp 1 hũ",
    image: "/images/example.jpg",
    imageAlt: "Nutein",
    defaultVariantId: "pack-1",
    gallery: [{ id: "gallery-1", src: "/images/example.jpg", alt: "Nutein" }],
    specs: [{ id: "spec-protein", value: "20g", label: "Protein" }],
    variants: [{ id: "pack-1", label: "1 hộp", units: 1 }],
  },
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("adminProductsRepository.getProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map cột thật + marketing_meta -> AdminProduct, query đúng NUTEIN_PRODUCT_DB_ID", async () => {
    const builder = makeBuilder({ data: productRow, error: null });
    mocks.from.mockReturnValue(builder);

    const result = await adminProductsRepository.getProduct();

    expect(builder.eq).toHaveBeenCalledWith("id", NUTEIN_PRODUCT_DB_ID);
    expect(result).toMatchObject({
      sku: "NUTEIN-PV-001",
      unitPrice: 249000,
      stock: 48,
      tagline: "Năng lượng sạch",
      variants: [{ id: "pack-1", label: "1 hộp", units: 1 }],
    });
  });

  it("marketing_meta rỗng ({}) -> field cosmetic fallback rỗng, không throw", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: { ...productRow, marketing_meta: {} }, error: null }),
    );

    const result = await adminProductsRepository.getProduct();

    expect(result.gallery).toEqual([]);
    expect(result.tagline).toBe("");
  });
});

describe("adminProductsRepository.updateProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chỉ sửa stock -> đọc current trước, giữ nguyên marketing_meta cũ, ghi price/name không đổi", async () => {
    const getBuilder = makeBuilder({ data: productRow, error: null });
    const updateBuilder = makeBuilder({
      data: { ...productRow, stock: 10 },
      error: null,
    });
    let call = 0;
    mocks.from.mockImplementation(() => {
      call += 1;
      return call === 1 ? getBuilder : updateBuilder;
    });

    const result = await adminProductsRepository.updateProduct({ stock: 10 }, "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith({
      marketing_meta: {
        tagline: "Năng lượng sạch",
        unitLabel: "Hộp 1 hũ",
        image: "/images/example.jpg",
        imageAlt: "Nutein",
        defaultVariantId: "pack-1",
        gallery: productRow.marketing_meta.gallery,
        specs: productRow.marketing_meta.specs,
        variants: productRow.marketing_meta.variants,
      },
      stock: 10,
    });
    expect(result.stock).toBe(10);
  });

  it("sửa variants -> merge vào marketing_meta, các field cosmetic khác giữ nguyên", async () => {
    const getBuilder = makeBuilder({ data: productRow, error: null });
    const newVariants = [{ id: "pack-1", label: "1 hộp mới", units: 1 }];
    const updateBuilder = makeBuilder({
      data: { ...productRow, marketing_meta: { ...productRow.marketing_meta, variants: newVariants } },
      error: null,
    });
    let call = 0;
    mocks.from.mockImplementation(() => {
      call += 1;
      return call === 1 ? getBuilder : updateBuilder;
    });

    await adminProductsRepository.updateProduct({ variants: newVariants }, "staff-1");

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        marketing_meta: expect.objectContaining({ variants: newVariants, tagline: "Năng lượng sạch" }),
      }),
    );
  });
});
