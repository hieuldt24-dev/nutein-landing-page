import "server-only";

import { ORDER_EMAIL_FROM, resend } from "@/lib/resend";
import { logger } from "@/src/logging/logger";
import { formatCurrencyVnd } from "@/lib/utils";
import { PAYMENT_OPTIONS, SHIPPING_OPTIONS } from "../constants";
import type { CreateOrderResult } from "../types";

const serviceLogger = logger.child({ service: "orderEmailService" });

function renderOrderConfirmationHtml(order: CreateOrderResult): string {
  const paymentLabel =
    PAYMENT_OPTIONS.find((o) => o.value === order.paymentMethod)?.label ?? order.paymentMethod;
  const shippingLabel =
    SHIPPING_OPTIONS.find((o) => o.value === order.shippingMethod)?.label ?? order.shippingMethod;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 20px;">Cảm ơn bạn đã đặt hàng tại Nutein</h1>
      <p>Mã đơn hàng của bạn là <strong>${order.orderCode}</strong>. Chúng tôi sẽ liên hệ xác nhận qua SĐT hoặc email khi xử lý đơn.</p>

      <h2 style="font-size: 15px; margin-top: 24px;">Thông tin giao hàng</h2>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #666;">Người nhận</td><td style="padding: 4px 0;">${order.buyer.fullName} · ${order.buyer.phone}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Địa chỉ</td><td style="padding: 4px 0;">${order.address.street}, ${order.address.ward}, ${order.address.province}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Vận chuyển</td><td style="padding: 4px 0;">${shippingLabel} — ${order.estimatedDeliveryLabel}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Thanh toán</td><td style="padding: 4px 0;">${paymentLabel}</td></tr>
      </table>

      <h2 style="font-size: 15px; margin-top: 24px;">Chi tiết đơn hàng</h2>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #666;">Số lượng</td><td style="padding: 4px 0;">${order.summary.quantity}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Tạm tính</td><td style="padding: 4px 0;">${formatCurrencyVnd(order.summary.subtotal)}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Phí ship</td><td style="padding: 4px 0;">${formatCurrencyVnd(order.summary.shippingFee)}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Giảm giá</td><td style="padding: 4px 0;">−${formatCurrencyVnd(order.summary.discountAmount)}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; border-top: 1px solid #eee;">Tổng thanh toán</td><td style="padding: 8px 0; font-weight: bold; border-top: 1px solid #eee;">${formatCurrencyVnd(order.summary.total)}</td></tr>
      </table>

      <p style="margin-top: 24px; font-size: 12px; color: #999;">Đơn demo — chưa trừ tiền / chưa đồng bộ kho thật.</p>
    </div>
  `;
}

export const orderEmailService = {
  /**
   * Best-effort — gửi email xác nhận ngay sau khi tạo đơn thành công.
   * KHÔNG throw: đơn đã tạo xong, lỗi gửi mail không được chặn checkout flow.
   */
  async sendOrderConfirmation(order: CreateOrderResult): Promise<void> {
    if (!resend) {
      serviceLogger.warn(
        { orderCode: order.orderCode },
        "Thiếu RESEND_API_KEY — bỏ qua gửi email xác nhận đơn",
      );
      return;
    }

    try {
      // resend.emails.send KHÔNG throw khi lỗi API (vd domain chưa verify)
      // — nó resolve về { data: null, error }. Phải check `error` tường
      // minh, không chỉ dựa vào try/catch (chỉ bắt lỗi network/runtime).
      const { data, error } = await resend.emails.send({
        from: ORDER_EMAIL_FROM,
        to: order.buyer.email,
        subject: `Nutein — Xác nhận đơn hàng ${order.orderCode}`,
        html: renderOrderConfirmationHtml(order),
      });

      if (error) {
        serviceLogger.error(
          { err: error, orderCode: order.orderCode },
          "Gửi email xác nhận đơn thất bại (best-effort, bỏ qua)",
        );
        return;
      }

      serviceLogger.info(
        { orderCode: order.orderCode, emailId: data?.id },
        "Đã gửi email xác nhận đơn",
      );
    } catch (err) {
      serviceLogger.error(
        { err, orderCode: order.orderCode },
        "Gửi email xác nhận đơn thất bại (best-effort, bỏ qua)",
      );
    }
  },
};
