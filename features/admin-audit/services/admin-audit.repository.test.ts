// @vitest-environment node
// admin-audit.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const resolved = {
    ...result,
    count:
      result.count ??
      (Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0)),
  };
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(async () => resolved),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { adminAuditRepository } from "./admin-audit.repository";

const orderUpdateRow = {
  id: "aud-1",
  action: "UPDATE",
  table_name: "orders",
  record_id: "order-1",
  old_data: { status: "PENDING", final_price: 224000 },
  new_data: { status: "PROCESSING", final_price: 224000 },
  created_at: "2026-07-24T00:00:00.000Z",
  actor: null,
};

const couponCreateRow = {
  id: "aud-2",
  action: "CREATE",
  table_name: "coupons",
  record_id: "cpn-1",
  old_data: null,
  new_data: { code: "NUTEIN10" },
  created_at: "2026-06-01T00:00:00.000Z",
  actor: { email: "admin@nutein.com" },
};

describe("adminAuditRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("actor null (auth.uid() không có giá trị) -> actorEmail null, không throw", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [orderUpdateRow], error: null }));

    const result = await adminAuditRepository.list();

    expect(result.items[0].actorEmail).toBeNull();
    expect(result.total).toBe(1);
  });

  it("orders + status đổi -> summary 'Đổi trạng thái đơn → processing'", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [orderUpdateRow], error: null }));

    const result = await adminAuditRepository.list();

    expect(result.items[0].summary).toBe("Đổi trạng thái đơn → processing");
  });

  it("CREATE -> summary 'Tạo mới trong <table>', actor join map đúng email", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [couponCreateRow], error: null }));

    const result = await adminAuditRepository.list();

    expect(result.items[0]).toMatchObject({
      summary: "Tạo mới trong coupons",
      actorEmail: "admin@nutein.com",
    });
  });

  it("filter action != 'all' -> gọi .eq('action', ...)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminAuditRepository.list({ action: "DELETE" });

    expect(builder.eq).toHaveBeenCalledWith("action", "DELETE");
  });

  it("limit/offset -> gọi .range", async () => {
    const builder = makeBuilder({ data: [], error: null, count: 0 });
    mocks.from.mockReturnValue(builder);

    await adminAuditRepository.list({ limit: 20, offset: 40 });

    expect(builder.range).toHaveBeenCalledWith(40, 59);
  });

  it("lỗi query -> throw", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: { message: "db down" } }));
    await expect(adminAuditRepository.list()).rejects.toThrow("Không tải được audit log");
  });
});
