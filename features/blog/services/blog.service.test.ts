// @vitest-environment node
// blog.service.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ from: mocks.from }),
}));

import { blogService } from "./blog.service";

const publishedRow = {
  id: "post-1",
  category: "HEALTHY_LIFESTYLE",
  tags: ["eat-clean"],
  title: "Ăn sạch mỗi ngày",
  slug: "an-sach-moi-ngay",
  thumbnail: "/images/example.jpg",
  cover_alt: "Ảnh minh hoạ",
  excerpt: "Tóm tắt...",
  content: "<p>Nội dung</p>",
  published_at: "2026-07-20T00:00:00.000Z",
  reading_minutes: 6,
  featured: true,
  favorite: false,
  recipe_filters: ["eat_clean"],
};

const otherRow = {
  ...publishedRow,
  id: "post-2",
  slug: "khac",
  category: "PROTEIN",
  published_at: "2026-07-10T00:00:00.000Z",
  featured: false,
  favorite: true,
};

describe("blogService.listPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chỉ query is_published=true, map category DB -> app", async () => {
    const builder = makeBuilder({ data: [publishedRow], error: null });
    mocks.from.mockReturnValue(builder);

    const result = await blogService.listPosts();

    expect(builder.eq).toHaveBeenCalledWith("is_published", true);
    expect(result[0]).toMatchObject({ category: "lifestyle", featured: true });
  });

  it("lọc theo category + sort mới nhất trước", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: [publishedRow, otherRow], error: null }),
    );

    const result = await blogService.listPosts({ category: "protein" });

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("khac");
  });
});

describe("blogService.listFeatured / listFavoriteRecipes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listFeatured chỉ trả bài featured=true", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({ data: [publishedRow, otherRow], error: null }),
    );

    const result = await blogService.listFeatured();

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("an-sach-moi-ngay");
  });
});

describe("blogService.getPostBySlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throw NotFoundError khi không tìm thấy bài đã publish", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(blogService.getPostBySlug("khong-ton-tai")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("trả bài kèm bodyHtml khi tìm thấy", async () => {
    mocks.from.mockReturnValue(makeBuilder({ data: publishedRow, error: null }));

    const result = await blogService.getPostBySlug("an-sach-moi-ngay");

    expect(result.bodyHtml).toBe("<p>Nội dung</p>");
  });

  // F3 / AC6 — bài đã lưu TRƯỚC khi có sanitize write-time vẫn phải an toàn
  // khi đọc ra (read-time sanitization, defense in depth).
  it("sanitize read-time: content chứa <script>/onerror trong DB không lọt ra bodyHtml", async () => {
    mocks.from.mockReturnValue(
      makeBuilder({
        data: {
          ...publishedRow,
          content:
            '<p>Nội dung</p><script>alert(1)</script><img src="x" onerror="alert(1)" alt="a" />',
        },
        error: null,
      }),
    );

    const result = await blogService.getPostBySlug("an-sach-moi-ngay");

    expect(result.bodyHtml).not.toContain("<script");
    expect(result.bodyHtml).not.toContain("onerror");
    expect(result.bodyHtml).not.toContain("alert(1)");
    expect(result.bodyHtml).toContain("<p>Nội dung</p>");
  });

  // F3 / AC7 — nội dung hợp lệ không bị biến dạng khi đọc.
  it("read-time giữ nguyên các tag được phép", async () => {
    const allowed = "<h2>Tiêu đề</h2><p>Đoạn <b>đậm</b></p><ul><li>a</li></ul>";
    mocks.from.mockReturnValue(
      makeBuilder({ data: { ...publishedRow, content: allowed }, error: null }),
    );

    const result = await blogService.getPostBySlug("an-sach-moi-ngay");

    expect(result.bodyHtml).toBe(allowed);
  });
});
