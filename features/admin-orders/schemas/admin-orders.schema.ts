import { z } from "zod";

const ADMIN_ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export const adminOrderListQuerySchema = z.object({
  status: z.enum([...ADMIN_ORDER_STATUSES, "all"]).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const adminOrderStatusUpdateSchema = z.object({
  status: z.enum(ADMIN_ORDER_STATUSES),
  note: z
    .string()
    .trim()
    .max(500, "Ghi chú không được vượt quá 500 ký tự")
    .optional(),
});

/**
 * Kết luận đối soát thanh toán của staff (RFC-3).
 *
 * `no-transfer` là kết luận DUY NHẤT giải phóng kho/coupon/slot, nên nó bắt
 * buộc phải kèm bằng chứng nghiệp vụ: ai kiểm, kiểm cửa sổ sao kê nào, lý do.
 * `.strict()` chặn field lạ; `expectedVersion` bắt buộc để hai nhân viên mở
 * cùng một đơn không ghi đè kết luận của nhau (người thua nhận 409).
 *
 * KHÔNG có field nào nhận số tài khoản người gửi hay ảnh chuyển khoản — đó là
 * dữ liệu nhạy cảm và ảnh của khách KHÔNG phải chứng cứ ngân hàng
 * (plan §Vòng đời chuyển khoản).
 */
/**
 * Body TÙY CHỌN của `POST /api/staff/orders/[id]/confirm-payment` (RFC-4).
 * `.strict()` để không ai nhét thêm `paid`/`status` vào một route mà toàn bộ
 * quyết định phải do server đưa ra.
 */
export const confirmPaymentSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const resolvePaymentReviewSchema = z
  .object({
    outcome: z.enum(["no-transfer", "needs-investigation"]),
    /** Bắt buộc: kết luận không có lý do ghi lại thì không đối soát lại được. */
    reason: z
      .string()
      .trim()
      .min(1, "Phải ghi lý do kết luận")
      .max(500, "Lý do không được vượt quá 500 ký tự"),
    expectedVersion: z.number().int().nonnegative(),
    /** Cửa sổ sao kê đã kiểm — ngày ISO. */
    statementCheckedFrom: z.iso.datetime({ offset: true }).optional(),
    statementCheckedTo: z.iso.datetime({ offset: true }).optional(),
    /** Tham chiếu nghiệp vụ nội bộ (số ticket, mã đối soát). */
    reference: z.string().trim().max(120).optional(),
  })
  .strict();

export type ResolvePaymentReviewInput = z.infer<
  typeof resolvePaymentReviewSchema
>;
