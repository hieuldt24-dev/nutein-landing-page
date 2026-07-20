/**
 * Standard fetcher for SWR that integrates with our custom server-side ApiResponse structure.
 * It unpacks the data directly if successful or throws an error with status and code if failed.
 */
import { ApiResponse } from "@/src/api/response";

export interface FetchError extends Error {
  status?: number;
  code?: string;
}

async function toFetchError(res: Response): Promise<FetchError> {
  const errorData: ApiResponse<null> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: null,
  }));

  const error = new Error(
    errorData.error?.message || "Đã xảy ra lỗi khi tải dữ liệu"
  ) as FetchError;
  error.status = res.status;
  error.code = errorData.error?.code || "HTTP_ERROR";
  return error;
}

/**
 * Access token (JWT riêng của app, cookie httpOnly) hết hạn giữa chừng ->
 * gọi app/api/auth/refresh 1 lần để cấp lại rồi để fetcher retry, tránh văng
 * lỗi 401 vô lý trong khi user vẫn còn đăng nhập hợp lệ (session Supabase +
 * refresh token còn hạn). Xem src/middlewares/authenticate.middlware.ts.
 */
async function tryRefreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export const fetcher = async <T>(url: string): Promise<T> => {
  let res = await fetch(url);

  if (res.status === 401) {
    const error = await toFetchError(res);
    if (error.code === "TOKEN_EXPIRED" && (await tryRefreshAccessToken())) {
      res = await fetch(url);
      if (!res.ok) {
        throw await toFetchError(res);
      }
    } else {
      throw error;
    }
  } else if (!res.ok) {
    throw await toFetchError(res);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success || json.data === null) {
    const errorMessage = json.error?.message || "Yêu cầu dữ liệu thất bại";
    const error = new Error(errorMessage) as FetchError;
    error.code = json.error?.code || "API_ERROR";
    throw error;
  }

  return json.data;
};
