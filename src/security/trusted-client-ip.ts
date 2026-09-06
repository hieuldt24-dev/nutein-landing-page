import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Lấy IP khách từ ĐÚNG header mà ingress đã ghi đè, rồi HMAC trước khi dùng.
 *
 * Vì sao không dùng lại cách của `src/middlewares/rate-limit.middleware.ts`:
 * ở đó IP được đọc bằng chuỗi fallback `x-real-ip` -> hop ĐẦU của
 * `x-forwarded-for`. Hop đầu là giá trị client tự gửi được, nên bất kỳ ai cũng
 * đặt được `X-Forwarded-For: <ip bịa>` và nhảy sang bucket khác sau mỗi request.
 * Điều đó chấp nhận được với limiter fail-open hiện hữu, KHÔNG chấp nhận được
 * với limiter checkout.
 *
 * Quy tắc ở đây (plan §Security — "Spoof x-forwarded-for"):
 * - Chỉ TIN header khi `TRUSTED_CLIENT_IP_HEADER` được cấu hình rõ ràng. Biến
 *   này là lời khẳng định của người vận hành rằng ingress GHI ĐÈ header đó.
 *   Chưa cấu hình -> `trusted: false`, IP là tín hiệu MỀM, không phải danh tính.
 * - Với header dạng danh sách (`x-forwarded-for`), lấy hop CUỐI — hop do proxy
 *   gần ta nhất ghi thêm. Hop đầu do client kiểm soát.
 * - Không bao giờ log/lưu IP thô: chỉ HMAC (plan §Security — "Leaking sensitive
 *   metadata"). IP đã hash vẫn là định danh gián tiếp, KHÔNG phải ẩn danh.
 *
 * Known-gap (RFC-1): hành vi ghi đè header của ingress thật CHƯA được probe.
 * Tới khi probe xong, `trusted: false` là mặc định đúng.
 */

/** Cắt IPv6 về /64 — một khách IPv6 thường được cấp cả /64, nên bucket theo địa chỉ đầy đủ là vô dụng và làm phình cardinality. */
const IPV6_PREFIX_GROUPS = 4;

export interface TrustedClientIp {
  /** IP đã canonical hoá. `null` khi không đọc được. */
  ip: string | null;
  /** `true` chỉ khi header nguồn được người vận hành khai báo là do ingress ghi đè. */
  trusted: boolean;
  /** Tên header đã dùng — để log chẩn đoán (không kèm giá trị). */
  headerName: string;
}

function stripPort(value: string): string {
  const trimmed = value.trim();
  // IPv6 có ngoặc vuông: "[::1]:443"
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed.slice(1) : trimmed.slice(1, end);
  }
  // IPv4 kèm port: "1.2.3.4:5678". IPv6 trần chứa nhiều ":" — không cắt.
  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    return trimmed.slice(0, trimmed.indexOf(":"));
  }
  return trimmed;
}

/**
 * Chuẩn hoá để cùng một khách không rơi vào hai bucket khác nhau chỉ vì viết
 * hoa/thường, có port, hay dùng dạng IPv4-mapped.
 */
export function canonicalizeIp(raw: string): string | null {
  const value = stripPort(raw).toLowerCase();
  if (!value) return null;

  // IPv4-mapped IPv6 ("::ffff:1.2.3.4") là CÙNG một khách với "1.2.3.4".
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];

  if (value.includes(":")) {
    const groups = value.split(":");
    const prefix = groups.slice(0, IPV6_PREFIX_GROUPS).join(":");
    return `${prefix}::/64`;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return value;
  return null;
}

export function resolveTrustedClientIp(req: NextRequest): TrustedClientIp {
  const configured = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  const headerName = configured || "x-forwarded-for";
  const raw = req.headers.get(headerName);
  if (!raw) {
    return { ip: null, trusted: Boolean(configured), headerName };
  }

  const hops = raw
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  if (hops.length === 0) {
    return { ip: null, trusted: Boolean(configured), headerName };
  }

  // Hop CUỐI = hop do proxy gần ta nhất ghi. Hop đầu do client gửi.
  const candidate = hops[hops.length - 1];
  return {
    ip: canonicalizeIp(candidate),
    trusted: Boolean(configured),
    headerName,
  };
}

/**
 * HMAC-SHA256 IP bằng secret server-side.
 *
 * Trả `null` khi thiếu `CLIENT_IP_HASH_SECRET` — bên gọi quyết định fail-closed
 * hay bỏ qua. KHÔNG fallback sang hash không khoá: SHA256 trần của một IP là
 * đảo ngược được bằng brute force toàn bộ không gian IPv4 trong vài phút.
 */
export function hashClientIp(ip: string): string | null {
  const secret = process.env.CLIENT_IP_HASH_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** Tiện ích gộp: đọc + canonical hoá + hash. Không có nhánh nào trả IP thô. */
export function resolveHashedClientIp(req: NextRequest): {
  ipHash: string | null;
  trusted: boolean;
  headerName: string;
} {
  const { ip, trusted, headerName } = resolveTrustedClientIp(req);
  return {
    ipHash: ip ? hashClientIp(ip) : null,
    trusted,
    headerName,
  };
}
