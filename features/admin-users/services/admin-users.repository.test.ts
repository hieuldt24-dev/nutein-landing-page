// @vitest-environment node
// admin-users.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  revokeAllForUser: vi.fn(),
}));

vi.mock("@/features/auth/services/refresh-token.service", () => ({
  refreshTokenService: { revokeAllForUser: mocks.revokeAllForUser },
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { adminUsersRepository } from "./admin-users.repository";

const userRow = {
  id: "user-1",
  email: "minhanh@example.com",
  name: "Nguyễn Minh Anh",
  role: "USER",
  is_deleted: false,
  created_at: "2026-06-10T00:00:00.000Z",
};

describe("adminUsersRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map role DB (USER) -> app (user), is_deleted -> locked", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [userRow], error: null }));

    const result = await adminUsersRepository.list();

    expect(result[0]).toEqual({
      id: "user-1",
      email: "minhanh@example.com",
      fullName: "Nguyễn Minh Anh",
      role: "user",
      locked: false,
      createdAt: "2026-06-10T00:00:00.000Z",
    });
  });

  it("name null -> fallback fullName về email", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: [{ ...userRow, name: null }], error: null }),
    );

    const result = await adminUsersRepository.list();

    expect(result[0].fullName).toBe("minhanh@example.com");
  });

  it("filter role != 'all' -> gọi .eq('role', DB enum)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminUsersRepository.list({ role: "staff" });

    expect(builder.eq).toHaveBeenCalledWith("role", "STAFF");
  });

  it("filter q -> lọc theo email hoặc tên (in-memory, không phân biệt hoa thường)", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: [userRow, { ...userRow, id: "user-2", email: "other@example.com", name: "Khác" }],
        error: null,
      }),
    );

    const result = await adminUsersRepository.list({ q: "MINH" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("user-1");
  });
});

describe("adminUsersRepository.setRole / setLocked", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setRole -> update role đúng DB enum viết hoa", async () => {
    const builder = makeBuilder({ data: { ...userRow, role: "STAFF" }, error: null });
    mocks.from.mockReturnValue(builder);

    const result = await adminUsersRepository.setRole("user-1", "staff");

    expect(builder.update).toHaveBeenCalledWith({ role: "STAFF" });
    expect(result.role).toBe("staff");
  });

  it("setLocked -> update is_deleted", async () => {
    const builder = makeBuilder({ data: { ...userRow, is_deleted: true }, error: null });
    mocks.from.mockReturnValue(builder);

    const result = await adminUsersRepository.setLocked("user-1", true);

    expect(builder.update).toHaveBeenCalledWith({ is_deleted: true });
    expect(result.locked).toBe(true);
  });

  // F2 / AC4 — khóa tài khoản phải thu hồi mọi refresh token NGAY lập tức.
  it("setLocked(true) -> gọi refreshTokenService.revokeAllForUser(id)", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: { ...userRow, is_deleted: true }, error: null }));
    mocks.revokeAllForUser.mockResolvedValue(undefined);

    await adminUsersRepository.setLocked("user-1", true);

    expect(mocks.revokeAllForUser).toHaveBeenCalledWith("user-1");
  });

  // Mở khóa thì KHÔNG thu hồi (không buộc user đăng nhập lại).
  it("setLocked(false) -> KHÔNG thu hồi refresh token", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: { ...userRow, is_deleted: false }, error: null }),
    );

    const result = await adminUsersRepository.setLocked("user-1", false);

    expect(mocks.revokeAllForUser).not.toHaveBeenCalled();
    expect(result.locked).toBe(false);
  });

  it("không tìm thấy -> NotFoundError", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(adminUsersRepository.setRole("missing", "admin")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
