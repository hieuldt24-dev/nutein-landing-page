import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { NotFoundError } from "@/src/errors/app.error";
import type {
  AdminContactListQuery,
  AdminContactListResult,
  AdminContactMessage,
} from "../types";

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  is_read: boolean;
  handled_by: string | null;
  internal_note: string | null;
  created_at: string;
}

const MESSAGE_SELECT =
  "id, name, email, phone, message, is_read, handled_by, internal_note, created_at";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/** "Đã xử lý" = có người phụ trách (handled_by) — không cần cột boolean riêng. */
function toAdminContactMessage(row: ContactMessageRow): AdminContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    message: row.message,
    isRead: row.is_read,
    isHandled: row.handled_by !== null,
    internalNote: row.internal_note ?? undefined,
    createdAt: row.created_at,
  };
}

async function list(query: AdminContactListQuery = {}): Promise<AdminContactListResult> {
  const client = requireAdminClient();
  const filter = query.filter ?? "all";
  let builder = client
    .from("contact_messages")
    .select(MESSAGE_SELECT, { count: "exact" });

  if (filter === "unread") builder = builder.eq("is_read", false);
  if (filter === "open") builder = builder.is("handled_by", null);
  if (filter === "handled") builder = builder.not("handled_by", "is", null);

  const pageSize = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Không tải được danh sách tin nhắn: ${error.message}`);
  }

  const items = ((data as ContactMessageRow[]) ?? []).map(toAdminContactMessage);
  return { items, total: count ?? items.length };
}

async function getById(id: string): Promise<AdminContactMessage | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tải được tin nhắn: ${error.message}`);
  }
  return data ? toAdminContactMessage(data as ContactMessageRow) : null;
}

/**
 * `isHandled: true` -> gán `handled_by = staffUserId` (ai xử lý); `false`
 * -> gỡ `handled_by` (mở lại). `staffUserId` chỉ bắt buộc khi patch có
 * `isHandled`.
 */
async function update(
  id: string,
  patch: { isRead?: boolean; isHandled?: boolean; internalNote?: string },
  staffUserId?: string,
): Promise<AdminContactMessage> {
  const client = requireAdminClient();
  const payload: Record<string, unknown> = {};
  if (patch.isRead !== undefined) payload.is_read = patch.isRead;
  if (patch.internalNote !== undefined) payload.internal_note = patch.internalNote || null;
  if (patch.isHandled !== undefined) {
    payload.handled_by = patch.isHandled ? staffUserId ?? null : null;
  }

  const { data, error } = await client
    .from("contact_messages")
    .update(payload)
    .eq("id", id)
    .select(MESSAGE_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Không cập nhật được tin nhắn: ${error.message}`);
  }
  if (!data) {
    throw new NotFoundError("Tin nhắn");
  }
  return toAdminContactMessage(data as ContactMessageRow);
}

export const adminContactRepository = {
  list,
  getById,
  update,
};
