// @vitest-environment node
// route.ts -> authenticate.middlware.ts -> jwt.service.ts có `import "server-only"`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("@/features/account/services/address.service", () => ({
  addressService: { update: mocks.update, remove: mocks.remove },
}));

import { NextRequest } from "next/server";
import { NotFoundError } from "@/src/errors/app.error";
import { PATCH, DELETE } from "./route";

const user = {
  userId: "user-1",
  email: "user@example.com",
  role: "USER" as const,
};
const validFields = {
  provinceCode: "01",
  province: "Hà Nội",
  wardCode: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
};

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/account/addresses/addr-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost:3000/api/account/addresses/addr-1", {
    method: "DELETE",
  });
}

describe("PATCH /api/account/addresses/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dữ liệu hợp lệ -> gọi service với đúng userId + id + body", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.update.mockResolvedValue({
      id: "addr-1",
      ...validFields,
      isDefault: false,
    });

    const response = await PATCH(patchRequest(validFields), context("addr-1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "addr-1",
      expect.objectContaining(validFields),
    );
    expect(json.data.id).toBe("addr-1");
  });

  it("service throw NotFoundError -> 404", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.update.mockRejectedValue(new NotFoundError("Địa chỉ"));

    const response = await PATCH(patchRequest(validFields), context("addr-x"));
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/account/addresses/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("thành công -> 204, gọi service với đúng userId + id", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.remove.mockResolvedValue(undefined);

    const response = await DELETE(deleteRequest(), context("addr-1"));

    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith("user-1", "addr-1");
  });

  it("service throw NotFoundError -> 404", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.remove.mockRejectedValue(new NotFoundError("Địa chỉ"));

    const response = await DELETE(deleteRequest(), context("addr-x"));
    expect(response.status).toBe(404);
  });
});
