import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountOrderDetail } from "./AccountOrderDetail";
import type { AccountOrderDetail as AccountOrderDetailDto } from "@/features/account/types";
import type { FetchError } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  getOrderDetail: vi.fn(),
  claimPayment: vi.fn(),
  requestCancel: vi.fn(),
}));

vi.mock("@/features/account/services/account-order.client", () => ({
  accountOrderClient: {
    getOrderDetail: mocks.getOrderDetail,
    claimPayment: mocks.claimPayment,
    requestCancel: mocks.requestCancel,
  },
}));

vi.mock("@/lib/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const NOW = new Date("2026-09-06T10:00:00.000Z");

function makeDetail(
  overrides: Partial<AccountOrderDetailDto> = {},
): AccountOrderDetailDto {
  return {
    id: "order-1",
    orderCode: "NT-20260906-AB12",
    status: "pending",
    createdAt: "2026-09-06T09:30:00.000Z",
    quantity: 1,
    variantLabel: "1 hộp",
    total: 224000,
    paymentStatus: "UNPAID",
    paymentMethod: "BANK_TRANSFER",
    paymentExpiresAt: "2026-09-06T10:30:00.000Z",
    reviewState: "AWAITING_TRANSFER",
    stateVersion: 3,
    qrImageUrl: "https://img.vietqr.io/image/x.png",
    allowedActions: ["claim_payment", "request_cancel"],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getOrderDetail.mockReset();
  mocks.claimPayment.mockReset();
  mocks.requestCancel.mockReset();
});

describe("AccountOrderDetail — hiển thị theo trạng thái server", () => {
  it("đơn còn hạn: hiện QR, hạn từ server, đủ hai hành động", async () => {
    mocks.getOrderDetail.mockResolvedValue(makeDetail());
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    expect(
      await screen.findByRole("img", { name: /Mã QR chuyển khoản VietQR/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Hạn chuyển khoản:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tôi đã chuyển khoản/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Yêu cầu hủy đơn/i }),
    ).toBeInTheDocument();
  });

  it("quá hạn: ẨN QR, hiện trạng thái đối soát, KHÔNG nói đơn đã bị hủy", async () => {
    mocks.getOrderDetail.mockResolvedValue(
      makeDetail({
        paymentExpiresAt: "2026-09-06T09:00:00.000Z",
        reviewState: "REVIEW_REQUIRED",
      }),
    );
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    await screen.findByText(/Đang chờ nhân viên đối soát/i);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Hạn chuyển khoản \(đã qua\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/CHƯA bị hủy/i)).toBeInTheDocument();
  });

  it("không có hạn (enforcement tắt / đơn legacy): KHÔNG vẽ hạn nào", async () => {
    mocks.getOrderDetail.mockResolvedValue(
      makeDetail({ paymentExpiresAt: null, reviewState: null }),
    );
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    await screen.findByRole("img", { name: /Mã QR/i });
    expect(screen.queryByText(/Hạn chuyển khoản/i)).not.toBeInTheDocument();
  });

  it("đơn đã thanh toán / đã hủy: không còn hành động nào", async () => {
    mocks.getOrderDetail.mockResolvedValue(
      makeDetail({
        paymentStatus: "PAID",
        status: "processing",
        allowedActions: [],
        qrImageUrl: undefined,
      }),
    );
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    await screen.findByText(/Đã nhận thanh toán/i);
    expect(
      screen.queryByRole("button", { name: /Tôi đã chuyển khoản/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Yêu cầu hủy đơn/i }),
    ).not.toBeInTheDocument();
  });

  it("đã claim: nút claim biến mất (server không còn cho phép hành động)", async () => {
    mocks.getOrderDetail.mockResolvedValue(
      makeDetail({
        reviewState: "PAYMENT_CLAIMED",
        allowedActions: ["request_cancel"],
      }),
    );
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    await screen.findByText(/Bạn đã báo chuyển khoản/i);
    expect(
      screen.queryByRole("button", { name: /Tôi đã chuyển khoản/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/CHƯA phải xác nhận thanh toán/i),
    ).toBeInTheDocument();
  });
});

describe("AccountOrderDetail — hành động", () => {
  it("claim gửi đúng expectedVersion rồi đọc lại trạng thái từ server", async () => {
    const user = userEvent.setup();
    mocks.getOrderDetail
      .mockResolvedValueOnce(makeDetail({ stateVersion: 3 }))
      .mockResolvedValueOnce(
        makeDetail({
          stateVersion: 4,
          reviewState: "PAYMENT_CLAIMED",
          allowedActions: ["request_cancel"],
        }),
      );
    mocks.claimPayment.mockResolvedValue({
      orderId: "order-1",
      changed: true,
      reviewState: "PAYMENT_CLAIMED",
      stateVersion: 4,
      paymentStatus: "UNPAID",
    });

    render(<AccountOrderDetail orderId="order-1" now={NOW} />);
    await user.click(
      await screen.findByRole("button", { name: /Tôi đã chuyển khoản/i }),
    );

    expect(mocks.claimPayment).toHaveBeenCalledWith("order-1", {
      expectedVersion: 3,
    });
    // Đọc lại: lần 1 lúc mount, lần 2 sau thao tác.
    await waitFor(() => expect(mocks.getOrderDetail).toHaveBeenCalledTimes(2));
    // Sau khi đọc lại, nút claim biến mất -> không claim được lần hai.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Tôi đã chuyển khoản/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("409 ORDER_STATE_CONFLICT -> đọc lại và vẽ trạng thái THẬT, không ghi đè", async () => {
    const user = userEvent.setup();
    const conflict = new Error("Đơn đã thay đổi") as FetchError;
    conflict.status = 409;
    conflict.code = "ORDER_STATE_CONFLICT";

    mocks.getOrderDetail
      .mockResolvedValueOnce(makeDetail({ stateVersion: 3 }))
      // Trạng thái thật: nhân viên vừa xác nhận đã nhận tiền.
      .mockResolvedValueOnce(
        makeDetail({
          stateVersion: 9,
          paymentStatus: "PAID",
          status: "processing",
          allowedActions: [],
          qrImageUrl: undefined,
        }),
      );
    mocks.claimPayment.mockRejectedValue(conflict);

    render(<AccountOrderDetail orderId="order-1" now={NOW} />);
    await user.click(
      await screen.findByRole("button", { name: /Tôi đã chuyển khoản/i }),
    );

    await waitFor(() => expect(mocks.getOrderDetail).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Đã nhận thanh toán/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("yêu cầu hủy được mô tả là yêu cầu chờ nhân viên, không phải đã hủy", async () => {
    mocks.getOrderDetail.mockResolvedValue(makeDetail());
    render(<AccountOrderDetail orderId="order-1" now={NOW} />);

    await screen.findByRole("button", { name: /Yêu cầu hủy đơn/i });
    expect(
      screen.getByText(
        /một yêu cầu chờ nhân viên\s+xử lý, đơn không bị hủy ngay/i,
      ),
    ).toBeInTheDocument();
  });
});
