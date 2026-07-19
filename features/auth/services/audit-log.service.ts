import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/src/logging/logger";

export type AuthAuditEvent = "LOGIN_SUCCESS" | "LOGOUT" | "TOKEN_REFRESH" | "TOKEN_REUSE_DETECTED";

export interface AuthAuditContext {
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** table_name cố định cho mọi dòng audit sự kiện auth — phân biệt với các dòng CRUD thật (table_name='products'/'orders'/...). */
const AUTH_TABLE_NAME = "auth_session";

/**
 * Ghi sự kiện auth (LOGIN_SUCCESS/LOGOUT/TOKEN_REFRESH/TOKEN_REUSE_DETECTED)
 * vào bảng `audit_log` có sẵn (migration 20260720010000_extend_audit_log_auth_events.sql
 * mở rộng thêm 4 giá trị action này + policy cho user tự xem log của mình).
 *
 * audit_log vốn thiết kế cho CRUD trigger (products/orders/coupons) —
 * record_id NOT NULL nên dùng chính `userId` làm record_id (sự kiện auth
 * không gắn với 1 row nghiệp vụ nào); không có cột user_agent riêng nên gộp
 * vào `new_data` cùng metadata.
 *
 * Best-effort có chủ đích: audit log là bản ghi bổ sung, KHÔNG phải cơ chế
 * bảo mật cốt lõi (khác refresh_tokens — mất bản ghi đó thì không revoke
 * được nữa). Lỗi ghi log không được chặn luồng đăng nhập/đăng xuất chính,
 * chỉ log lại qua Pino để còn dấu vết khi DB tạm thời lỗi.
 */
export const auditLogService = {
  async log(userId: string, event: AuthAuditEvent, context: AuthAuditContext = {}): Promise<void> {
    if (!supabaseAdmin) return;

    const newData: Record<string, unknown> = { ...context.metadata };
    if (context.userAgent) newData.userAgent = context.userAgent;

    const { error } = await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      action: event,
      table_name: AUTH_TABLE_NAME,
      record_id: userId,
      new_data: Object.keys(newData).length > 0 ? newData : null,
      ip_address: context.ip ?? null,
    });

    if (error) {
      logger.error({ err: error, userId, event }, "Không thể ghi auth audit log");
    }
  },
};
