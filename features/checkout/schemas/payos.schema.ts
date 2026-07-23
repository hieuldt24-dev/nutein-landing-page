import { z } from "zod";

/**
 * Chỉ chặn payload rác ở tầng route (400) — KHÔNG dùng kết quả `.parse()` để
 * gọi `payos.webhooks.verify()`. Zod strip field lạ trong `data`, mà
 * `verify()` tính lại HMAC trên toàn bộ object gốc → sai signature nếu bị
 * strip. Luôn truyền `body` gốc (chưa qua schema này) vào `verify()`.
 */
export const payosWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  signature: z.string().min(1, "Thiếu signature"),
  data: z.record(z.string(), z.unknown()),
});

export const payosStatusQuerySchema = z.object({
  orderCode: z.string().trim().min(1, "Thiếu orderCode"),
});

export const payosRetryRequestSchema = z.object({
  orderCode: z.string().trim().min(1, "Thiếu orderCode"),
});
