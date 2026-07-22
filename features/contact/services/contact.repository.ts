import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { InternalServerError } from "@/src/errors/app.error";
import { CONTACT_SUBJECTS } from "../constants";
import type { ContactFormData } from "../types";

interface ContactMessageRow {
  id: string;
  created_at: string;
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/** Bảng chưa có cột `subject` — gộp vào `message` tạm thời. */
function buildStoredMessage(data: ContactFormData): string {
  const subjectLabel =
    CONTACT_SUBJECTS.find((s) => s.value === data.subject)?.label ?? data.subject;
  return `[Chủ đề: ${subjectLabel}]\n\n${data.message}`;
}

/**
 * Persist form liên hệ → `contact_messages`.
 * Dùng service role (cùng pattern address/profile); RLS cũng cho INSERT anon.
 */
export const contactRepository = {
  async create(data: ContactFormData): Promise<ContactMessageRow> {
    const { data: row, error } = await requireAdminClient()
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        message: buildStoredMessage(data),
      })
      .select("id, created_at")
      .single();

    if (error || !row) {
      throw new InternalServerError(
        "Không lưu được tin nhắn liên hệ",
        error?.message,
      );
    }

    return row;
  },
};
