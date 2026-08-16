import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import type {
  AdminAuditAction,
  AdminAuditEntry,
  AdminAuditListQuery,
  AdminAuditListResult,
} from "../types";

interface AuditLogRow {
  id: string;
  action: AdminAuditAction;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  actor: { email: string } | null;
}

const AUDIT_SELECT =
  "id, action, table_name, record_id, old_data, new_data, created_at, actor:users(email)";

/** Field không mang ý nghĩa nghiệp vụ — bỏ khi phát hiện field nào đổi. */
const IGNORED_DIFF_KEYS = new Set(["updated_at", "created_at"]);

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function changedKeys(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string[] {
  if (!oldData || !newData) return [];
  return Object.keys(newData).filter(
    (key) =>
      !IGNORED_DIFF_KEYS.has(key) &&
      JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
  );
}

/**
 * Suy ra mô tả ngắn từ action/table/diff — audit_log chỉ có snapshot đầy đủ
 * (old_data/new_data), không có sẵn câu mô tả như mock cũ. Đặc cách riêng
 * cho đổi status đơn hàng (thao tác phổ biến nhất) để câu chữ tự nhiên
 * hơn, còn lại dùng công thức chung theo tên bảng + field đổi.
 */
function summarize(row: AuditLogRow): string {
  if (row.action === "DELETE") {
    return `Xóa bản ghi trong ${row.table_name}`;
  }
  if (row.action === "CREATE") {
    return `Tạo mới trong ${row.table_name}`;
  }

  const changed = changedKeys(row.old_data, row.new_data);
  if (row.table_name === "orders" && changed.includes("status")) {
    return `Đổi trạng thái đơn → ${String(row.new_data?.status ?? "").toLowerCase()}`;
  }
  if (changed.length === 0) {
    return `Cập nhật ${row.table_name}`;
  }
  const shown = changed.slice(0, 3).join(", ");
  return `Cập nhật ${row.table_name}: ${shown}${changed.length > 3 ? "…" : ""}`;
}

function toAdminAuditEntry(row: AuditLogRow): AdminAuditEntry {
  return {
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    actorEmail: row.actor?.email ?? null,
    summary: summarize(row),
    createdAt: row.created_at,
  };
}

async function list(query: AdminAuditListQuery = {}): Promise<AdminAuditListResult> {
  const client = requireAdminClient();
  let builder = client.from("audit_log").select(AUDIT_SELECT, { count: "exact" });

  if (query.action && query.action !== "all") {
    builder = builder.eq("action", query.action);
  }
  if (query.from) {
    builder = builder.gte("created_at", new Date(query.from).toISOString());
  }
  if (query.to) {
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
    builder = builder.lte("created_at", to.toISOString());
  }

  const pageSize = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Không tải được audit log: ${error.message}`);
  }

  let items = ((data as unknown as AuditLogRow[]) ?? []).map(toAdminAuditEntry);

  // actorEmail thường null (xem ghi chú ở types) — filter theo actor tạm
  // thời sẽ không match gì; giữ lại tham số để API không đổi khi actor
  // tracking được bổ sung sau này.
  const actor = query.actor?.trim().toLowerCase();
  if (actor) {
    items = items.filter((r) => r.actorEmail?.toLowerCase().includes(actor));
  }

  return {
    items,
    total: count ?? items.length,
  };
}

export const adminAuditRepository = {
  list,
};
