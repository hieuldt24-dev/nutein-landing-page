import { NextRequest } from "next/server";
import { AppError } from "@/src/errors/app.error";
import { getSupabaseClient } from "@/lib/supabase";

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: string;
}

export const authenticate = async (req: NextRequest): Promise<AuthenticatedUser> => {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      throw new AppError("No token provided", 401, "NO_TOKEN");
    }

    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError("Invalid token or user not found", 401, "INVALID_TOKEN");
    }

    return {
      userId: user.id,
      email: user.email,
      role: (user.user_metadata?.role as string) || "user",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error instanceof Error ? error.message : "Authentication failed",
      401,
      "UNAUTHORIZED",
    );
  }
};

export const requireRole = (user: AuthenticatedUser, ...roles: string[]) => {
  if (!user.role || !roles.includes(user.role)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
};
