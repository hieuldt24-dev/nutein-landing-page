// @vitest-environment node
// address.repository.ts có `import "server-only"`, chặn import ở jsdom.
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
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { addressRepository } from "./address.repository";
import type { ShippingAddressFields } from "../schemas/address.schema";

const row = {
  id: "addr-1",
  label: "Nhà",
  province_code: "01",
  province: "Hà Nội",
  ward_code: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
  is_default: true,
};

const fields: ShippingAddressFields = {
  label: "Nhà",
  provinceCode: "01",
  province: "Hà Nội",
  wardCode: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
};

describe("addressRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map đúng row DB (snake_case) sang ShippingAddress (camelCase)", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [row], error: null }));

    const result = await addressRepository.list("user-1");

    expect(result).toEqual([
      {
        id: "addr-1",
        label: "Nhà",
        provinceCode: "01",
        province: "Hà Nội",
        wardCode: "001",
        ward: "Phúc Xá",
        street: "123 Đường ABC",
        isDefault: true,
      },
    ]);
  });

  it("throw khi Supabase trả lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(addressRepository.list("user-1")).rejects.toThrow("db down");
  });
});

describe("addressRepository.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả null khi không tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(await addressRepository.findById("user-1", "addr-x")).toBeNull();
  });

  it("trả đúng ShippingAddress khi tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: row, error: null }));
    const result = await addressRepository.findById("user-1", "addr-1");
    expect(result?.id).toBe("addr-1");
    expect(result?.isDefault).toBe(true);
  });
});

describe("addressRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insert đúng field (trim + snake_case) + is_default truyền vào", async () => {
    const insertBuilder = makeBuilder({ data: row, error: null });
    mocks.from.mockReturnValue(insertBuilder);

    await addressRepository.create("user-1", fields, true);

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      label: "Nhà",
      province_code: "01",
      province: "Hà Nội",
      ward_code: "001",
      ward: "Phúc Xá",
      street: "123 Đường ABC",
      is_default: true,
    });
  });

  it("throw khi insert lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(
      addressRepository.create("user-1", fields, false),
    ).rejects.toThrow("db down");
  });
});

describe("addressRepository.clearDefault / setDefault", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clearDefault throw khi update lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(addressRepository.clearDefault("user-1")).rejects.toThrow(
      "db down",
    );
  });

  it("setDefault không throw khi thành công", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    await expect(
      addressRepository.setDefault("user-1", "addr-1"),
    ).resolves.toBeUndefined();
  });
});

describe("addressRepository.remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw khi delete lỗi", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );
    await expect(addressRepository.remove("user-1", "addr-1")).rejects.toThrow(
      "db down",
    );
  });
});
