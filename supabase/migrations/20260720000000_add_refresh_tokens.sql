-- ============================================
-- NUTEIN — Refresh Tokens (JWT riêng của app cho app/api/**, KHÔNG phải
-- session của Supabase Auth — xem features/auth/services/jwt.service.ts,
-- app/api/auth/{session,refresh,logout}/route.ts)
--
-- Access token (15p) KHÔNG lưu ở đây — ngắn hạn, không cần thu hồi riêng lẻ,
-- verify thuần bằng chữ ký (src/middlewares/authenticate.middlware.ts) để
-- không phải query DB mỗi request API. Refresh token (7 ngày) MỚI cần lưu,
-- vì đây là nơi duy nhất kiểm soát được việc thu hồi/logout thật sự và xoay
-- vòng (rotate) token để phát hiện refresh token bị đánh cắp dùng lại.
--
-- Chỉ lưu HASH (sha256) của token, không lưu token gốc — giống nguyên tắc
-- không lưu password thô, phòng trường hợp DB bị lộ.
--
-- Bảng chỉ được truy cập qua supabaseAdmin (service role, bypass RLS) từ
-- server — KHÔNG có policy nào cho anon/authenticated -> mặc định deny toàn
-- bộ truy cập trực tiếp từ client.
-- ============================================
CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
