import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutSuccessView } from "./CheckoutSuccessView";
import type { CreateOrderResult } from "@/features/checkout/types";
import type { AccountOrderDetail } from "@/features/account/types";

function makeOrder(
  overrides: Partial<CreateOrderResult> = {},
): CreateOrderResult {
  return {
    orderId: "order-1",
    orderCode: "NT-20260827-AB12",
    status: "awaiting_payment",
    estimatedDeliveryLabel: "Dự kiến giao trong 3–5 ngày làm việc",
    summary: {
      quantity: 1,
      unitPrice: 199000,
      subtotal: 199000,
      discountPercent: 0,
      discountAmount: 0,
      shippingFee: 25000,
      shippingNote: "",
      total: 224000,
    },
    buyer: {
      fullName: "Nguyễn Văn A",
      phone: "0912345678",
      email: "a@example.com",
    },
    address: {
      provinceCode: "01",
      province: "Hà Nội",
      wardCode: "0001",
      ward: "Phúc Xá",
      street: "123 Đường ABC",
    },
    shippingMethod: "standard",
    paymentMethod: "bank_transfer",
    ...overrides,
  } as CreateOrderResult;
}

describe("CheckoutSuccessView — chuyển khoản VietQR", () => {
  it("hiển thị ảnh QR + copy xác nhận thủ công, không có spinner/poll", () => {
    const qrImageUrl =
      "https://img.vietqr.io/image/970407-19001234567890-compact2.png?amount=224000&addInfo=NT-20260827-AB12";
    render(<CheckoutSuccessView order={makeOrder({ qrImageUrl })} />);

    const img = screen.getByRole("img", { name: /Mã QR chuyển khoản VietQR/i });
    expect(img).toHaveAttribute("src", qrImageUrl);
    expect(
      screen.getByText(/Đang chờ xác nhận thanh toán/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/xác nhận thủ công sau khi chúng tôi nhận được tiền/i),
    ).toBeInTheDocument();
    // Không còn framing "tự động xác nhận" của payOS.
    expect(screen.queryByText(/tự động xác nhận/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payOS/i)).not.toBeInTheDocument();
  });

  it("không crash khi thiếu qrImageUrl — hiện fallback liên hệ hỗ trợ", () => {
    render(
      <CheckoutSuccessView order={makeOrder({ qrImageUrl: undefined })} />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Chưa tạo được mã QR chuyển khoản/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Đang chờ xác nhận thanh toán/i),
    ).toBeInTheDocument();
  });

  it("đơn COD không hiện block chuyển khoản", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          paymentMethod: "cod",
          status: "pending",
          qrImageUrl: undefined,
        })}
      />,
    );

    expect(
      screen.queryByText(/Đang chờ xác nhận thanh toán/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

const NOW = new Date("2026-09-06T10:00:00.000Z");

function makeServerState(
  overrides: Partial<AccountOrderDetail> = {},
): AccountOrderDetail {
  return {
    id: "order-1",
    orderCode: "NT-20260827-AB12",
    status: "pending",
    createdAt: "2026-09-06T09:30:00.000Z",
    quantity: 1,
    variantLabel: "1 hộp",
    total: 224000,
    paymentStatus: "UNPAID",
    paymentMethod: "BANK_TRANSFER",
    paymentExpiresAt: "2026-09-06T10:30:00.000Z",
    reviewState: "AWAITING_TRANSFER",
    stateVersion: 1,
    qrImageUrl: "https://img.vietqr.io/image/server.png",
    allowedActions: ["claim_payment", "request_cancel"],
    ...overrides,
  };
}

describe("CheckoutSuccessView — trạng thái server thắng snapshot (AC10)", () => {
  it("server nói đã quá hạn -> ẨN QR dù snapshot vẫn còn qrImageUrl", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
        })}
        serverState={makeServerState({
          paymentExpiresAt: "2026-09-06T09:00:00.000Z",
          reviewState: "REVIEW_REQUIRED",
        })}
        now={NOW}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Đang chờ nhân viên đối soát/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hạn chuyển khoản \(đã qua\)/i),
    ).toBeInTheDocument();
  });

  it("server nói đã thanh toán -> không còn QR, dù snapshot lúc đặt hàng có QR", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
        })}
        serverState={makeServerState({
          paymentStatus: "PAID",
          qrImageUrl: undefined,
          allowedActions: [],
        })}
        now={NOW}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Đã nhận thanh toán/i)).toBeInTheDocument();
  });

  it("QR hiển thị là QR CỦA SERVER, không phải của snapshot", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
        })}
        serverState={makeServerState()}
        now={NOW}
      />,
    );
    expect(screen.getByRole("img", { name: /Mã QR/i })).toHaveAttribute(
      "src",
      "https://img.vietqr.io/image/server.png",
    );
  });

  it("không có paymentExpiresAt -> KHÔNG vẽ hạn nào (không tự tính từ đồng hồ trình duyệt)", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
        })}
        serverState={makeServerState({ paymentExpiresAt: null })}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/Hạn chuyển khoản/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Mã QR/i })).toBeInTheDocument();
  });

  it("chưa tải được trạng thái server -> vẫn dùng snapshot, không chặn màn xác nhận", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
          paymentExpiresAt: "2026-09-06T10:30:00.000Z",
        })}
        serverState={null}
        now={NOW}
      />,
    );
    expect(screen.getByRole("img", { name: /Mã QR/i })).toHaveAttribute(
      "src",
      "https://img.vietqr.io/image/snap.png",
    );
    expect(screen.getByText(/^Hạn chuyển khoản:/)).toBeInTheDocument();
  });

  it("copy nói rõ claim chưa phải xác nhận thanh toán", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({
          qrImageUrl: "https://img.vietqr.io/image/snap.png",
        })}
        serverState={makeServerState()}
        now={NOW}
      />,
    );
    expect(
      screen.getByText(/chưa phải\s+xác nhận thanh toán/i),
    ).toBeInTheDocument();
  });
});

describe("CheckoutSuccessView — replay (RFC-2 contract)", () => {
  it("replayed: true -> nói đơn đã tồn tại, KHÔNG ăn mừng 'đặt hàng thành công'", () => {
    render(
      <CheckoutSuccessView order={makeOrder({ replayed: true })} now={NOW} />,
    );
    expect(screen.getByText(/đã được tạo trước đó/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Đặt hàng thành công$/)).not.toBeInTheDocument();
    expect(screen.getByText(/không tạo thêm đơn mới/i)).toBeInTheDocument();
  });

  it("thiếu field replayed (server contract cũ) -> vẫn là đơn mới, không vỡ", () => {
    render(<CheckoutSuccessView order={makeOrder()} now={NOW} />);
    expect(screen.getByText(/Đặt hàng thành công/i)).toBeInTheDocument();
    expect(screen.queryByText(/đã được tạo trước đó/i)).not.toBeInTheDocument();
  });
});
