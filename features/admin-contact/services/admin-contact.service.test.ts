import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminContactService } from "./admin-contact.service";

const EMPTY = { items: [], total: 0 };

describe("adminContactService.list — query string", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue(EMPTY);
  });

  it("mặc định (không tham số) -> không có dấu ?", async () => {
    await adminContactService.list();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact");
  });

  it("filter='unread' -> có trong URL", async () => {
    await adminContactService.list({ filter: "unread" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact?filter=unread");
  });

  it("filter + limit + offset -> đủ trong URL", async () => {
    await adminContactService.list({ filter: "open", limit: 20, offset: 20 });
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/api/staff/contact?filter=open&limit=20&offset=20",
    );
  });

  it("offset = 0 vẫn được gửi", async () => {
    await adminContactService.list({ limit: 1, offset: 0 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact?limit=1&offset=0");
  });

  it("trả về {items,total}", async () => {
    mocks.apiRequest.mockResolvedValue({ items: [{ id: "m1" }], total: 3 });
    const result = await adminContactService.list({});
    expect(result.total).toBe(3);
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminContactService.list()).rejects.toBe(err);
  });
});

describe("adminContactService — mutations", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({});
  });

  it("getById -> GET /api/staff/contact/:id", async () => {
    await adminContactService.getById("m1");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact/m1");
  });

  it("markRead -> PATCH {isRead:true}", async () => {
    await adminContactService.markRead("m1");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact/m1", {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    });
  });

  it("markHandled -> PATCH {isHandled, isRead:true}", async () => {
    await adminContactService.markHandled("m1", true);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact/m1", {
      method: "PATCH",
      body: JSON.stringify({ isHandled: true, isRead: true }),
    });
  });

  it("setNote -> trim ghi chú trước khi gửi", async () => {
    await adminContactService.setNote("m1", "  đã gọi khách  ");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/contact/m1", {
      method: "PATCH",
      body: JSON.stringify({ internalNote: "đã gọi khách" }),
    });
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("nope");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminContactService.markRead("m1")).rejects.toBe(err);
  });
});
