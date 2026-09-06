import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import {
  authenticate,
  requireRole,
} from "@/src/middlewares/authenticate.middlware";
import { assertTrustedOrigin } from "@/src/security/csrf";
import { orderRepository } from "@/features/checkout/services/order.repository";
import { resolvePaymentReviewSchema } from "@/features/admin-orders/schemas/admin-orders.schema";
import { isCheckoutEnforcementEnabled } from "@/features/checkout/constants";

/**
 * POST /api/staff/orders/[id]/resolve-payment-review
 *
 * Staff kết luận một đơn đang chờ đối soát:
 * - `no-transfer`        -> đã kiểm sao kê và CHƯA nhận tiền: hủy đơn + trả
 *                           kho/coupon/slot, atomically trong RPC.
 * - `needs-investigation` -> chưa kết luận được: giữ nguyên tài nguyên, đơn ở
 *                           lại hàng đợi `REVIEW_REQUIRED`. KHÔNG trả kho.
 *
 * Đây là đường DUY NHẤT giải phóng tài nguyên của một đơn chưa thanh toán.
 * Không có nhánh nào ở đây đặt PAID — xác nhận đã nhận tiền là
 * `confirm-payment`, một hành động khác với bằng chứng khác.
 */
export const POST = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    assertTrustedOrigin(req, {
      enforce: isCheckoutEnforcementEnabled(),
      route: "POST /api/staff/orders/[id]/resolve-payment-review",
    });

    const user = await authenticate(req);
    requireRole(user, "STAFF");

    const { id } = await params;
    const body = resolvePaymentReviewSchema.parse(await req.json());

    const result = await orderRepository.transition({
      orderId: id,
      action:
        body.outcome === "no-transfer"
          ? "resolve_no_transfer"
          : "mark_review_required",
      actorId: user.userId,
      actorType: "STAFF",
      expectedVersion: body.expectedVersion,
      reason: body.reason,
      // Metadata đối soát -> `order_payment_events.reference` (append-only).
      reference: {
        outcome: body.outcome,
        checked_by: user.userId,
        statement_checked_from: body.statementCheckedFrom ?? null,
        statement_checked_to: body.statementCheckedTo ?? null,
        business_reference: body.reference ?? null,
      },
    });

    return successResponse({
      orderId: result.orderId,
      changed: result.changed,
      status: result.status,
      paymentStatus: result.paymentStatus,
      reviewState: result.reviewState,
      stateVersion: result.stateVersion,
    });
  },
);
