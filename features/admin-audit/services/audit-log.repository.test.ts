// @vitest-environment node
// audit-log.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    insert: vi.fn(async () => result),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { auditLogRepository } from "./audit-log.repository";

describe("auditLogRepository.record", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insert đúng payload snake_case với user_id thật", async () => {
    const builder = makeBuilder({ data: null, error: null });
    mocks.from.mockReturnValue(builder);

    await auditLogRepository.record({
      userId: "staff-1",
      action: "UPDATE",
      tableName: "products",
      recordId: "prod-1",
      oldData: { price: 100 },
      newData: { price: 200 },
    });

    expect(mocks.from).toHaveBeenCalledWith("audit_log");
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: "staff-1",
      action: "UPDATE",
      table_name: "products",
      record_id: "prod-1",
      old_data: { price: 100 },
      new_data: { price: 200 },
    });
  });

  it("lỗi insert -> nuốt lỗi, không throw ra ngoài (best-effort)", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } }),
    );

    await expect(
      auditLogRepository.record({
        userId: "staff-1",
        action: "CREATE",
        tableName: "coupons",
        recordId: "cpn-1",
      }),
    ).resolves.toBeUndefined();
  });
});
