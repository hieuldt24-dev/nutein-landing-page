/** SWR-as-store key — user đang đăng nhập (không phải URL API). */
export const AUTH_USER_SWR_KEY = "auth-user";

/**
 * SWR-as-store key — true khi AuthProvider đã nhận sự kiện onAuthStateChange
 * đầu tiên (session Supabase đã được xác định thật, dù là có hay không có
 * user). Dùng để phân biệt "chưa biết" với "chắc chắn chưa đăng nhập" — nếu
 * chỉ dựa vào `isLoggedIn` (mặc định false lúc mount), UI guard (VD
 * AccountLayout) có thể chốt hiển thị "chưa đăng nhập" trước khi session
 * async kịp resolve, gây flash/flip sai giữa các lần load trang.
 */
export const AUTH_READY_SWR_KEY = "auth-ready";

/** Tên cookie httpOnly chứa JWT access/refresh token riêng của app (bảo vệ app/api/**). */
export const ACCESS_TOKEN_COOKIE = "nutein_access_token";
export const REFRESH_TOKEN_COOKIE = "nutein_refresh_token";

/**
 * Cookie options dùng chung cho cả set (app/api/auth/session, .../refresh)
 * và clear (app/api/auth/logout) — phải giống nhau ở cả 2 chiều, nếu không
 * 1 số trình duyệt/client sẽ không nhận diện đúng là cùng 1 cookie để xoá.
 * `maxAge` không nằm ở đây vì mỗi route/cookie cần giá trị khác nhau
 * (ACCESS_TOKEN_MAX_AGE/REFRESH_TOKEN_MAX_AGE lúc set, `0` lúc clear).
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
