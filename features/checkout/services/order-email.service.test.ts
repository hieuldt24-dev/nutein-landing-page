// @vitest-environment node
// order-email.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderResult } from "@/features/checkout/types";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

let resendConfigured = true;

vi.mock("@/lib/resend", () => ({
  get resend() {
    return resendConfigured ? { emails: { send: mocks.send } } : null;
  },
  ORDER_EMAIL_FROM: "Nutein <onboarding@resend.dev>",
}));

import { orderEmailService } from "./order-email.service";

const order: CreateOrderResult = {
  orderId: "order-1",
  orderCode: "NT-20260722-AB12",
  status: "pending",
  estimatedDeliveryLabel: "Dự kiến giao trong 3–5 ngày làm việc",
  summary: {
    quantity: 1,
    unitPrice: 249000,
    subtotal: 249000,
    discountPercent: 0,
    discountAmount: 0,
    shippingFee: 25000,
    shippingNote: "Giao hàng tiêu chuẩn",
    total: 274000,
  },
  buyer: { fullName: "Nguyễn Văn A", phone: "0912345678", email: "a@example.com" },
  address: {
    provinceCode: "01",
    province: "Hà Nội",
    wardCode: "001",
    ward: "Phúc Xá",
    street: "123 Đường ABC",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
};

describe("orderEmailService.sendOrderConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resendConfigured = true;
  });

  it("thiếu RESEND_API_KEY (resend = null) -> không throw, không gọi send", async () => {
    resendConfigured = false;

    await expect(orderEmailService.sendOrderConfirmation(order)).resolves.toBeUndefined();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("gửi đúng to/subject/from tới email người mua", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation(order);

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Nutein <onboarding@resend.dev>",
        to: "a@example.com",
        subject: expect.stringContaining("NT-20260722-AB12"),
      }),
    );
  });

  it("resend.emails.send lỗi (throw) -> nuốt lỗi, không throw ra ngoài (best-effort)", async () => {
    mocks.send.mockRejectedValue(new Error("resend down"));

    await expect(orderEmailService.sendOrderConfirmation(order)).resolves.toBeUndefined();
  });

  it("resend.emails.send resolve với {error} (vd domain chưa verify) -> không throw, không coi là thành công", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "The nutein.vn domain is not verified", statusCode: 403, name: "invalid_from_address" },
    });

    await expect(orderEmailService.sendOrderConfirmation(order)).resolves.toBeUndefined();
    expect(mocks.send).toHaveBeenCalled();
  });
});
