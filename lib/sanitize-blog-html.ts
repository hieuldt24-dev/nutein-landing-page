import sanitizeHtml from "sanitize-html";

/**
 * Allowlist DUY NHẤT cho nội dung blog (bodyHtml) — dùng chung cho cả
 * write-time (features/admin-blog) và read-time (features/blog) để không bao
 * giờ lệch cấu hình giữa 2 phía.
 *
 * Chỉ liệt kê tường minh (không kế thừa default của sanitize-html, không dùng
 * wildcard "*" cho attribute) — nhờ vậy mọi attribute lạ, đặc biệt là handler
 * sự kiện `on*` (onerror/onload/onclick...), đều bị loại bỏ. `allowedSchemes`
 * cũng khai báo tường minh để chặn `javascript:` / `data:` trong href/src.
 */
const BLOG_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "b",
    "strong",
    "i",
    "em",
    "a",
    "ul",
    "ol",
    "li",
    "img",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt"],
  },
  // Không cho phép bất kỳ scheme thực thi được (javascript:, data:, vbscript:).
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
    img: ["http", "https"],
  },
  // Cho phép link/ảnh tương đối (/images/a.png) — không phải scheme thực thi.
  allowProtocolRelative: false,
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // Bỏ hẳn nội dung bên trong các tag nguy hiểm, không chỉ bỏ tag.
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "noscript", "iframe"],
};

/**
 * Lọc HTML bài blog theo allowlist ở trên. An toàn khi gọi nhiều lần
 * (idempotent) — dùng ở cả lúc ghi và lúc đọc.
 */
export function sanitizeBlogHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, BLOG_HTML_OPTIONS);
}
