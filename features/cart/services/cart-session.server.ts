import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE_OPTIONS,
} from "@/features/auth/constants";
import { jwtService } from "@/features/auth/services/jwt.service";
import {
  CART_SESSION_COOKIE,
  CART_SESSION_MAX_AGE_SEC,
} from "@/features/cart/constants";

export type CartActor = {
  /** JWT hợp lệ → userId; token thiếu/hỏng → null (guest). */
  userId: string | null;
  sessionId: string;
  /** true nếu vừa mint cookie session mới — cần Set-Cookie trên response. */
  isNewSession: boolean;
};

/**
 * Resolve identity cho `/api/cart`:
 * - Luôn có `sessionId` (cookie hoặc UUID mới)
 * - `userId` chỉ khi access JWT verify OK (không throw 401)
 */
export function resolveCartActor(req: NextRequest): CartActor {
  let userId: string | null = null;
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) {
    try {
      userId = jwtService.verifyAccessToken(token).sub;
    } catch {
      userId = null;
    }
  }

  const existing = req.cookies.get(CART_SESSION_COOKIE)?.value;
  const isValidUuid =
    typeof existing === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existing,
    );

  if (isValidUuid) {
    return { userId, sessionId: existing, isNewSession: false };
  }

  return { userId, sessionId: randomUUID(), isNewSession: true };
}

export function applyCartSessionCookie(
  response: NextResponse,
  sessionId: string,
): void {
  response.cookies.set(CART_SESSION_COOKIE, sessionId, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: CART_SESSION_MAX_AGE_SEC,
  });
}
