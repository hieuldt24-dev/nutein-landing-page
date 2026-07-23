import "server-only";
import { PayOS } from "@payos/node";

const clientId = process.env.PAYOS_CLIENT_ID || "";
const apiKey = process.env.PAYOS_API_KEY || "";
const checksumKey = process.env.PAYOS_CHECKSUM_KEY || "";

/**
 * Client payOS — chỉ dùng server-side. Mirror lib/supabase.ts: `null` khi
 * chưa cấu hình PAYOS_* trong .env, để tránh crash khi khởi tạo.
 */
export const payos =
  clientId && apiKey && checksumKey
    ? new PayOS({ clientId, apiKey, checksumKey })
    : null;

/** Dùng build returnUrl/cancelUrl cho payment link. */
export const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
