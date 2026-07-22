import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import {
  MAX_CART_QUANTITY,
  MIN_CART_QUANTITY,
} from "@/features/cart/constants";
import {
  applyCartSessionCookie,
  resolveCartActor,
} from "@/features/cart/services/cart-session.server";
import { cartServerService } from "@/features/cart/services/cart.server.service";

const cartLineSchema = z.object({
  variantId: z.string().trim().min(1),
  quantity: z
    .number()
    .int()
    .min(MIN_CART_QUANTITY + 1)
    .max(MAX_CART_QUANTITY),
});

const cartStateSchema = z.object({
  lines: z.array(cartLineSchema).max(10),
});

/** GET /api/cart — guest (session) hoặc logged-in (merge Joy Rush rồi trả user cart). */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const actor = resolveCartActor(req);

  const summary = actor.userId
    ? await cartServerService.mergeOnLogin(actor.userId, actor.sessionId)
    : await cartServerService.getSummary({
        kind: "session",
        sessionId: actor.sessionId,
      });

  const response = successResponse(summary);
  if (actor.isNewSession) {
    applyCartSessionCookie(response, actor.sessionId);
  }
  return response;
});

/** PUT /api/cart — ghi đè `lines` (guest → session; logged-in → user + mirror session). */
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const actor = resolveCartActor(req);
  const body = await req.json();
  const state = cartStateSchema.parse(body);

  const summary = actor.userId
    ? await cartServerService.setStateForLoggedIn(
        actor.userId,
        actor.sessionId,
        state,
      )
    : await cartServerService.setState(
        { kind: "session", sessionId: actor.sessionId },
        state,
      );

  const response = successResponse(summary);
  if (actor.isNewSession) {
    applyCartSessionCookie(response, actor.sessionId);
  }
  return response;
});
