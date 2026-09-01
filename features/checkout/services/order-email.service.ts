import "server-only";

import { ORDER_EMAIL_FROM, resend } from "@/lib/resend";
import { env } from "@/lib/env";
import { logger } from "@/src/logging/logger";
import { formatCurrencyVnd } from "@/lib/utils";
import { PAYMENT_OPTIONS, SHIPPING_OPTIONS } from "../constants";
import type { CreateOrderResult } from "../types";

const serviceLogger = logger.child({ service: "orderEmailService" });

// Mirror app/globals.css `@theme` brand tokens — email clients không đọc
// được CSS variables nên phải hardcode giá trị hex tại đây.
const BRAND = {
  primary: "#E2A55D",
  primaryDeep: "#C08635",
  primarySoft: "#FBEEDA",
  ink: "#351E29",
  textBody: "#5A4550",
  textMuted: "#8B7680",
  surface: "#FFFFFF",
  cardBg: "#FBF8F5",
  outerBg: "#F6F1EC",
  border: "#EFE3D6",
} as const;

/**
 * Escape 5 lớp ký tự nguy hiểm trước khi nội suy chuỗi do khách nhập vào
 * template HTML của email (chống HTML injection / XSS trong mail client).
 * Thứ tự quan trọng: `&` phải thay trước, nếu không các entity vừa chèn
 * (`&lt;`, `&quot;`...) sẽ bị escape lần hai.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Ô nhãn/giá trị dùng chung cho các bảng thông tin trong email (label bên trái mờ, value bên phải). */
function infoRow(label: string, value: string): string {
  return `<tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px; vertical-align: top; width: 112px;">${label}</td><td style="padding: 5px 0; color: ${BRAND.ink}; font-size: 14px; font-weight: 600;">${value}</td></tr>`;
}

function renderOrderConfirmationHtml(order: CreateOrderResult): string {
  const paymentLabel =
    PAYMENT_OPTIONS.find((o) => o.value === order.paymentMethod)?.label ?? order.paymentMethod;
  const shippingLabel =
    SHIPPING_OPTIONS.find((o) => o.value === order.shippingMethod)?.label ?? order.shippingMethod;
  const isBankTransfer = order.paymentMethod === "bank_transfer";
  const siteUrl = escapeHtml(env.NEXT_PUBLIC_APP_URL);

  // Dòng riêng cho mã giảm giá — KHÔNG gộp vào dòng "Giảm giá" (tổng) ở trên.
  // `couponCode` là chuỗi khách tự nhập nên bắt buộc escapeHtml, giống
  // buyer.fullName / address.street.
  const couponRow = order.summary.couponCode
    ? `<tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px;">Mã giảm giá</td><td style="padding: 5px 0; font-size: 14px;">${escapeHtml(order.summary.couponCode)} · −${formatCurrencyVnd(order.summary.couponDiscountAmount ?? 0)}</td></tr>`
    : "";

  // Đơn chuyển khoản VietQR (tự host, xác nhận thủ công) hiển thị QR ngay
  // trong email — mirror CheckoutSuccessView.tsx (cùng câu chữ, cùng logic
  // fallback khi build QR thất bại) để khách nhận thông tin nhất quán dù
  // đọc trên web hay trên email.
  const bankTransferBlock = isBankTransfer
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.primarySoft}; border-radius: 12px; margin-top: 16px;">
        <tr><td style="padding: 20px; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.primaryDeep};">Đang chờ xác nhận thanh toán</p>
          ${
            order.qrImageUrl
              ? `<p style="margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: ${BRAND.textBody};">Quét mã QR bên dưới bằng app ngân hàng để chuyển khoản. Số tiền và nội dung chuyển khoản (${order.orderCode}) đã được điền sẵn.</p>
                 <img src="${escapeHtml(order.qrImageUrl)}" alt="Mã QR chuyển khoản VietQR cho đơn ${order.orderCode}" width="200" style="display: block; width: 200px; max-width: 100%; margin: 0 auto; border-radius: 8px; border: 1px solid ${BRAND.border}; background-color: ${BRAND.surface};" />`
              : `<p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${BRAND.textBody};">Chưa tạo được mã QR chuyển khoản — vui lòng liên hệ với chúng tôi để được hỗ trợ thanh toán cho đơn ${order.orderCode}.</p>`
          }
          <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND.textBody};">Đơn hàng sẽ được xác nhận thủ công sau khi chúng tôi nhận được tiền.</p>
        </td></tr>
      </table>`
    : "";

  // Ghi chú "demo" chỉ còn ý nghĩa cho COD (chưa thu tiền lúc đặt) — đơn
  // chuyển khoản VietQR là luồng thanh toán thật, mirror điều kiện
  // `!isBankTransfer` trong CheckoutSuccessView.tsx thay vì hiện cho mọi đơn.
  const demoNote = !isBankTransfer
    ? `<p style="margin: 20px 0 0; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; text-align: center; color: ${BRAND.textMuted};">Đơn demo — chưa trừ tiền / chưa đồng bộ kho thật</p>`
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.outerBg}; padding: 32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: ${BRAND.surface}; border-radius: 16px; overflow: hidden; border: 1px solid ${BRAND.border}; font-family: Arial, Helvetica, sans-serif;">
          <tr>
            <td style="background-color: ${BRAND.primary}; padding: 28px 32px; text-align: center;">
              <a href="${siteUrl}" style="font-size: 22px; font-weight: 800; letter-spacing: 2px; color: ${BRAND.ink}; text-decoration: none;">NUTEIN</a>
              <div style="margin-top: 6px; font-size: 13px; font-weight: 600; color: ${BRAND.ink};">Cảm ơn bạn đã đặt hàng</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 6px; font-size: 13px; color: ${BRAND.textBody};">Mã đơn hàng của bạn</p>
              <p style="margin: 0 0 18px;"><span style="display: inline-block; background-color: ${BRAND.primarySoft}; color: ${BRAND.primaryDeep}; font-weight: 800; font-size: 15px; padding: 8px 14px; border-radius: 999px;">${order.orderCode}</span></p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: ${BRAND.textBody};">Chúng tôi sẽ liên hệ xác nhận qua SĐT hoặc email khi xử lý đơn.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.cardBg}; border-radius: 12px; margin-bottom: 16px;">
                <tr><td style="padding: 18px 20px;">
                  <p style="margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.ink};">Thông tin giao hàng</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${infoRow("Người nhận", `${escapeHtml(order.buyer.fullName)} · ${escapeHtml(order.buyer.phone)}`)}
                    ${infoRow("Địa chỉ", `${escapeHtml(order.address.street)}, ${escapeHtml(order.address.ward)}, ${escapeHtml(order.address.province)}`)}
                    ${infoRow("Vận chuyển", `${shippingLabel} — ${order.estimatedDeliveryLabel}`)}
                    ${infoRow("Thanh toán", paymentLabel)}
                  </table>
                </td></tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.cardBg}; border-radius: 12px;">
                <tr><td style="padding: 18px 20px;">
                  <p style="margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.ink};">Chi tiết đơn hàng</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px;">Số lượng</td><td style="padding: 5px 0; font-size: 14px;">${order.summary.quantity}</td></tr>
                    <tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px;">Tạm tính</td><td style="padding: 5px 0; font-size: 14px;">${formatCurrencyVnd(order.summary.subtotal)}</td></tr>
                    <tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px;">Phí ship</td><td style="padding: 5px 0; font-size: 14px;">${formatCurrencyVnd(order.summary.shippingFee)}</td></tr>
                    <tr><td style="padding: 5px 0; color: ${BRAND.textMuted}; font-size: 13px;">Giảm giá</td><td style="padding: 5px 0; font-size: 14px;">−${formatCurrencyVnd(order.summary.discountAmount)}</td></tr>
                    ${couponRow}
                    <tr><td style="padding: 12px 0 0; font-weight: 800; font-size: 15px; border-top: 1px solid ${BRAND.border}; color: ${BRAND.ink};">Tổng thanh toán</td><td style="padding: 12px 0 0; font-weight: 800; font-size: 17px; border-top: 1px solid ${BRAND.border}; color: ${BRAND.primaryDeep};">${formatCurrencyVnd(order.summary.total)}</td></tr>
                  </table>
                </td></tr>
              </table>

              ${bankTransferBlock}
              ${demoNote}
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 32px; background-color: ${BRAND.cardBg}; border-top: 1px solid ${BRAND.border}; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: ${BRAND.textMuted};">© ${new Date().getFullYear()} Nutein · <a href="${siteUrl}" style="color: ${BRAND.textMuted};">nutein.vn</a></p>
              <p style="margin: 6px 0 0; font-size: 11px; color: ${BRAND.textMuted};">Đây là email tự động, vui lòng không phản hồi trực tiếp.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
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
