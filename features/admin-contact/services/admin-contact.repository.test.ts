// @vitest-environment node
// admin-contact.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { adminContactRepository } from "./admin-contact.repository";

const messageRow = {
  id: "msg-1",
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: "0912345678",
  message: "Cho hỏi đơn hàng...",
  is_read: false,
  handled_by: null,
  internal_note: null,
  created_at: "2026-07-24T00:00:00.000Z",
};

describe("adminContactRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map isHandled từ handled_by (null -> false)", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [messageRow], error: null }));

    const result = await adminContactRepository.list();

    expect(result[0]).toMatchObject({ isHandled: false, isRead: false, phone: "0912345678" });
  });

  it("filter='open' -> gọi .is('handled_by', null)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminContactRepository.list("open");

    expect(builder.is).toHaveBeenCalledWith("handled_by", null);
  });

  it("filter='handled' -> gọi .not('handled_by', 'is', null)", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminContactRepository.list("handled");

    expect(builder.not).toHaveBeenCalledWith("handled_by", "is", null);
  });
});

describe("adminContactRepository.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isHandled=true -> gán handled_by = staffUserId", async () => {
    const builder = makeBuilder({
      data: { ...messageRow, handled_by: "staff-1" },
      error: null,
    });
    mocks.from.mockReturnValue(builder);

    const result = await adminContactRepository.update(
      "msg-1",
      { isHandled: true, isRead: true },
      "staff-1",
    );

    expect(builder.update).toHaveBeenCalledWith({ is_read: true, handled_by: "staff-1" });
    expect(result.isHandled).toBe(true);
  });

  it("isHandled=false -> gỡ handled_by (mở lại)", async () => {
    const builder = makeBuilder({ data: messageRow, error: null });
    mocks.from.mockReturnValue(builder);

    await adminContactRepository.update("msg-1", { isHandled: false }, "staff-1");

    expect(builder.update).toHaveBeenCalledWith({ handled_by: null });
  });

  it("không tìm thấy -> NotFoundError", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminContactRepository.update("missing", { isRead: true }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
