import { createElement, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CartLineItem } from "./CartLineItem";
import { formatCurrencyVnd } from "@/lib/utils";
import type { Product } from "@/features/product/types";

vi.mock("next/image", () => ({
  default: ({ fill, ...props }: ComponentProps<"img"> & { fill?: boolean }) => {
    void fill;
    return createElement("img", props);
  },
}));

const product: Product = {
  id: "nutein-1",
  name: "Nutein Protein",
  unitLabel: "Hộp 3 hũ",
  price: 500_000,
  image: "/images/nutein.png",
  imageAlt: "Nutein",
};

const noop = () => {};

/**
 * `Intl.NumberFormat("vi-VN")` chèn non-breaking space (U+00A0) trước "₫",
 * còn testing-library chuẩn hoá whitespace của DOM về space thường.
 */
const currencyText = (amount: number) => formatCurrencyVnd(amount).replace(/\s/g, " ");

describe("CartLineItem", () => {
  it("renders lineSubtotal verbatim instead of product.price * quantity for a bundle-discounted line", () => {
    const quantity = 3;
    // Giá gói 3 hũ đã chiết khấu — khác hẳn phép nhân đơn giá naive.
    const lineSubtotal = 1_275_000;
    const naiveSubtotal = product.price * quantity;

    render(
      <CartLineItem
        product={product}
        quantity={quantity}
        lineSubtotal={lineSubtotal}
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
      />,
    );

    expect(lineSubtotal).not.toBe(naiveSubtotal);
    expect(screen.getByText(currencyText(lineSubtotal))).toBeInTheDocument();
    expect(screen.queryByText(currencyText(naiveSubtotal))).not.toBeInTheDocument();
  });

  it("renders lineSubtotal even when it equals zero (không rơi về fallback nhân đơn giá)", () => {
    render(
      <CartLineItem
        product={product}
        quantity={2}
        lineSubtotal={0}
        onIncrement={noop}
        onDecrement={noop}
        onRemove={noop}
      />,
    );

    expect(screen.getByText(currencyText(0))).toBeInTheDocument();
    expect(screen.queryByText(currencyText(product.price * 2))).not.toBeInTheDocument();
  });
});
