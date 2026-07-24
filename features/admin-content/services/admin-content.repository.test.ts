// @vitest-environment node
// admin-content.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { adminContentRepository } from "./admin-content.repository";

const pageRow = {
  slug: "bao-mat",
  title: "Chính sách bảo mật",
  content: "Nội dung...",
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("adminContentRepository.getPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map đúng field, trả null khi không tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    expect(await adminContentRepository.getPage("bao-mat")).toBeNull();
  });

  it("map snake_case -> camelCase khi tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: pageRow, error: null }));
    const result = await adminContentRepository.getPage("bao-mat");
    expect(result).toEqual({
      slug: "bao-mat",
      title: "Chính sách bảo mật",
      content: "Nội dung...",
      updatedAt: "2026-07-24T00:00:00.000Z",
    });
  });
});

describe("adminContentRepository.updatePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upsert theo slug với onConflict", async () => {
    const getBuilder = makeBuilder({ data: pageRow, error: null });
    const upsertBuilder = makeBuilder({
      data: { ...pageRow, title: "Tiêu đề mới" },
      error: null,
    });
    let call = 0;
    mocks.from.mockImplementation(() => {
      call += 1;
      return call === 1 ? getBuilder : upsertBuilder;
    });

    const result = await adminContentRepository.updatePage("bao-mat", {
      title: "Tiêu đề mới",
    });

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "bao-mat", title: "Tiêu đề mới" }),
      { onConflict: "slug" },
    );
    expect(result.title).toBe("Tiêu đề mới");
  });
});
