import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/src/logging/logger";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

const auditLogger = logger.child({ service: "auditLogRepository" });

/**
 * Ghi `audit_log` tường minh với `user_id` thật — thay cho 3 trigger DB cũ
 * (`trg_audit_products/orders/coupons`) vốn dựa `auth.uid()`. `auth.uid()`
 * luôn NULL vì app ghi qua Supabase service-role key (không đi qua session
 * Supabase Auth nào) — JWT app tự ký hoàn toàn tách biệt. Mỗi
 * repository/route đã biết sẵn `userId` thật từ `authenticate()`, nên gọi
 * thẳng hàm này ngay sau khi ghi thành công thay vì trông chờ trigger.
 *
 * Best-effort: lỗi ghi audit KHÔNG được chặn nghiệp vụ chính — chỉ log
 * warn rồi bỏ qua, giống pattern `orderEmailService`.
 */
async function record(entry: {
  userId: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}): Promise<void> {
  if (!supabaseAdmin) return;

  const { error } = await supabaseAdmin.from("audit_log").insert({
    user_id: entry.userId,
    action: entry.action,
    table_name: entry.tableName,
    record_id: entry.recordId,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
  });

  if (error) {
    auditLogger.warn(
      { err: error, tableName: entry.tableName, recordId: entry.recordId },
      "Ghi audit log thất bại (best-effort, bỏ qua)",
    );
  }
}

export const auditLogRepository = {
  record,
};
