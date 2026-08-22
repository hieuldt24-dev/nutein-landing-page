import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminUsersService } from "./admin-users.service";

const EMPTY = { items: [], total: 0 };

describe("adminUsersService.list — query string", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue(EMPTY);
  });

  it("query rỗng -> không có dấu ?", async () => {
    await adminUsersService.list();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users");
  });

  it("q + role -> có trong URL", async () => {
    await adminUsersService.list({ q: "minh", role: "staff" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users?q=minh&role=staff");
  });

  it("role 'all' -> bỏ qua", async () => {
    await adminUsersService.list({ q: "minh", role: "all" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users?q=minh");
  });

  it("limit/offset -> có trong URL", async () => {
    await adminUsersService.list({ limit: 20, offset: 40 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users?limit=20&offset=40");
  });

  it("offset = 0 vẫn được gửi", async () => {
    await adminUsersService.list({ limit: 20, offset: 0 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users?limit=20&offset=0");
  });

  it("trả về {items,total} từ API", async () => {
    mocks.apiRequest.mockResolvedValue({ items: [{ id: "u1" }], total: 7 });
    const result = await adminUsersService.list({});
    expect(result.total).toBe(7);
    expect(result.items).toHaveLength(1);
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminUsersService.list()).rejects.toBe(err);
  });
});

describe("adminUsersService.setRole / setLocked", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({});
  });

  it("setRole -> PATCH /api/admin/users/:id với body {role}", async () => {
    await adminUsersService.setRole("u1", "admin");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    });
  });

  it("setLocked -> PATCH với body {locked}", async () => {
    await adminUsersService.setLocked("u1", true);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/users/u1", {
      method: "PATCH",
      body: JSON.stringify({ locked: true }),
    });
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("nope");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminUsersService.setRole("u1", "staff")).rejects.toBe(err);
  });
});
