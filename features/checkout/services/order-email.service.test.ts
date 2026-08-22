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

  it("escape ký tự HTML trong tên/địa chỉ người mua trước khi nội suy vào email", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation({
      ...order,
      buyer: { ...order.buyer, fullName: "<img src=x onerror=alert(1)>" },
      address: { ...order.address, street: "</td></tr><tr><td>Fake" },
    });

    const { html } = mocks.send.mock.calls[0][0] as { html: string };

    // Payload thô không được xuất hiện nguyên dạng...
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("</td></tr><tr><td>Fake");
    // ...mà phải ở dạng entity đã escape.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;Fake");
  });

  it("escape & và dấu nháy trong tên hợp lệ, không double-escape", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation({
      ...order,
      buyer: { ...order.buyer, fullName: "O'Brien & \"Con\"" },
    });

    const { html } = mocks.send.mock.calls[0][0] as { html: string };

    expect(html).toContain("O&#39;Brien &amp; &quot;Con&quot;");
    expect(html).not.toContain("&amp;#39;");
    expect(html).not.toContain("&amp;quot;");
  });

  // AC11 — dòng mã giảm giá là dòng RIÊNG, không gộp vào dòng "Giảm giá" (tổng).
  it("có coupon → HTML hiện dòng 'Mã giảm giá' kèm mã và số tiền, giữ nguyên dòng Giảm giá tổng", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation({
      ...order,
      summary: {
        ...order.summary,
        discountAmount: 30000,
        couponCode: "SALE10",
        couponDiscountAmount: 20000,
      },
    });

    const { html } = mocks.send.mock.calls[0][0] as { html: string };

    expect(html).toContain("Mã giảm giá");
    expect(html).toContain("SALE10");
    // Dòng "Giảm giá" (tổng) vẫn còn — 2 dòng cùng tồn tại.
    expect(html).toContain(">Giảm giá</td>");
  });

  it("không có coupon → HTML KHÔNG có dòng 'Mã giảm giá'", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation(order);

    const { html } = mocks.send.mock.calls[0][0] as { html: string };

    expect(html).not.toContain("Mã giảm giá");
  });

  it("mã giảm giá do khách nhập phải được escape trước khi vào HTML", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await orderEmailService.sendOrderConfirmation({
      ...order,
      summary: {
        ...order.summary,
        couponCode: "<img src=x onerror=alert(1)>",
        couponDiscountAmount: 1000,
      },
    });

    const { html } = mocks.send.mock.calls[0][0] as { html: string };

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
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
