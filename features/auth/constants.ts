/** SWR-as-store key — user đang đăng nhập (không phải URL API). */
export const AUTH_USER_SWR_KEY = "auth-user";

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
