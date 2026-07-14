import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import * as appError from "@/src/errors/app.error";
import { logger } from "@/src/logging/logger";

export const handleError = (err: unknown, requestUrl?: string) => {
  // Log error details
  logger.error({ err }, `Error on request ${requestUrl || ""}`);

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "Dữ liệu không hợp lệ",
        error: {
          code: "VALIDATION_ERROR",
          details: err.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  if (err instanceof appError.AppError) {
    return NextResponse.json(
      {
        success: false,
        message: err.message,
        error: {
          code: err.code,
          details: err.details || [],
        },
      },
      { status: err.statusCode },
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: "Có lỗi xảy ra hệ thống",
      error: {
        code: "INTERNAL_ERROR",
        details: [],
      },
    },
    { status: 500 },
  );
};

import { createSupabaseServerClient } from "@/lib/supabase-server";

export function withAuthErrorHandler(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error(`Auth error on ${request.url}:`, error);

      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
      } catch {
        // Ignore sign out errors
      }

      const authErrorMessages = new Set([
        "domain_not_allowed",
        "user_not_invited",
        "user_deactivated",
      ]);
      const errorMessage = error instanceof Error ? error.message : "";
      const errorType = authErrorMessages.has(errorMessage) ? errorMessage : "oauth";

      const baseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
      const response = NextResponse.redirect(new URL(`/login?error=${errorType}`, baseUrl));

      // Clear custom JWT cookies explicitly with path "/"
      response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
      response.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });

      // Defensively clear Supabase SSR cookies
      const allCookies = request.cookies.getAll();
      allCookies.forEach((cookie) => {
        if (cookie.name.startsWith("sb-")) {
          response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
        }
      });

      return response;
    }
  };
}
