import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { assertTrustedOrigin } from "@/src/security/csrf";
import { accountOrderService } from "@/features/account/services/account-order.service";
import { orderRepository } from "@/features/checkout/services/order.repository";
import { paymentClaimSchema } from "@/features/account/schemas/account-order.schema";
import { isCheckoutEnforcementEnabled } from "@/features/checkout/constants";
import { readOptionalJsonBody } from "@/src/api/read-json-body";

/**
 * POST /api/account/orders/[id]/payment-claim
 *
 * Khách khai "tôi đã chuyển khoản". Đây CHỈ là lời khai:
 * KHÔNG đặt PAID, KHÔNG gia hạn hạn thanh toán, KHÔNG trả lại slot giữ chỗ.
 * Ba bất biến đó được cưỡng chế trong RPC `checkout_transition_order_state`
 * (migration §6.3, nhánh `claim_payment`) — route này chỉ là lớp HTTP mỏng làm
 * xác thực + kiểm chủ sở hữu, và cố ý KHÔNG chứa logic trạng thái nào để không
 * có đường thứ hai làm suy yếu ba bất biến trên.
 *
 * Một claim cho mỗi đơn: claim lần hai bị RPC từ chối bằng `NTSTA` -> 409.
 */
export const POST = withErrorHandler<{ id: string }>(
  async (req: NextRequest, { params }) => {
    assertTrustedOrigin(req, {
      enforce: isCheckoutEnforcementEnabled(),
      route: "POST /api/account/orders/[id]/payment-claim",
    });

    const user = await authenticate(req);
    const { id } = await params;

    const body = paymentClaimSchema.parse(await readOptionalJsonBody(req));

    // Kiểm chủ sở hữu TRƯỚC khi gọi RPC: RPC không biết ai đang gọi, nó chỉ
    // khoá đơn theo id. Không có bước này thì bất kỳ ai đăng nhập cũng claim
    // được đơn của người khác. Đơn của người khác -> 404.
    await accountOrderService.getOwnedOrderDetail(user.userId, id);

    const result = await orderRepository.transition({
      orderId: id,
      action: "claim_payment",
      actorId: user.userId,
      actorType: "CUSTOMER",
      expectedVersion: body.expectedVersion ?? null,
      reason: body.note ?? null,
      // Metadata lời khai — đi vào `order_payment_events.reference` (append-only).
      // KHÔNG lưu số tài khoản người gửi hay ảnh chụp (plan §Security).
      reference: {
        claimed_transferred_at: body.transferredAt ?? null,
        claimed_amount: body.amount ?? null,
        claimed_reference: body.reference ?? null,
        source: "customer_claim",
      },
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
