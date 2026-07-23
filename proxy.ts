import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authenticate, requireRole } from "@/src/middlewares/authenticate.middlware";

/**
 * Gate /staff/** (chỉ Staff) và /admin/** (chỉ Admin, A1/A2) bằng role JWT
 * app (cookie nutein_access_token, xem
 * src/middlewares/authenticate.middlware.ts) — chặn optimistic ở edge trước
 * khi trang render, mirror đúng StaffOnlyGate/AdminOnlyGate phía client:
 *   - Không phải Staff/Admin (chưa đăng nhập hoặc role USER) -> "/".
 *   - Đúng nhóm nhưng lạc sang khu còn lại -> trang gốc của role đó
 *     ("/staff" cho Staff, "/admin/users" cho Admin).
 * Optimistic check (chỉ verify JWT, không query DB) — không thay thế
 * authenticate()/requireRole() ở từng route thật trong app/api/staff/**,
 * app/api/admin/** khi các route đó được thêm; đây chỉ là lớp UX chặn sớm,
 * không phải phòng tuyến bảo mật duy nhất.
 */
async function guardAdminArea(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const isStaffArea = pathname.startsWith("/staff");
  const isAdminArea = pathname.startsWith("/admin");
  if (!isStaffArea && !isAdminArea) return null;

  let user;
  try {
    user = await authenticate(request);
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    requireRole(user, isStaffArea ? "STAFF" : "ADMIN");
  } catch {
    if (user.role === "STAFF") {
      return NextResponse.redirect(new URL("/staff", request.url));
    }
    if (user.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/users", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return null;
}

/**
 * Next.js 16 đổi tên middleware.ts -> proxy.ts (hành vi giữ nguyên).
 * Refresh Supabase session cookie trên mọi request, để Server Component/
 * Route Handler luôn đọc được session mới nhất qua lib/supabase-server.ts.
 */
export async function proxy(request: NextRequest) {
  const adminRedirect = await guardAdminArea(request);
  if (adminRedirect) return adminRedirect;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() (không phải getSession()) để verify token thật với Auth server.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
