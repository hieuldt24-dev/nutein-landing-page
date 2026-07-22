import "server-only";

import { ConflictError, NotFoundError } from "@/src/errors/app.error";
import { supabaseAdmin } from "@/lib/supabase";
import type { UpdateProfileInput } from "../schemas/profile.schema";
import type { AccountProfile } from "../types";

interface UserRow {
  email: string;
  name: string | null;
  phone: string | null;
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function toProfile(row: UserRow): AccountProfile {
  return {
    email: row.email.trim().toLowerCase(),
    fullName: row.name?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
  };
}

/**
 * Hồ sơ `public.users` — service role + scope theo userId từ JWT app
 * (cùng pattern address.repository).
 */
export const profileRepository = {
  async get(userId: string): Promise<AccountProfile> {
    const { data, error } = await requireAdminClient()
      .from("users")
      .select("email, name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Không tải được hồ sơ: ${error.message}`);
    }
    if (!data) throw new NotFoundError("Hồ sơ");
    return toProfile(data as UserRow);
  },

  async update(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<AccountProfile> {
    const { data, error } = await requireAdminClient()
      .from("users")
      .update({
        name: input.fullName.trim(),
        phone: input.phone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("email, name, phone")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictError(
          "Số điện thoại đã được dùng bởi tài khoản khác",
          "PHONE_TAKEN",
        );
      }
      throw new Error(`Không cập nhật được hồ sơ: ${error.message}`);
    }
    return toProfile(data as UserRow);
  },
};
