// @vitest-environment node
// admin-coupons.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

/** Query builder giả — mọi method chain trả về chính nó, awaitable qua `then`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
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

import { adminCouponsRepository } from "./admin-coupons.repository";

const couponRow = {
  id: "cpn-1",
  code: "SALE10",
  discount_type: "PERCENTAGE",
  discount: 10,
  min_order_value: 100000,
  usage_limit: 50,
  used_count: 3,
  is_active: true,
  expires_at: "2026-12-31T00:00:00.000Z",
  created_at: "2026-07-24T00:00:00.000Z",
};

describe("adminCouponsRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map đúng field snake_case -> camelCase", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [couponRow], error: null }));

    const result = await adminCouponsRepository.list();

    expect(result).toEqual([
      {
        id: "cpn-1",
        code: "SALE10",
        discountType: "PERCENTAGE",
        discount: 10,
        minOrderValue: 100000,
        usageLimit: 50,
        usedCount: 3,
        isActive: true,
        expiresAt: "2026-12-31T00:00:00.000Z",
        createdAt: "2026-07-24T00:00:00.000Z",
      },
    ]);
  });
});

describe("adminCouponsRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insert đúng payload snake_case", async () => {
    const builder = makeBuilder({ data: couponRow, error: null });
    mocks.from.mockReturnValue(builder);

    await adminCouponsRepository.create(
      {
        code: "SALE10",
        discountType: "PERCENTAGE",
        discount: 10,
        minOrderValue: 100000,
        usageLimit: 50,
        isActive: true,
        expiresAt: "2026-12-31T00:00:00.000Z",
      },
      "staff-1",
    );

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SALE10",
        discount_type: "PERCENTAGE",
        discount: 10,
        min_order_value: 100000,
        usage_limit: 50,
        is_active: true,
      }),
    );
  });

  it("mã trùng (23505) -> BadRequestError rõ ràng", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: "23505", message: "duplicate key" } }),
    );

    await expect(
      adminCouponsRepository.create(
        {
          code: "SALE10",
          discountType: "FIXED",
          discount: 10000,
          minOrderValue: null,
          usageLimit: null,
          isActive: true,
          expiresAt: null,
        },
        "staff-1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("adminCouponsRepository.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi không tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminCouponsRepository.update("missing", { isActive: false }, "staff-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("chỉ update field được truyền (partial)", async () => {
    const builder = makeBuilder({ data: { ...couponRow, is_active: false }, error: null });
    mocks.from.mockReturnValue(builder);

    await adminCouponsRepository.update("cpn-1", { isActive: false }, "staff-1");

    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
  });
});
