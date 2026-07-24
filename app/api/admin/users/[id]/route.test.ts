// @vitest-environment node
// route.ts -> authenticate.middlware.ts -> jwt.service.ts có `import "server-only"`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  setRole: vi.fn(),
  setLocked: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/src/middlewares/authenticate.middlware")
  >();
  return {
    ...actual,
    authenticate: mocks.authenticate,
  };
});

vi.mock("@/features/admin-users/services/admin-users.repository", () => ({
  adminUsersRepository: { setRole: mocks.setRole, setLocked: mocks.setLocked },
}));

import { NextRequest } from "next/server";
import { PATCH } from "./route";

const admin = { userId: "admin-1", email: "admin@nutein.com", role: "ADMIN" as const };

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/admin/users/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tự sửa role/khóa chính mình -> 400, không gọi repository", async () => {
    mocks.authenticate.mockResolvedValue(admin);

    const response = await PATCH(patchRequest({ role: "user" }), context("admin-1"));

    expect(response.status).toBe(400);
    expect(mocks.setRole).not.toHaveBeenCalled();
    expect(mocks.setLocked).not.toHaveBeenCalled();
  });

  it("sửa user khác -> gọi repository bình thường", async () => {
    mocks.authenticate.mockResolvedValue(admin);
    mocks.setRole.mockResolvedValue({
      id: "user-2",
      email: "u2@example.com",
      fullName: "U2",
      role: "staff",
      locked: false,
      createdAt: "2026-07-24T00:00:00.000Z",
    });

    const response = await PATCH(patchRequest({ role: "staff" }), context("user-2"));

    expect(response.status).toBe(200);
    expect(mocks.setRole).toHaveBeenCalledWith("user-2", "staff");
  });
});
