import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutSuccessView } from "./CheckoutSuccessView";
import type { CreateOrderResult } from "@/features/checkout/types";

function makeOrder(overrides: Partial<CreateOrderResult> = {}): CreateOrderResult {
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
    expect(screen.getByText(/Đang chờ xác nhận thanh toán/i)).toBeInTheDocument();
    expect(
      screen.getByText(/xác nhận thủ công sau khi chúng tôi nhận được tiền/i),
    ).toBeInTheDocument();
    // Không còn framing "tự động xác nhận" của payOS.
    expect(screen.queryByText(/tự động xác nhận/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payOS/i)).not.toBeInTheDocument();
  });

  it("không crash khi thiếu qrImageUrl — hiện fallback liên hệ hỗ trợ", () => {
    render(<CheckoutSuccessView order={makeOrder({ qrImageUrl: undefined })} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa tạo được mã QR chuyển khoản/i)).toBeInTheDocument();
    expect(screen.getByText(/Đang chờ xác nhận thanh toán/i)).toBeInTheDocument();
  });

  it("đơn COD không hiện block chuyển khoản", () => {
    render(
      <CheckoutSuccessView
        order={makeOrder({ paymentMethod: "cod", status: "pending", qrImageUrl: undefined })}
      />,
    );

    expect(screen.queryByText(/Đang chờ xác nhận thanh toán/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
