// @vitest-environment node
// audit-log.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    insert,
    loggerError: vi.fn(),
    supabaseAdmin: null as { from: (table: string) => { insert: typeof insert } } | null,
  };
});

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin;
  },
}));

vi.mock("@/src/logging/logger", () => ({
  logger: { error: mocks.loggerError },
}));

import { auditLogService } from "./audit-log.service";

describe("auditLogService.log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseAdmin = { from: () => ({ insert: mocks.insert }) };
  });

  it("insert đúng action/table_name/record_id/ip vào audit_log, gộp userAgent+metadata vào new_data", async () => {
    mocks.insert.mockResolvedValue({ error: null });

    await auditLogService.log("user-1", "LOGIN_SUCCESS", {
      ip: "1.2.3.4",
      userAgent: "vitest-agent",
      metadata: { via: "password" },
    });

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      action: "LOGIN_SUCCESS",
      table_name: "auth_session",
      record_id: "user-1",
      new_data: { via: "password", userAgent: "vitest-agent" },
      ip_address: "1.2.3.4",
    });
  });

  it("thiếu context (ip/userAgent/metadata) -> new_data/ip_address là null, record_id vẫn là userId", async () => {
    mocks.insert.mockResolvedValue({ error: null });

    await auditLogService.log("user-2", "LOGOUT");

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-2",
      action: "LOGOUT",
      table_name: "auth_session",
      record_id: "user-2",
      new_data: null,
      ip_address: null,
    });
  });

  it("không throw và không gọi insert khi supabaseAdmin chưa cấu hình (null)", async () => {
    mocks.supabaseAdmin = null;

    await expect(auditLogService.log("user-1", "LOGOUT")).resolves.toBeUndefined();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("log lỗi qua Pino thay vì throw khi insert thất bại", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "db down" } });

    await expect(auditLogService.log("user-1", "TOKEN_REFRESH")).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", event: "TOKEN_REFRESH" }),
      "Không thể ghi auth audit log"
    );
  });
});
