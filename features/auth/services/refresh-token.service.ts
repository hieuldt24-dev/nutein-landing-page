import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

/** SHA-256 hex — không lưu token gốc trong DB, chỉ lưu hash để đối chiếu. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * Lưu/thu hồi refresh token trong bảng `refresh_tokens` (migration
 * 20260720000000_add_refresh_tokens.sql) — cho phép app/api/auth/logout vô
 * hiệu hoá token thật sự ở server (không chỉ xoá cookie), và rotate token ở
 * mỗi lần app/api/auth/refresh để phát hiện refresh token bị đánh cắp dùng
 * lại (reuse detection). Luôn dùng supabaseAdmin (service role) — bảng này
 * không có RLS policy cho anon/authenticated truy cập trực tiếp.
 */
export const refreshTokenService = {
  async store(userId: string, token: string, expiresAt: Date): Promise<void> {
    const { error } = await requireAdminClient().from("refresh_tokens").insert({
      user_id: userId,
      token_hash: hashRefreshToken(token),
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      throw new Error(`Không thể lưu refresh token: ${error.message}`);
    }
  },

  /** true nếu token còn tồn tại trong DB, chưa bị thu hồi, và chưa hết hạn. */
  async isActive(token: string): Promise<boolean> {
    const { data } = await requireAdminClient()
      .from("refresh_tokens")
      .select("revoked_at, expires_at")
      .eq("token_hash", hashRefreshToken(token))
      .maybeSingle();

    if (!data || data.revoked_at) return false;
    return new Date(data.expires_at).getTime() > Date.now();
  },

  async revoke(token: string): Promise<void> {
    const { error } = await requireAdminClient()
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashRefreshToken(token));
    if (error) {
      throw new Error(`Không thể thu hồi refresh token: ${error.message}`);
    }
  },

  /**
   * Thu hồi TOÀN BỘ refresh token còn hiệu lực của 1 user (không chỉ token
   * đang được trình ra) — dùng khi admin khóa tài khoản (is_deleted = true)
   * để mọi phiên đang mở của user đó mất hiệu lực ngay lập tức.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const { error } = await requireAdminClient()
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (error) {
      throw new Error(`Không thể thu hồi toàn bộ refresh token của user: ${error.message}`);
    }
  },

  /** Thu hồi token cũ + lưu token mới trong 1 bước — dùng khi rotate lúc refresh. */
  async rotate(userId: string, oldToken: string, newToken: string, expiresAt: Date): Promise<void> {
    await this.revoke(oldToken);
    await this.store(userId, newToken, expiresAt);
  },
};
