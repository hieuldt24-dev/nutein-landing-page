import { describe, it, expect, beforeEach } from "vitest";
import { cartRepository } from "./cart.repository";
import { CART_QUANTITY_STORAGE_KEY, CART_STATE_STORAGE_KEY } from "../constants";

describe("cartRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readState trả rỗng khi chưa có gì trong localStorage", () => {
    expect(cartRepository.readState()).toEqual({ lines: [] });
  });

  it("writeState rồi readState round-trip đúng, đã normalize", () => {
    const written = cartRepository.writeState({
      lines: [{ variantId: "pack-1", quantity: 2 }],
    });

    expect(written.lines).toEqual([{ variantId: "pack-1", quantity: 2 }]);
    expect(cartRepository.readState()).toEqual(written);
  });

  it("readState coerce shape cũ { variantId, quantity } sang { lines }", () => {
    window.localStorage.setItem(
      CART_STATE_STORAGE_KEY,
      JSON.stringify({ variantId: "pack-3", quantity: 1 }),
    );

    expect(cartRepository.readState()).toEqual({
      lines: [{ variantId: "pack-3", quantity: 1 }],
    });
  });

  it("readState fallback sang key nutein:cart-quantity khi không có cart-state", () => {
    window.localStorage.setItem(CART_QUANTITY_STORAGE_KEY, "2");

    expect(cartRepository.readState()).toEqual({
      lines: [{ variantId: "pack-1", quantity: 2 }],
    });
  });

  it("readState trả rỗng (không throw) khi JSON hỏng", () => {
    window.localStorage.setItem(CART_STATE_STORAGE_KEY, "{not-json");

    expect(cartRepository.readState()).toEqual({ lines: [] });
  });

  it("writeState dọn key cũ CART_QUANTITY_STORAGE_KEY sau khi ghi", () => {
    window.localStorage.setItem(CART_QUANTITY_STORAGE_KEY, "5");

    cartRepository.writeState({ lines: [{ variantId: "pack-1", quantity: 1 }] });

    expect(window.localStorage.getItem(CART_QUANTITY_STORAGE_KEY)).toBeNull();
  });
});
