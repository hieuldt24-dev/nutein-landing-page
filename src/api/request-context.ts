import type { NextRequest } from "next/server";

/** IP client thật sau reverse proxy (Vercel/Nginx) — ưu tiên header x-forwarded-for. */
export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export function getUserAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}
