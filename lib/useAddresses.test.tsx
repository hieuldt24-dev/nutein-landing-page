import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";

const mocks = vi.hoisted(() => ({
  isLoggedIn: true,
}));

vi.mock("@/lib/useAuthStore", () => ({
  useAuthStore: () => ({ isLoggedIn: mocks.isLoggedIn }),
}));

import { useAddresses } from "./useAddresses";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const addressFields = {
  provinceCode: "01",
  province: "Hà Nội",
  wardCode: "001",
  ward: "Phúc Xá",
  street: "123 Đường ABC",
};

const addr1 = { id: "addr-1", ...addressFields, isDefault: true };

function renderAddresses() {
  return renderHook(() => useAddresses(), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    ),
  });
}

describe("useAddresses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.isLoggedIn = true;
  });

  it("chưa đăng nhập -> không gọi API, addresses rỗng", async () => {
    mocks.isLoggedIn = false;
    const fetchSpy = vi.spyOn(global, "fetch");

    const { result } = renderAddresses();

    expect(result.current.addresses).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("đã đăng nhập -> GET /api/account/addresses, populate addresses + defaultAddress", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { success: true, data: [addr1], error: null }),
    );

    const { result } = renderAddresses();

    await waitFor(() => expect(result.current.addresses).toEqual([addr1]));
    expect(result.current.defaultAddress).toEqual(addr1);
  });

  it("createAddress -> POST rồi revalidate lại danh sách", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [], error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: { ...addr1, id: "addr-new" },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: [addr1, { ...addr1, id: "addr-new" }],
          error: null,
        }),
      );

    const { result } = renderAddresses();
    await waitFor(() => expect(result.current.addresses).toEqual([]));

    await act(async () => {
      await result.current.createAddress(addressFields);
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/account/addresses",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() => expect(result.current.addresses).toHaveLength(2));
  });

  it("removeAddress -> DELETE đúng URL theo id", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [addr1], error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: null, error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [], error: null }),
      );

    const { result } = renderAddresses();
    await waitFor(() => expect(result.current.addresses).toEqual([addr1]));

    await act(async () => {
      await result.current.removeAddress("addr-1");
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/account/addresses/addr-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("setDefaultAddress -> POST /api/account/addresses/[id]/default", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [addr1], error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { ...addr1, isDefault: true },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [addr1], error: null }),
      );

    const { result } = renderAddresses();
    await waitFor(() => expect(result.current.addresses).toEqual([addr1]));

    await act(async () => {
      await result.current.setDefaultAddress("addr-1");
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/account/addresses/addr-1/default",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("saveAsDefaultFromCheckout: khớp địa chỉ có sẵn (street+ward+province) -> PATCH update thay vì tạo mới", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [addr1], error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: addr1, error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [addr1], error: null }),
      );

    const { result } = renderAddresses();
    await waitFor(() => expect(result.current.addresses).toEqual([addr1]));

    await act(async () => {
      await result.current.saveAsDefaultFromCheckout(addressFields);
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/account/addresses/addr-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("saveAsDefaultFromCheckout: không khớp địa chỉ nào -> POST tạo mới", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: [], error: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: { ...addr1, id: "addr-new" },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: [{ ...addr1, id: "addr-new" }],
          error: null,
        }),
      );

    const { result } = renderAddresses();
    await waitFor(() => expect(result.current.addresses).toEqual([]));

    await act(async () => {
      await result.current.saveAsDefaultFromCheckout(addressFields);
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/account/addresses",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
