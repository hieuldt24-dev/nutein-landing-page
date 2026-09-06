import { describe, it, expect } from "vitest";
import {
  filterNeedsReview,
  reviewQueueBucket,
  sortByReviewPriority,
} from "./review-queue";
import type { AdminOrder } from "./types";

const NOW = new Date("2026-09-06T10:00:00.000Z");

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "o1",
    orderCode: "NT-1",
    status: "pending",
    createdAt: "2026-09-06T08:00:00.000Z",
    updatedAt: "2026-09-06T08:00:00.000Z",
    customerName: "A",
    customerEmail: "a@x.vn",
    customerPhone: "0900000000",
    shippingAddressLabel: "—",
    paymentMethodLabel: "Chuyển khoản ngân hàng",
    paymentMethod: "BANK_TRANSFER",
    paymentStatus: "unpaid",
    shippingFee: 0,
    discountAmount: 0,
    subtotal: 100,
    total: 100,
    lines: [],
    statusHistory: [],
    ...overrides,
  };
}

describe("reviewQueueBucket", () => {
  it("quá hạn đối soát xếp nhóm overdue", () => {
    const order = makeOrder({
      reviewDueAt: "2026-09-06T09:00:00.000Z",
      paymentReviewState: "REVIEW_REQUIRED",
    });
    expect(reviewQueueBucket(order, NOW)).toBe("overdue");
  });

  it("khách báo đã chuyển nhưng chưa quá hạn -> claimed", () => {
    const order = makeOrder({
      paymentReviewState: "PAYMENT_CLAIMED",
      reviewDueAt: "2026-09-06T12:00:00.000Z",
    });
    expect(reviewQueueBucket(order, NOW)).toBe("claimed");
  });

  it("đơn đã thanh toán hoặc đã hủy không nằm trong hàng đợi", () => {
    expect(
      reviewQueueBucket(
        makeOrder({
          paymentStatus: "paid",
          reviewDueAt: "2026-09-06T09:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe("none");
    expect(
      reviewQueueBucket(
        makeOrder({
          status: "cancelled",
          paymentReviewState: "PAYMENT_CLAIMED",
        }),
        NOW,
      ),
    ).toBe("none");
  });

  it("đơn chưa apply migration (không có field RFC-2) -> none, không vỡ", () => {
    expect(reviewQueueBucket(makeOrder(), NOW)).toBe("none");
  });
});

describe("sortByReviewPriority", () => {
  it("quá hạn lên trước claimed, claimed trước chờ-đối-soát, còn lại giữ thứ tự", () => {
    const plain = makeOrder({ id: "plain" });
    const claimed = makeOrder({
      id: "claimed",
      paymentReviewState: "PAYMENT_CLAIMED",
    });
    const review = makeOrder({
      id: "review",
      paymentReviewState: "REVIEW_REQUIRED",
      reviewDueAt: "2026-09-06T20:00:00.000Z",
    });
    const overdue = makeOrder({
      id: "overdue",
      reviewDueAt: "2026-09-06T01:00:00.000Z",
    });

    const sorted = sortByReviewPriority([plain, claimed, review, overdue], NOW);
    expect(sorted.map((o) => o.id)).toEqual([
      "overdue",
      "claimed",
      "review",
      "plain",
    ]);
  });
});

describe("filterNeedsReview", () => {
  it("chỉ giữ đơn cần người xử lý", () => {
    const result = filterNeedsReview(
      [
        makeOrder({ id: "plain" }),
        makeOrder({ id: "claimed", paymentReviewState: "PAYMENT_CLAIMED" }),
      ],
      NOW,
    );
    expect(result.map((o) => o.id)).toEqual(["claimed"]);
  });
});
