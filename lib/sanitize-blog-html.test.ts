// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sanitizeBlogHtml } from "./sanitize-blog-html";

describe("sanitizeBlogHtml — F3 stored XSS (AC6)", () => {
  it("loại bỏ hoàn toàn <script>alert(1)</script>, kể cả nội dung bên trong", () => {
    const output = sanitizeBlogHtml('<p>Xin chào</p><script>alert(1)</script>');

    expect(output).not.toContain("<script");
    expect(output).not.toContain("alert(1)");
    expect(output).toContain("<p>Xin chào</p>");
  });

  it("loại bỏ attribute onerror trên <img>", () => {
    const output = sanitizeBlogHtml('<img src="x" onerror="alert(1)" alt="a" />');

    expect(output).not.toContain("onerror");
    expect(output).not.toContain("alert(1)");
  });

  it("loại bỏ mọi handler sự kiện on* trên các tag được phép", () => {
    const output = sanitizeBlogHtml(
      '<p onclick="steal()">a</p><a href="https://x.com" onmouseover="steal()">b</a><img src="https://x.com/a.png" onload="steal()" />',
    );

    expect(output).not.toContain("onclick");
    expect(output).not.toContain("onmouseover");
    expect(output).not.toContain("onload");
    expect(output).not.toContain("steal()");
  });

  it("chặn URI javascript: trong href và src", () => {
    const output = sanitizeBlogHtml(
      '<a href="javascript:alert(1)">click</a><img src="javascript:alert(1)" alt="x" />',
    );

    expect(output).not.toContain("javascript:");
  });

  it("chặn data: URI (có thể chứa HTML/SVG thực thi được)", () => {
    const output = sanitizeBlogHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    );

    expect(output).not.toContain("data:text/html");
  });

  it("loại bỏ <iframe>, <style>, <object> và nội dung của chúng", () => {
    const output = sanitizeBlogHtml(
      '<iframe src="https://evil.com"></iframe><style>body{display:none}</style><object data="evil"></object>',
    );

    expect(output).not.toContain("<iframe");
    expect(output).not.toContain("<style");
    expect(output).not.toContain("<object");
    expect(output).not.toContain("evil.com");
    expect(output).not.toContain("display:none");
  });

  it("loại bỏ attribute style (chặn CSS-based injection)", () => {
    const output = sanitizeBlogHtml('<p style="background:url(javascript:alert(1))">a</p>');

    expect(output).not.toContain("style=");
    expect(output).not.toContain("javascript:");
  });

  it("idempotent — chạy 2 lần cho cùng kết quả (sanitize cả write-time và read-time)", () => {
    const once = sanitizeBlogHtml('<p>a</p><script>alert(1)</script>');

    expect(sanitizeBlogHtml(once)).toBe(once);
  });

  it("chuỗi rỗng/undefined-safe -> trả chuỗi rỗng", () => {
    expect(sanitizeBlogHtml("")).toBe("");
  });
});

describe("sanitizeBlogHtml — allow-listed tags (AC7)", () => {
  it("giữ nguyên byte-for-byte đoạn HTML chỉ gồm tag/attribute được phép", () => {
    const allowed =
      "<h1>Tiêu đề 1</h1>" +
      "<h2>Tiêu đề 2</h2>" +
      "<h3>Tiêu đề 3</h3>" +
      "<h4>Tiêu đề 4</h4>" +
      "<h5>Tiêu đề 5</h5>" +
      "<h6>Tiêu đề 6</h6>" +
      "<p>Đoạn văn <b>đậm</b> <strong>rất đậm</strong> <i>nghiêng</i> <em>nhấn</em></p>" +
      '<p><a href="https://nutein.vn/blog">liên kết</a></p>' +
      "<ul><li>gạch đầu dòng 1</li><li>gạch đầu dòng 2</li></ul>" +
      "<ol><li>số 1</li><li>số 2</li></ol>" +
      '<img src="https://res.cloudinary.com/c/image/upload/a.jpg" alt="ảnh minh hoạ" />';

    expect(sanitizeBlogHtml(allowed)).toBe(allowed);
  });

  it("giữ href http/https/mailto và src ảnh https", () => {
    const output = sanitizeBlogHtml(
      '<a href="http://a.com">a</a><a href="https://b.com">b</a><a href="mailto:c@d.com">c</a>',
    );

    expect(output).toContain('href="http://a.com"');
    expect(output).toContain('href="https://b.com"');
    expect(output).toContain('href="mailto:c@d.com"');
  });
});
