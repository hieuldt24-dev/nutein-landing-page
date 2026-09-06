import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPaymentReviewPanel } from "./AdminPaymentReviewPanel";
import type { AdminOrder } from "@/features/admin-orders/types";

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
    paymentReviewState: "PAYMENT_CLAIMED",
    stateVersion: 7,
    ...overrides,
  };
}

describe("AdminPaymentReviewPanel", () => {
  it("gửi expectedVersion của đơn ĐANG hiển thị kèm evidence metadata", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AdminPaymentReviewPanel
        order={makeOrder({ stateVersion: 7 })}
        isSubmitting={false}
        onSubmit={onSubmit}
        now={NOW}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /Lý do kết luận/i }),
      "Đã kiểm sao kê, không có giao dịch khớp",
    );
    await user.type(screen.getByLabelText(/Tham chiếu nội bộ/i), "TICKET-9");
    await user.click(
      screen.getByRole("button", { name: /Đã kiểm — chưa nhận được tiền/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /Lưu kết luận đối soát/i }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      outcome: "no-transfer",
      reason: "Đã kiểm sao kê, không có giao dịch khớp",
      expectedVersion: 7,
      reference: "TICKET-9",
    });
  });

  it("thiếu lý do thì không gửi được — kết luận phải ghi lại được", async () => {
    const onSubmit = vi.fn();
    render(
      <AdminPaymentReviewPanel
        order={makeOrder()}
        isSubmitting={false}
        onSubmit={onSubmit}
        now={NOW}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Lưu kết luận đối soát/i }),
    ).toBeDisabled();
  });

  it("mặc định là 'chưa kết luận được' — không nghiêng về việc hủy đơn", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AdminPaymentReviewPanel
        order={makeOrder()}
        isSubmitting={false}
        onSubmit={onSubmit}
        now={NOW}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Lý do kết luận/i }),
      "Chưa có sao kê",
    );
    await user.click(
      screen.getByRole("button", { name: /Lưu kết luận đối soát/i }),
    );
    expect(onSubmit.mock.calls[0][0].outcome).toBe("needs-investigation");
  });

  it("KHÔNG có nhánh nào đặt PAID và KHÔNG nhận upload file (V1)", () => {
    render(
      <AdminPaymentReviewPanel
        order={makeOrder()}
        isSubmitting={false}
        onSubmit={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/đã nhận thanh toán/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    // Copy phải nói rõ lời khai của khách không phải chứng cứ ngân hàng.
    expect(screen.getByText(/không phải chứng cứ/i)).toBeInTheDocument();
  });

  it("database chưa apply migration (không có stateVersion) -> báo chưa khả dụng, không dựng form", () => {
    render(
      <AdminPaymentReviewPanel
        order={makeOrder({ stateVersion: undefined })}
        isSubmitting={false}
        onSubmit={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText(/chưa khả dụng/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Lưu kết luận đối soát/i }),
    ).not.toBeInTheDocument();
  });

  it("hiện nhãn hàng đợi (quá hạn / khách báo đã chuyển)", () => {
    render(
      <AdminPaymentReviewPanel
        order={makeOrder({ reviewDueAt: "2026-09-06T01:00:00.000Z" })}
        isSubmitting={false}
        onSubmit={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Quá hạn đối soát/i)).toBeInTheDocument();
  });
});
