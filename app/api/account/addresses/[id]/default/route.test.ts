// @vitest-environment node
// route.ts -> authenticate.middlware.ts -> jwt.service.ts có `import "server-only"`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("@/features/account/services/address.service", () => ({
  addressService: { setDefault: mocks.setDefault },
}));

import { NextRequest } from "next/server";
import { NotFoundError } from "@/src/errors/app.error";
import { POST } from "./route";

const user = {
  userId: "user-1",
  email: "user@example.com",
  role: "USER" as const,
};

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function fakeRequest() {
  return new NextRequest(
    "http://localhost:3000/api/account/addresses/addr-1/default",
    {
      method: "POST",
    },
  );
}

describe("POST /api/account/addresses/[id]/default", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gọi service với đúng userId + id, trả địa chỉ đã cập nhật", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.setDefault.mockResolvedValue({ id: "addr-1", isDefault: true });

    const response = await POST(fakeRequest(), context("addr-1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.setDefault).toHaveBeenCalledWith("user-1", "addr-1");
    expect(json.data).toEqual({ id: "addr-1", isDefault: true });
  });

  it("service throw NotFoundError -> 404", async () => {
    mocks.authenticate.mockResolvedValue(user);
    mocks.setDefault.mockRejectedValue(new NotFoundError("Địa chỉ"));

    const response = await POST(fakeRequest(), context("addr-x"));
    expect(response.status).toBe(404);
  });
});
