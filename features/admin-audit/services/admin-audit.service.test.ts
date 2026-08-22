import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminAuditService } from "./admin-audit.service";

const EMPTY = { items: [], total: 0 };

describe("adminAuditService.list — query string", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue(EMPTY);
  });

  it("query rỗng -> không có dấu ?", async () => {
    await adminAuditService.list();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/audit");
  });

  it("action 'all' -> bỏ qua", async () => {
    await adminAuditService.list({ action: "all" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/audit");
  });

  it("action cụ thể -> có trong URL", async () => {
    await adminAuditService.list({ action: "UPDATE" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/audit?action=UPDATE");
  });

  it("limit/offset -> có trong URL", async () => {
    await adminAuditService.list({ limit: 20, offset: 40 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/audit?limit=20&offset=40");
  });

  it("offset = 0 vẫn được gửi (guard != null, không phải falsy)", async () => {
    await adminAuditService.list({ offset: 0 });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/audit?offset=0");
  });

  it("from/to -> có trong URL", async () => {
    await adminAuditService.list({ from: "2026-08-01", to: "2026-08-20" });
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/api/admin/audit?from=2026-08-01&to=2026-08-20",
    );
  });

  it("lỗi từ apiRequest -> passthrough nguyên vẹn", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminAuditService.list()).rejects.toBe(err);
  });
});
