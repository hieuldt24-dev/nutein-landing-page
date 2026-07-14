/**
 * Standard fetcher for SWR that integrates with our custom server-side ApiResponse structure.
 * It unpacks the data directly if successful or throws an error with status and code if failed.
 */
import { ApiResponse } from "@/src/api/response";

export interface FetchError extends Error {
  status?: number;
  code?: string;
}

export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  // If HTTP status is not ok (200-299), throw an error with details
  if (!res.ok) {
    const errorData: ApiResponse<null> = await res.json().catch(() => ({
      success: false,
      data: null,
      error: null,
    }));
    
    const errorMessage = errorData.error?.message || "Đã xảy ra lỗi khi tải dữ liệu";
    const error = new Error(errorMessage) as FetchError;
    error.status = res.status;
    error.code = errorData.error?.code || "HTTP_ERROR";
    throw error;
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
