import type { AdminOrder } from "./types";

/**
 * Hàng đợi đối soát cho nhân viên (RFC-4).
 *
 * Mục tiêu: đơn cần người xử lý nổi lên trước. Thứ tự ưu tiên phản ánh đúng
 * mức khẩn của plan §Vòng đời chuyển khoản:
 *
 * 1. `overdue`  — đã qua `reviewDueAt`: đơn đang giữ kho/coupon quá SLA.
 * 2. `claimed`  — khách khai đã chuyển: cần đối chiếu sao kê, và đây là nhóm
 *                 dễ làm mất lòng khách nhất nếu để lâu.
 * 3. `review`   — đang chờ đối soát nhưng chưa quá hạn.
 *
 * Không nhóm nào ở đây được tự động hoá. Tất cả đều chờ NGƯỜI đối chiếu ngân
 * hàng — module này chỉ sắp xếp, không đổi trạng thái đơn nào.
 */

export type ReviewQueueBucket = "overdue" | "claimed" | "review" | "none";

const REVIEW_STATES_NEEDING_ACTION = new Set([
  "REVIEW_REQUIRED",
  "CANCEL_REQUESTED",
  "LATE_TRANSFER_REVIEW",
]);

export function reviewQueueBucket(
  order: Pick<
    AdminOrder,
    "paymentStatus" | "status" | "paymentReviewState" | "reviewDueAt"
  >,
  now: Date,
): ReviewQueueBucket {
  // Đơn đã trả tiền hoặc đã đóng thì không còn gì để đối soát.
  if (order.paymentStatus === "paid") return "none";
  if (order.status === "cancelled" || order.status === "returned")
    return "none";

  const state = order.paymentReviewState ?? null;

  const dueAt = order.reviewDueAt ? new Date(order.reviewDueAt) : null;
  const isOverdue =
    dueAt !== null &&
    !Number.isNaN(dueAt.getTime()) &&
    dueAt.getTime() <= now.getTime();

  if (isOverdue) return "overdue";
  if (state === "PAYMENT_CLAIMED") return "claimed";
  if (state && REVIEW_STATES_NEEDING_ACTION.has(state)) return "review";
  return "none";
}

const BUCKET_RANK: Record<ReviewQueueBucket, number> = {
  overdue: 0,
  claimed: 1,
  review: 2,
  none: 3,
};

export const REVIEW_QUEUE_BUCKET_LABEL: Record<
  Exclude<ReviewQueueBucket, "none">,
  string
> = {
  overdue: "Quá hạn đối soát",
  claimed: "Khách báo đã chuyển",
  review: "Chờ đối soát",
};

/** Sắp đơn cần đối soát lên đầu; trong cùng nhóm giữ nguyên thứ tự server. */
export function sortByReviewPriority(
  orders: AdminOrder[],
  now: Date,
): AdminOrder[] {
  return orders
    .map((order, index) => ({ order, index }))
    .sort((a, b) => {
      const rankDiff =
        BUCKET_RANK[reviewQueueBucket(a.order, now)] -
        BUCKET_RANK[reviewQueueBucket(b.order, now)];
      return rankDiff !== 0 ? rankDiff : a.index - b.index;
    })
    .map((entry) => entry.order);
}

/** Chỉ giữ đơn đang cần nhân viên xử lý. */
export function filterNeedsReview(
  orders: AdminOrder[],
  now: Date,
): AdminOrder[] {
  return orders.filter((order) => reviewQueueBucket(order, now) !== "none");
}
