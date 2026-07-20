// @vitest-environment node
// address.service.ts -> address.repository.ts có `import "server-only"`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  clearDefault: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("./address.repository", () => ({
  addressRepository: mocks,
}));

import { addressService } from "./address.service";
import type { ShippingAddress } from "../types";
import type { ShippingAddressFields } from "../schemas/address.schema";

const fields: ShippingAddressFields = {
  provinceCode: "01",
  province: "Hà Nội",
  wardCode: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
};

function makeAddress(
  overrides: Partial<ShippingAddress> = {},
): ShippingAddress {
  return {
    id: "addr-1",
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
    isDefault: false,
    ...overrides,
  };
}

describe("addressService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("địa chỉ đầu tiên của user tự động thành mặc định", async () => {
    mocks.list.mockResolvedValue([]);
    mocks.create.mockResolvedValue(makeAddress({ isDefault: true }));

    await addressService.create("user-1", fields);

    expect(mocks.clearDefault).toHaveBeenCalledWith("user-1");
    expect(mocks.create).toHaveBeenCalledWith("user-1", fields, true);
  });

  it("không tick mặc định khi đã có địa chỉ khác -> không xoá default cũ, is_default=false", async () => {
    mocks.list.mockResolvedValue([
      makeAddress({ id: "addr-0", isDefault: true }),
    ]);
    mocks.create.mockResolvedValue(makeAddress({ isDefault: false }));

    await addressService.create("user-1", fields);

    expect(mocks.clearDefault).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith("user-1", fields, false);
  });

  it("chủ động tick isDefault=true -> clearDefault trước khi tạo", async () => {
    mocks.list.mockResolvedValue([
      makeAddress({ id: "addr-0", isDefault: true }),
    ]);
    mocks.create.mockResolvedValue(makeAddress({ isDefault: true }));

    await addressService.create("user-1", { ...fields, isDefault: true });

    expect(mocks.clearDefault).toHaveBeenCalledWith("user-1");
    expect(mocks.create).toHaveBeenCalledWith(
      "user-1",
      { ...fields, isDefault: true },
      true,
    );
  });
});

describe("addressService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi địa chỉ không tồn tại/không thuộc user", async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(
      addressService.update("user-1", "addr-x", fields),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("đang là mặc định + không chủ động bỏ tick -> giữ mặc định, không clearDefault lại (đã tự là default)", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: true }));
    mocks.update.mockResolvedValue(makeAddress({ isDefault: true }));

    await addressService.update("user-1", "addr-1", fields);

    expect(mocks.clearDefault).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith("user-1", "addr-1", fields, true);
  });

  it("chủ động bỏ tick mặc định (isDefault:false) trên địa chỉ đang mặc định -> is_default=false", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: true }));
    mocks.update.mockResolvedValue(makeAddress({ isDefault: false }));

    await addressService.update("user-1", "addr-1", {
      ...fields,
      isDefault: false,
    });

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "addr-1",
      { ...fields, isDefault: false },
      false,
    );
  });

  it("địa chỉ khác chủ động tick mặc định -> clearDefault trước khi update", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: false }));
    mocks.update.mockResolvedValue(makeAddress({ isDefault: true }));

    await addressService.update("user-1", "addr-1", {
      ...fields,
      isDefault: true,
    });

    expect(mocks.clearDefault).toHaveBeenCalledWith("user-1");
    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "addr-1",
      { ...fields, isDefault: true },
      true,
    );
  });
});

describe("addressService.remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi địa chỉ không tồn tại", async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(
      addressService.remove("user-1", "addr-x"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("xoá địa chỉ không phải mặc định -> không cần gán lại default", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: false }));
    mocks.remove.mockResolvedValue(undefined);

    await addressService.remove("user-1", "addr-1");

    expect(mocks.remove).toHaveBeenCalledWith("user-1", "addr-1");
    expect(mocks.setDefault).not.toHaveBeenCalled();
  });

  it("xoá địa chỉ mặc định, còn địa chỉ khác -> tự gán default cho địa chỉ đầu tiên còn lại", async () => {
    mocks.findById.mockResolvedValue(
      makeAddress({ id: "addr-1", isDefault: true }),
    );
    mocks.remove.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([
      makeAddress({ id: "addr-2", isDefault: false }),
    ]);

    await addressService.remove("user-1", "addr-1");

    expect(mocks.setDefault).toHaveBeenCalledWith("user-1", "addr-2");
  });

  it("xoá địa chỉ mặc định duy nhất -> không còn địa chỉ nào, không gọi setDefault", async () => {
    mocks.findById.mockResolvedValue(
      makeAddress({ id: "addr-1", isDefault: true }),
    );
    mocks.remove.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([]);

    await addressService.remove("user-1", "addr-1");

    expect(mocks.setDefault).not.toHaveBeenCalled();
  });
});

describe("addressService.setDefault", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi địa chỉ không tồn tại", async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(
      addressService.setDefault("user-1", "addr-x"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("đã là mặc định -> no-op, không gọi lại repository", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: true }));

    const result = await addressService.setDefault("user-1", "addr-1");

    expect(mocks.clearDefault).not.toHaveBeenCalled();
    expect(mocks.setDefault).not.toHaveBeenCalled();
    expect(result.isDefault).toBe(true);
  });

  it("chưa mặc định -> clearDefault rồi setDefault đúng thứ tự", async () => {
    mocks.findById.mockResolvedValue(makeAddress({ isDefault: false }));

    const result = await addressService.setDefault("user-1", "addr-1");

    expect(mocks.clearDefault).toHaveBeenCalledWith("user-1");
    expect(mocks.setDefault).toHaveBeenCalledWith("user-1", "addr-1");
    expect(result.isDefault).toBe(true);
  });
});
