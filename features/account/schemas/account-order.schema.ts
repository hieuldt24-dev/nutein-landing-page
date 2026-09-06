import { z } from "zod";

/**
 * Body cho hai hành động khách tự làm trên đơn của mình (RFC-3).
 *
 * `.strict()` ở cả hai: field lạ bị TỪ CHỐI thay vì bỏ qua im lặng, nên không
 * ai nhét thêm `paid: true`, `userId`, hay `expectedVersion` giả vào được.
 * Giới hạn độ dài cứng vì các chuỗi này đi thẳng vào `order_payment_events`
 * (append-only, không xoá được) — không để một field tự do làm phình bảng audit.
 */

/** V1 KHÔNG nhận upload file (plan §Public Contracts) — chỉ vài field text. */
export const paymentClaimSchema = z
  .object({
    /** Thời điểm khách nói là đã chuyển — chỉ là LỜI KHAI, không phải chứng cứ. */
    transferredAt: z.iso.datetime({ offset: true }).optional(),
    /** Số tiền khách khai đã chuyển (VND). */
    amount: z.number().int().positive().max(1_000_000_000).optional(),
    /** Nội dung/mã tham chiếu chuyển khoản khách tự ghi. */
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(300).optional(),
    /** Version đọc được lúc mở trang — lệch thì 409 thay vì ghi đè. */
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export type PaymentClaimInput = z.infer<typeof paymentClaimSchema>;

export const cancelOrderRequestSchema = z
  .object({
    reason: z.string().trim().max(300).optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export type CancelOrderRequestInput = z.infer<typeof cancelOrderRequestSchema>;
