import type { ApiResponse } from "@/src/api/response";
import { authRepository } from "@/features/auth/services/auth.repository";

export interface FetchError extends Error {
  status?: number;
  code?: string;
}

const REMINTABLE_CODES = new Set(["TOKEN_EXPIRED", "NO_TOKEN", "INVALID_TOKEN"]);

async function tryRefreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Single-flight — nhiều request 401 cùng lúc chỉ remint 1 lần. */
let restoreInFlight: Promise<boolean> | null = null;

/**
 * Khôi phục cookie JWT app.
 * - TOKEN_EXPIRED → refresh rồi mint
 * - NO_TOKEN / INVALID_TOKEN → mint luôn (không gọi refresh — tránh spam
 *   401 "Không tìm thấy refresh token" khi chưa từng có cookie refresh)
 */
export async function restoreApiSession(
  code?: string,
): Promise<boolean> {
  if (restoreInFlight) return restoreInFlight;

  const skipRefresh = code === "NO_TOKEN" || code === "INVALID_TOKEN";

  restoreInFlight = (async () => {
    try {
      if (!skipRefresh && (await tryRefreshAccessToken())) return true;
      return (await authRepository.mintApiSession(true)).ok;
    } finally {
      restoreInFlight = null;
    }
  })();

  return restoreInFlight;
}

export function isRemintableAuthCode(code: string | undefined): boolean {
  return Boolean(code && REMINTABLE_CODES.has(code));
}

async function parseApiError(res: Response): Promise<FetchError> {
  const errorData: ApiResponse<null> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: null,
  }));
  const error = new Error(
    errorData.error?.message || "Đã xảy ra lỗi khi tải dữ liệu",
  ) as FetchError;
  error.status = res.status;
  error.code = errorData.error?.code || "HTTP_ERROR";
  return error;
}

/**
 * fetch JSON theo ApiResponse — tự remint JWT 1 lần rồi retry khi 401 remintable.
 */
export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  // FormData (vd upload file) — để browser tự set Content-Type kèm boundary,
  // ép "application/json" ở đây sẽ phá multipart request.
  const isFormData = init?.body instanceof FormData;
  const headers = isFormData
    ? { ...(init?.headers ?? {}) }
    : { "Content-Type": "application/json", ...(init?.headers ?? {}) };

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const firstError = await parseApiError(res);
    if (
      isRemintableAuthCode(firstError.code) &&
      (await restoreApiSession(firstError.code))
    ) {
      res = await fetch(url, { ...init, headers });
    } else {
      throw firstError;
    }
  }

  const json: ApiResponse<T> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: { message: "Không đọc được phản hồi máy chủ", code: "PARSE_ERROR" },
  }));

  if (!res.ok || !json.success) {
    const error = new Error(
      json.error?.message || "Đã xảy ra lỗi",
    ) as FetchError;
    error.status = res.status;
    error.code = json.error?.code || "REQUEST_ERROR";
    throw error;
  }

  return json.data as T;
}
