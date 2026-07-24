import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/services/auth.repository", () => ({
  authRepository: { mintApiSession: vi.fn() },
}));

import { apiRequest } from "./api-client";

function mockFetchOnce(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("body JSON (string) -> gửi Content-Type application/json", async () => {
    const fetchMock = mockFetchOnce({ success: true, data: { ok: true } });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("body FormData (upload file) -> KHÔNG ép Content-Type để browser tự set boundary", async () => {
    const fetchMock = mockFetchOnce({ success: true, data: { url: "https://cdn/x.png" } });
    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.append("file", new Blob(["x"], { type: "image/png" }), "a.png");

    const result = await apiRequest<{ url: string }>("/api/staff/uploads", {
      method: "POST",
      body: formData,
    });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(result).toEqual({ url: "https://cdn/x.png" });
  });
});
