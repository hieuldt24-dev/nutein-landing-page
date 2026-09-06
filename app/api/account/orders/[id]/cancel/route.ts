import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { assertTrustedOrigin } from "@/src/security/csrf";
import { accountOrderService } from "@/features/account/services/account-order.service";
import { orderRepository } from "@/features/checkout/services/order.repository";
import { cancelOrderRequestSchema } from "@/features/account/schemas/account-order.schema";
import { isCheckoutEnforcementEnabled } from "@/features/checkout/constants";
import { readOptionalJsonBody } from "@/src/api/read-json-body";

/**
 * POST /api/account/orders/[id]/cancel
 *
 * TẠO YÊU CẦU HỦY — không phải đã hủy. Đơn chuyển sang `CANCEL_REQUESTED`;
 * kho, coupon và slot CHỈ được trả lại khi staff đối soát sao kê và kết luận
 * chưa nhận tiền (`resolve-payment-review`). Đặt tên response theo đúng nghĩa
 * đó để UI không hứa với khách rằng hàng đã được hoàn.
 *
 * Idempotent khi bấm lại: đơn đã ở `CANCEL_REQUESTED` (hoặc đã bị hủy) trả về
 * trạng thái hiện tại với `changed: false` thay vì ghi thêm một event và tăng
 * `state_version` mỗi lần bấm.
 */
export const POST = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    assertTrustedOrigin(req, {
      enforce: isCheckoutEnforcementEnabled(),
      route: "POST /api/account/orders/[id]/cancel",
    });

    const user = await authenticate(req);
    const { id } = await params;
    const body = cancelOrderRequestSchema.parse(
      await readOptionalJsonBody(req),
    );

    // Chủ sở hữu + trạng thái hiện tại trong một lần đọc. Đơn của người khác -> 404.
    const current = await accountOrderService.getOwnedOrderDetail(
      user.userId,
      id,
    );

    const alreadyRequested = current.reviewState === "CANCEL_REQUESTED";
    const alreadyClosed =
      current.status === "cancelled" && current.paymentStatus !== "PAID";
    if (alreadyRequested || alreadyClosed) {
      return successResponse({
        orderId: current.id,
        changed: false,
        reviewState: current.reviewState,
        stateVersion: current.stateVersion,
        paymentStatus: current.paymentStatus,
      });
    }

    const result = await orderRepository.transition({
      orderId: id,
      action: "request_cancel",
      actorId: user.userId,
      actorType: "CUSTOMER",
      expectedVersion: body.expectedVersion ?? null,
      reason: body.reason ?? "Khách yêu cầu hủy đơn",
      reference: { source: "customer_cancel_request" },
    });

    return successResponse({
      orderId: result.orderId,
      changed: result.changed,
      reviewState: result.reviewState,
      stateVersion: result.stateVersion,
      paymentStatus: result.paymentStatus,
    });
  },
);
