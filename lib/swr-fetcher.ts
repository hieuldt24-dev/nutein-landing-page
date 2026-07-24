/**
 * Standard fetcher for SWR that integrates with our custom server-side ApiResponse structure.
 * It unpacks the data directly if successful or throws an error with status and code if failed.
 */
import { ApiResponse } from "@/src/api/response";
import {
  isRemintableAuthCode,
  restoreApiSession,
  type FetchError,
} from "@/lib/api-client";

export type { FetchError };

async function toFetchError(res: Response): Promise<FetchError> {
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

export const fetcher = async <T>(url: string): Promise<T> => {
  let res = await fetch(url);

  if (res.status === 401) {
    const error = await toFetchError(res);
    if (
      isRemintableAuthCode(error.code) &&
      (await restoreApiSession(error.code))
    ) {
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
