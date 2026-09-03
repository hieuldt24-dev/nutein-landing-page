// @vitest-environment node
// profile.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

/** Query builder giả — mọi method chain trả về chính nó, awaitable qua `then`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { profileRepository } from "./profile.repository";
import type { AppError } from "@/src/errors/app.error";

const row = { email: "user@example.com", name: "Nguyễn Văn A", phone: "0987654321" };

describe("profileRepository.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ghi chỉ phone + updated_at khi chỉ có phone", async () => {
    const updateBuilder = makeBuilder({ data: row, error: null });
    mocks.from.mockReturnValue(updateBuilder);

    await profileRepository.update("user-1", { phone: "0987654321" });

    const calledWith = (updateBuilder.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(calledWith).toHaveProperty("phone", "0987654321");
    expect(calledWith).toHaveProperty("updated_at");
    expect(calledWith).not.toHaveProperty("name");
  });

  it("ghi chỉ name + updated_at khi chỉ có fullName", async () => {
    const updateBuilder = makeBuilder({ data: row, error: null });
    mocks.from.mockReturnValue(updateBuilder);

    await profileRepository.update("user-1", { fullName: "Nguyễn Văn A" });

    const calledWith = (updateBuilder.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(calledWith).toHaveProperty("name", "Nguyễn Văn A");
    expect(calledWith).toHaveProperty("updated_at");
    expect(calledWith).not.toHaveProperty("phone");
  });

  it("ghi cả name và phone khi có cả hai", async () => {
    const updateBuilder = makeBuilder({ data: row, error: null });
    mocks.from.mockReturnValue(updateBuilder);

    await profileRepository.update("user-1", {
      fullName: "Nguyễn Văn A",
      phone: "0987654321",
    });

    const calledWith = (updateBuilder.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(calledWith).toHaveProperty("name", "Nguyễn Văn A");
    expect(calledWith).toHaveProperty("phone", "0987654321");
    expect(calledWith).toHaveProperty("updated_at");
  });

  it("map lỗi postgres 23505 sang ConflictError PHONE_TAKEN", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: "23505", message: "duplicate" } }),
    );

    try {
      await profileRepository.update("user-1", { phone: "0987654321" });
      expect.unreachable("expected update() to throw");
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe("PHONE_TAKEN");
    }
  });

  it("map lỗi chung sang InternalServerError", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );

    try {
      await profileRepository.update("user-1", { phone: "0987654321" });
      expect.unreachable("expected update() to throw");
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

describe("profileRepository.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map lỗi Supabase sang InternalServerError", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );

    try {
      await profileRepository.get("user-1");
      expect.unreachable("expected get() to throw");
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});
