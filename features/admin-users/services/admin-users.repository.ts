import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import { NotFoundError } from "@/src/errors/app.error";
import { refreshTokenService } from "@/features/auth/services/refresh-token.service";
import { authService } from "@/features/auth/services/auth.service";
import type { AuthRole } from "@/features/auth/types";
import type {
  AdminManagedUser,
  AdminManagedUserListResult,
  AdminUsersListQuery,
} from "../types";

type DbRole = "USER" | "STAFF" | "ADMIN";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: DbRole;
  is_deleted: boolean;
  created_at: string;
}

const USER_SELECT = "id, email, name, role, is_deleted, created_at";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * "locked" (Khóa tài khoản) tái dùng cột `is_deleted` có sẵn — DB không có
 * cột riêng cho khái niệm này. Lưu ý: khóa ở đây chỉ đổi cờ hiển thị/quản
 * lý trên panel Admin, CHƯA có enforcement chặn đăng nhập ở
 * `app/api/auth/session/route.ts` (ngoài phạm vi yêu cầu lần này).
 */
function toAdminManagedUser(row: UserRow): AdminManagedUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.name || row.email,
    role: row.role.toLowerCase() as AuthRole,
    locked: row.is_deleted,
    createdAt: row.created_at,
  };
}

/**
 * PostgREST `or()` phân tách bằng dấu phẩy/ngoặc — input thô chưa lọc sẽ làm
 * hỏng cả biểu thức filter. Strip các ký tự có ý nghĩa cú pháp trước khi nội suy.
 */
function sanitizeOrPattern(value: string): string {
  return value.replace(/[,%()]/g, "");
}

async function list(query: AdminUsersListQuery = {}): Promise<AdminManagedUserListResult> {
  const client = requireAdminClient();
  let builder = client.from("users").select(USER_SELECT, { count: "exact" });

  if (query.role && query.role !== "all") {
    builder = builder.eq("role", query.role.toUpperCase());
  }

  const q = sanitizeOrPattern(query.q?.trim() ?? "");
  if (q) {
    builder = builder.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const pageSize = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Không tải được danh sách user: ${error.message}`);
  }

  const items = ((data as UserRow[]) ?? []).map(toAdminManagedUser);

  return { items, total: count ?? items.length };
}

async function setRole(id: string, role: AuthRole): Promise<AdminManagedUser> {
  const client = requireAdminClient();

  const { data: currentRow } = await client
    .from("users")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await client
    .from("users")
    .update({ role: role.toUpperCase() })
    .eq("id", id)
    .select(USER_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Không cập nhật được vai trò: ${error.message}`);
  }
  if (!data) {
    throw new NotFoundError("User");
  }

  // Hạ quyền -> thu hồi toàn bộ refresh token hiện có (mirrors setLocked's
  // revoke-on-privilege-reduction pattern). Nâng quyền thì KHÔNG revoke.
  if (currentRow) {
    const oldRole = authService.fromDbRole((currentRow as { role: DbRole }).role);
    if (authService.isDowngrade(oldRole, role)) {
      await refreshTokenService.revokeAllForUser(id);
    }
  }

  return toAdminManagedUser(data as UserRow);
}

async function setLocked(id: string, locked: boolean): Promise<AdminManagedUser> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("users")
    .update({ is_deleted: locked })
    .eq("id", id)
    .select(USER_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Không cập nhật được trạng thái khóa: ${error.message}`);
  }
  if (!data) {
    throw new NotFoundError("User");
  }

  // F2 — khóa tài khoản phải có hiệu lực NGAY: thu hồi mọi refresh token
  // đang mở của user đó, không đợi tới lần /api/auth/refresh kế tiếp. Mở
  // khóa thì không thu hồi (không cần buộc user đăng nhập lại).
  if (locked) {
    await refreshTokenService.revokeAllForUser(id);
  }

  return toAdminManagedUser(data as UserRow);
}

export const adminUsersRepository = {
  list,
  setRole,
  setLocked,
};
