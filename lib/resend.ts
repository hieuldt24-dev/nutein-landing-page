import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY || "";

/**
 * Client Resend — chỉ dùng server-side. Mirror lib/payos.ts: `null` khi
 * chưa cấu hình RESEND_API_KEY trong .env, để tránh crash khi khởi tạo.
 */
export const resend = apiKey ? new Resend(apiKey) : null;

/** Sender mặc định — "onboarding@resend.dev" hoạt động ngay không cần verify domain (demo). */
export const ORDER_EMAIL_FROM =
  process.env.ORDER_EMAIL_FROM || "Nutein <onboarding@resend.dev>";
