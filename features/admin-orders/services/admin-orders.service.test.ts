import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FetchError } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminOrdersService } from "./admin-orders.service";

const EMPTY = { items: [], total: 0 };

function fetchError(status: number): FetchError {
  const err = new Error(`HTTP ${status}`) as FetchError;
  err.status = status;
  return err;
}

describe("adminOrdersService.list — query string", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue(EMPTY);
  });

  it("query rỗng -> không có dấu ?", async () => {
    await adminOrdersService.list();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/orders");
  });

  it("status 'all' -> bỏ qua", async () => {
    await adminOrdersService.list({ status: "all" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/orders");
  });

  it("q -> trim trước khi gửi", async () => {
    await adminOrdersService.list({ q: "  NT-2026  " });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/orders?q=NT-2026");
  });

  it("q toàn khoảng trắng -> bỏ qua", async () => {
    await adminOrdersService.list({ q: "   " });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/orders");
  });

  it("limit/offset + from/to -> có trong URL", async () => {
    await adminOrdersService.list({
      from: "2026-08-01",
      to: "2026-08-20",
      limit: 20,
      offset: 20,
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/api/staff/orders?from=2026-08-01&to=2026-08-20&limit=20&offset=20",
    );
  });
});

describe("adminOrdersService.getById", () => {
  // Thân hàm dạng block: arrow rút gọn sẽ *trả về* mock fn, và vitest coi
  // giá trị trả về là teardown callback -> gọi lại mock sau test -> unhandled
  // rejection ở các case mock reject.
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it("404 -> trả null (không throw)", async () => {
    mocks.apiRequest.mockImplementation(() => Promise.reject(fetchError(404)));
    await expect(adminOrdersService.getById("o1")).resolves.toBeNull();
  });

  it("500 -> ném lại lỗi", async () => {
    const err = fetchError(500);
    mocks.apiRequest.mockImplementation(() => Promise.reject(err));
    await expect(adminOrdersService.getById("o1")).rejects.toBe(err);
  });

  it("thành công -> trả đơn hàng", async () => {
    mocks.apiRequest.mockResolvedValue({ id: "o1" });
    await expect(adminOrdersService.getById("o1")).resolves.toEqual({ id: "o1" });
  });
});

describe("adminOrdersService — updateStatus / listSummary", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({});
  });

  it("updateStatus -> PATCH /:id/status với {status, note}", async () => {
    await adminOrdersService.updateStatus("o1", "shipped", { note: "đã gửi" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/orders/o1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "shipped", note: "đã gửi" }),
    });
  });

  it("listSummary -> gọi /api/admin/orders-summary", async () => {
    mocks.apiRequest.mockResolvedValue([]);
    await adminOrdersService.listSummary();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/admin/orders-summary");
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminOrdersService.listSummary()).rejects.toBe(err);
  });
});
