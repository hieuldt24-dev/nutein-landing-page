import "server-only";

import type { Webhook } from "@payos/node";
import { payos, appBaseUrl } from "@/lib/payos";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";
import { orderRepository } from "./order.repository";

function requirePayosClient() {
  if (!payos) {
    throw new InternalServerError(
      "Thiếu PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY — kiểm tra lại file .env",
    );
  }
  return payos;
}

function buildReturnUrl(orderCode: string): string {
  return `${appBaseUrl}/checkout/success?orderCode=${encodeURIComponent(orderCode)}`;
}

export interface CreatePaymentLinkInput {
  /** order_code dạng chuỗi (NT-...) — dùng làm description + return/cancel URL. */
  orderCode: string;
  amount: number;
  buyer: { fullName: string; email: string; phone: string };
}

export interface CreatePaymentLinkResult {
  checkoutUrl: string;
  payosOrderCode: number;
  payosPaymentLinkId: string;
}

const serviceLogger = logger.child({ service: "payosService" });

export const payosService = {
  async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatePaymentLinkResult> {
    const client = requirePayosClient();
    // Date.now() — mirror convention payOS tự dùng ở SDK .NET chính chủ
    // (Unix ms timestamp). Trùng millisecond giữa 2 instance là cực hiếm và
    // fail-safe: payOS trả lỗi "đơn đã tồn tại" → BadRequestError, user đặt
    // lại — không có rủi ro ghi đè/sai dữ liệu.
    const payosOrderCode = Date.now();
    try {
      const link = await client.paymentRequests.create({
        orderCode: payosOrderCode,
        amount: Math.round(input.amount),
        description: input.orderCode.slice(0, 25),
        cancelUrl: buildReturnUrl(input.orderCode),
        returnUrl: buildReturnUrl(input.orderCode),
        buyerName: input.buyer.fullName,
        buyerEmail: input.buyer.email,
        buyerPhone: input.buyer.phone,
      });
      return {
        checkoutUrl: link.checkoutUrl,
        payosOrderCode: link.orderCode,
        payosPaymentLinkId: link.paymentLinkId,
      };
    } catch (err) {
      serviceLogger.error(
        { err, orderCode: input.orderCode },
        "payOS createPaymentLink thất bại",
      );
      throw new BadRequestError("Không tạo được link thanh toán — vui lòng thử lại.");
    }
  },

  /** Best-effort — gọi khi DB insert thất bại SAU khi payOS đã tạo link. Không throw. */
  async cancelPaymentLink(payosOrderCode: number, reason: string): Promise<void> {
    try {
      await requirePayosClient().paymentRequests.cancel(payosOrderCode, reason);
    } catch (err) {
      serviceLogger.warn(
        { err, payosOrderCode },
        "payOS cancelPaymentLink thất bại (best-effort, bỏ qua)",
      );
    }
  },

  /**
   * Trang /checkout/success gọi khi quay lại từ payOS — chủ động đối soát
   * nếu DB còn UNPAID (bù cho webhook trễ/không bắn được ở local dev, do
   * payOS yêu cầu webhook URL public HTTPS).
   */
  async reconcileByPayosOrderCode(
    payosOrderCode: number,
  ): Promise<{ paymentStatus: "PAID" | "UNPAID" }> {
    const link = await requirePayosClient().paymentRequests.get(payosOrderCode);
    if (link.status === "PAID") {
      await orderRepository.markPaidByPayosOrderCode(payosOrderCode);
      return { paymentStatus: "PAID" };
    }
    return { paymentStatus: "UNPAID" };
  },

  /**
   * payOS gọi server-to-server — auth = signature (checksumKey), không
   * cookie/JWT. Idempotent: gọi lại nhiều lần cùng payload không gây lỗi
   * hay side-effect kép (xem orderRepository.markPaidByPayosOrderCode).
   */
  async handleWebhook(rawBody: unknown): Promise<void> {
    const client = requirePayosClient();
    let verified;
    try {
      verified = await client.webhooks.verify(rawBody as Webhook);
    } catch {
      throw new UnauthorizedError("Webhook payOS không hợp lệ (sai signature)");
    }

    if (verified.code !== "00") {
      // TODO: xác nhận với payOS sandbox — có mã lỗi nào cần map sang
      // payment_status = 'FAILED' không. Hiện chưa chắc semantics nên chỉ log.
      serviceLogger.warn(
        { orderCode: verified.orderCode, code: verified.code },
        "payOS webhook: không phải giao dịch thành công — bỏ qua",
      );
      return;
    }

    const updated = await orderRepository.markPaidByPayosOrderCode(verified.orderCode);
    if (!updated) {
      serviceLogger.warn(
        { orderCode: verified.orderCode },
        "payOS webhook: không tìm thấy đơn hoặc đã PAID trước đó (idempotent no-op)",
      );
    }
  },
};
