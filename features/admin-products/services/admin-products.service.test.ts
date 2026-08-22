import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));

import { adminProductsService } from "./admin-products.service";

describe("adminProductsService", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({});
  });

  it("getProduct -> GET /api/staff/products", async () => {
    await adminProductsService.getProduct();
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/products");
  });

  it("updateProduct -> PATCH với body JSON", async () => {
    await adminProductsService.updateProduct({ name: "Nutein Gold" });
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/staff/products", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nutein Gold" }),
    });
  });

  it("uploadImage -> POST FormData field `file` tới /api/staff/uploads, trả url", async () => {
    mocks.apiRequest.mockResolvedValue({ url: "https://cdn/x.png" });
    const file = new File(["x"], "x.png", { type: "image/png" });

    const url = await adminProductsService.uploadImage(file);

    expect(url).toBe("https://cdn/x.png");
    const [path, init] = mocks.apiRequest.mock.calls[0];
    expect(path).toBe("/api/staff/uploads");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("lỗi từ apiRequest -> passthrough", async () => {
    const err = new Error("boom");
    mocks.apiRequest.mockRejectedValue(err);
    await expect(adminProductsService.getProduct()).rejects.toBe(err);
  });
});
