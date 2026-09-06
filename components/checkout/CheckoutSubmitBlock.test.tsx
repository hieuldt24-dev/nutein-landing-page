import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutSubmitBlock } from "./CheckoutSubmitBlock";
import type { AccountOrder } from "@/features/account/types";

function makeUnpaidOrder(id: string, orderCode: string): AccountOrder {
  return {
    id,
    orderCode,
    status: "pending",
    createdAt: "2026-09-06T08:00:00.000Z",
    quantity: 1,
    variantLabel: "1 hộp",
    total: 224000,
    paymentStatus: "UNPAID",
  };
}

describe("CheckoutSubmitBlock — 409 vượt hạn mức đơn giữ chỗ (AC10)", () => {
  it("dẫn về đúng các đơn cũ của khách và KHÔNG mời thử lại", () => {
    render(
      <CheckoutSubmitBlock
        isSubmitting={false}
        blocked={{
          error: {
            kind: "cap",
            code: "UNPAID_ORDER_LIMIT",
            message: "Bạn đang có 2 đơn chưa thanh toán.",
          },
          unpaidOrders: [
            makeUnpaidOrder("id-1", "NT-A"),
            makeUnpaidOrder("id-2", "NT-B"),
          ],
        }}
      />,
    );

    const first = screen.getByRole("link", { name: /Xử lý đơn NT-A/i });
    expect(first).toHaveAttribute("href", "/account/orders/id-1");
    expect(
      screen.getByRole("link", { name: /Xử lý đơn NT-B/i }),
    ).toHaveAttribute("href", "/account/orders/id-2");

    // Nút đặt hàng vẫn còn (giỏ chưa mất) nhưng KHÔNG có lời mời "thử lại".
    expect(screen.queryByText(/thử lại/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/giỏ hàng của bạn vẫn được giữ nguyên/i),
    ).toBeInTheDocument();
  });

  it("không lấy được danh sách đơn thì vẫn có lối đi tới trang đơn hàng", () => {
    render(
      <CheckoutSubmitBlock
        isSubmitting={false}
        blocked={{
          error: {
            kind: "cap",
            code: "UNPAID_ORDER_LIMIT",
            message: "Bạn đang có 2 đơn chưa thanh toán.",
          },
          unpaidOrders: [],
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Xem đơn hàng của tôi/i }),
    ).toHaveAttribute("href", "/account/orders");
  });
});

describe("CheckoutSubmitBlock — 429/503/timeout", () => {
  it("mời thử lại VÀ nói rõ bấm lại không tạo đơn trùng", () => {
    render(
      <CheckoutSubmitBlock
        isSubmitting={false}
        blocked={{
          error: {
            kind: "retryable",
            code: "CHECKOUT_RATE_LIMITED",
            message: "Quá nhiều yêu cầu.",
            retryAfterSeconds: 42,
          },
          unpaidOrders: [],
        }}
      />,
    );

    expect(screen.getByText(/hãy thử lại/i)).toBeInTheDocument();
    expect(screen.getByText(/thử lại sau 42 giây/i)).toBeInTheDocument();
    expect(screen.getByText(/không\s+tạo đơn trùng/i)).toBeInTheDocument();
    // Không được nhầm sang thông điệp của nhánh cap.
    expect(
      screen.queryByText(/đơn chuyển khoản chưa hoàn tất/i),
    ).not.toBeInTheDocument();
  });

  it("không có Retry-After thì không hiển thị số giây bịa ra", () => {
    render(
      <CheckoutSubmitBlock
        isSubmitting={false}
        blocked={{
          error: {
            kind: "retryable",
            code: "CHECKOUT_PROTECTION_UNAVAILABLE",
            message: "Hệ thống đang bận.",
          },
          unpaidOrders: [],
        }}
      />,
    );
    expect(screen.queryByText(/giây/i)).not.toBeInTheDocument();
  });
});

describe("CheckoutSubmitBlock — không có lỗi", () => {
  it("không hiện cảnh báo nào", () => {
    render(<CheckoutSubmitBlock isSubmitting={false} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
