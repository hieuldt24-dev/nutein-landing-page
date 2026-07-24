// @vitest-environment node
// policy.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mocks.from }),
}));

import { policyService } from "./policy.service";

const pageRow = {
  slug: "bao-mat",
  title: "Chính sách bảo mật",
  content: "Nội dung...",
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("policyService.getBySlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("slug không hợp lệ (vd 'about') -> null, không query DB", async () => {
    const result = await policyService.getBySlug("about");
    expect(result).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("slug hợp lệ, tìm thấy -> map đúng field", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: pageRow, error: null }));

    const result = await policyService.getBySlug("bao-mat");

    expect(result).toEqual({
      slug: "bao-mat",
      title: "Chính sách bảo mật",
      content: "Nội dung...",
      updatedAt: "2026-07-24T00:00:00.000Z",
    });
  });

  it("không tìm thấy -> null", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(await policyService.getBySlug("giao-hang")).toBeNull();
  });
});

describe("policyService.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chỉ lấy 5 slug chính sách (không có about)", async () => {
    const builder = makeBuilder({ data: [pageRow], error: null });
    mocks.from.mockReturnValue(builder);

    const result = await policyService.list();

    expect(builder.in).toHaveBeenCalledWith(
      "slug",
      expect.arrayContaining(["bao-mat", "dieu-khoan", "giao-hang", "doi-tra", "thanh-toan"]),
    );
    expect(result).toHaveLength(1);
  });
});
