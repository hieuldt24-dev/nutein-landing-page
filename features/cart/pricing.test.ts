// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { NUTEIN_PRODUCT_DETAIL } from "@/features/product/data/product.mock";
import { productService } from "@/features/product/services/product.service";
import { buildCartSummary } from "./pricing";

describe("bundle pricing", () => {
  beforeEach(() => {
    productService.setProductDetail(NUTEIN_PRODUCT_DETAIL);
  });

  it("uses the business price and benefit for the two-box bundle", () => {
    const summary = buildCartSummary({ lines: [{ variantId: "pack-2", quantity: 1 }] });

    expect(summary.subtotal).toBe(898_000);
    expect(summary.total).toBe(778_000);
    expect(summary.discountAmount).toBe(120_000);
    expect(summary.voucherProgress.tiers[1]).toMatchObject({
      achieved: true,
      benefit: "Tặng 1 bình nước",
    });
    expect(summary.shippingNote).toBe("Miễn phí vận chuyển");
  });

  it("upgrades repeated one-box quantities to the matching bundle price", () => {
    const summary = buildCartSummary({ lines: [{ variantId: "pack-1", quantity: 2 }] });

    expect(summary.subtotal).toBe(898_000);
    expect(summary.total).toBe(778_000);
    expect(summary.discountAmount).toBe(120_000);
    expect(summary.voucherProgress.tiers[1]).toMatchObject({ achieved: true });
    expect(summary.lines[0]?.lineSubtotal).toBe(778_000);
  });

  it("continues applying the three-box threshold to repeated one-box quantities", () => {
    const summary = buildCartSummary({ lines: [{ variantId: "pack-1", quantity: 3 }] });

    expect(summary.subtotal).toBe(1_347_000);
    expect(summary.total).toBe(1_167_000);
    expect(summary.discountAmount).toBe(180_000);
    expect(summary.voucherProgress.tiers[2]).toMatchObject({ achieved: true });
  });

  it("allocates a mixed-line bundle exactly without changing the final total", () => {
    const summary = buildCartSummary({
      lines: [
        { variantId: "pack-1", quantity: 1 },
        { variantId: "pack-2", quantity: 1 },
      ],
    });

    expect(summary.total).toBe(1_167_000);
    expect(summary.lines.reduce((sum, line) => sum + line.lineSubtotal, 0)).toBe(summary.total);
  });

  it("keeps the five-box offer at the supplied total", () => {
    const summary = buildCartSummary({ lines: [{ variantId: "pack-5", quantity: 1 }] });

    expect(summary.subtotal).toBe(2_245_000);
    expect(summary.discountAmount).toBe(300_000);
    expect(summary.total).toBe(1_945_000);
    expect(summary.voucherProgress.isMaxTierAchieved).toBe(true);
  });
});
