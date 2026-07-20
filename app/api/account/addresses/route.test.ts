// @vitest-environment node
// route.ts -> authenticate.middlware.ts -> jwt.service.ts có `import "server-only"`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("@/features/account/services/address.service", () => ({
  addressService: { list: mocks.list, create: mocks.create },
}));

import { NextRequest } from "next/server";
import { AppError } from "@/src/errors/app.error";
import { GET, POST } from "./route";

const user = {
  userId: "user-1",
  email: "user@example.com",
  role: "USER" as const,
};

function fakeGetRequest() {
  return new NextRequest("http://localhost:3000/api/account/addresses");
}

function fakePostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/account/addresses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/account/addresses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chưa đăng nhập -> 401, không gọi service", async () => {
    mocks.authenticate.mockRejectedValue(
      new AppError("Chưa đăng nhập", 401, "NO_TOKEN"),
    );

    const response = await GET(fakeGetRequest());

    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("đã đăng nhập -> 200, trả đúng danh sách theo userId từ token", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.list.mockResolvedValue([{ id: "addr-1", isDefault: true }]);

    const response = await GET(fakeGetRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith("user-1");
    expect(json.data).toEqual([{ id: "addr-1", isDefault: true }]);
  });
});

const validFields = {
  provinceCode: "01",
  province: "Hà Nội",
  wardCode: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
};

describe("POST /api/account/addresses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("thiếu field bắt buộc -> 400 VALIDATION_ERROR, không gọi service", async () => {
    mocks.authenticate.mockResolvedValue(user);

    const response = await POST(fakePostRequest({ street: "" }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("dữ liệu hợp lệ -> 201, gọi service với đúng userId + body", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.create.mockResolvedValue({
      id: "addr-new",
      ...validFields,
      isDefault: true,
    });

    const response = await POST(fakePostRequest(validFields));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining(validFields),
    );
    expect(json.data.id).toBe("addr-new");
  });
});
