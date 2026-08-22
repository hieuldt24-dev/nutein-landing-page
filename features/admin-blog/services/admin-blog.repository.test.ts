// @vitest-environment node
// admin-blog.repository.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
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

import { adminBlogRepository } from "./admin-blog.repository";

const postRow = {
  id: "post-1",
  category: "HEALTHY_LIFESTYLE",
  tags: ["eat-clean"],
  title: "Ăn sạch mỗi ngày",
  slug: "an-sach-moi-ngay",
  thumbnail: "/images/example.jpg",
  cover_alt: "Ảnh minh hoạ",
  excerpt: "Tóm tắt...",
  content: "<p>Nội dung</p>",
  is_published: true,
  published_at: "2026-07-20T00:00:00.000Z",
  reading_minutes: 6,
  featured: true,
  favorite: false,
  recipe_filters: ["eat_clean"],
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("adminBlogRepository.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map category DB (HEALTHY_LIFESTYLE) -> app (lifestyle), is_published -> status", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: [postRow], error: null }));

    const result = await adminBlogRepository.list();

    expect(result[0]).toMatchObject({
      category: "lifestyle",
      status: "published",
      coverImage: "/images/example.jpg",
      coverAlt: "Ảnh minh hoạ",
      bodyHtml: "<p>Nội dung</p>",
      readingMinutes: 6,
      featured: true,
      favorite: false,
      recipeFilters: ["eat_clean"],
    });
  });

  it("filter category='lifestyle' -> gọi .eq('category', 'HEALTHY_LIFESTYLE')", async () => {
    const builder = makeBuilder({ data: [], error: null });
    mocks.from.mockReturnValue(builder);

    await adminBlogRepository.list({ category: "lifestyle" });

    expect(builder.eq).toHaveBeenCalledWith("category", "HEALTHY_LIFESTYLE");
  });
});

describe("adminBlogRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("map app category (lifestyle) -> DB (HEALTHY_LIFESTYLE), status published -> is_published true", async () => {
    const builder = makeBuilder({ data: postRow, error: null });
    mocks.from.mockReturnValue(builder);

    await adminBlogRepository.create({
      slug: "an-sach-moi-ngay",
      title: "Ăn sạch mỗi ngày",
      excerpt: "Tóm tắt...",
      category: "lifestyle",
      coverImage: "/images/example.jpg",
      coverAlt: "Ảnh minh hoạ",
      bodyHtml: "<p>Nội dung</p>",
      status: "published",
      publishedAt: "2026-07-20T00:00:00.000Z",
      readingMinutes: 6,
      recipeFilters: ["eat_clean"],
      tags: ["eat-clean"],
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "HEALTHY_LIFESTYLE",
        is_published: true,
        published_at: "2026-07-20T00:00:00.000Z",
        reading_minutes: 6,
      }),
    );
  });

  // F3 / AC6 — payload XSS không bao giờ được ghi xuống DB.
  it("sanitize bodyHtml write-time: payload <script>/onerror không vào cột content", async () => {
    const builder = makeBuilder({ data: postRow, error: null });
    mocks.from.mockReturnValue(builder);

    await adminBlogRepository.create({
      slug: "xss",
      title: "x",
      excerpt: "",
      category: "protein",
      coverImage: "",
      coverAlt: "",
      bodyHtml: '<p>Nội dung</p><script>alert(1)</script><img src="x" onerror="alert(1)" alt="a" />',
      status: "draft",
      publishedAt: null,
      readingMinutes: 3,
    });

    const insertMock = builder.insert as ReturnType<typeof vi.fn>;
    const payload = insertMock.mock.calls[0][0] as { content: string };
    expect(payload.content).not.toContain("<script");
    expect(payload.content).not.toContain("onerror");
    expect(payload.content).not.toContain("alert(1)");
    expect(payload.content).toContain("<p>Nội dung</p>");
  });

  it("slug trùng (23505) -> BadRequestError", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: "23505", message: "duplicate key" } }),
    );

    await expect(
      adminBlogRepository.create({
        slug: "an-sach-moi-ngay",
        title: "x",
        excerpt: "",
        category: "protein",
        coverImage: "",
        coverAlt: "",
        bodyHtml: "",
        status: "draft",
        publishedAt: null,
        readingMinutes: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("adminBlogRepository.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("status draft -> is_published false, published_at null", async () => {
    const builder = makeBuilder({ data: { ...postRow, is_published: false }, error: null });
    mocks.from.mockReturnValue(builder);

    await adminBlogRepository.update("post-1", { status: "draft" });

    expect(builder.update).toHaveBeenCalledWith({
      is_published: false,
      published_at: null,
    });
  });

  // F3 / AC6 — cùng allowlist ở đường update.
  it("sanitize bodyHtml write-time trên update: <script> bị loại khỏi payload", async () => {
    const builder = makeBuilder({ data: postRow, error: null });
    mocks.from.mockReturnValue(builder);

    await adminBlogRepository.update("post-1", {
      bodyHtml: '<p>ok</p><script>alert(1)</script>',
    });

    const updateMock = builder.update as ReturnType<typeof vi.fn>;
    const payload = updateMock.mock.calls[0][0] as { content: string };
    expect(payload.content).toBe("<p>ok</p>");
  });

  it("không tìm thấy -> NotFoundError", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      adminBlogRepository.update("missing", { title: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
