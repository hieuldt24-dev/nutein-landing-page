// @vitest-environment node
// route.ts -> lib/cloudinary.ts có `import "server-only"`, chặn import ở jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requireRole: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/src/middlewares/authenticate.middlware", () => ({
  authenticate: mocks.authenticate,
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/cloudinary", () => ({
  isCloudinaryConfigured: true,
  cloudinary: { uploader: { upload: mocks.upload } },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

/**
 * H3 — route nay sniff magic bytes, nên fixture phải là PNG THẬT (signature +
 * chunk IHDR), không phải vài byte ngẫu nhiên như trước.
 */
function pngBytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(64);
  const view = Buffer.from(bytes.buffer);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(view);
  view.writeUInt32BE(13, 8);
  view.write("IHDR", 12, "ascii");
  return bytes;
}

function asBytes(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

/** Multipart request có field `file` là 1 ảnh PNG nhỏ hợp lệ. */
function uploadRequest(bytes: Uint8Array<ArrayBuffer> = pngBytes(), type = "image/png") {
  const form = new FormData();
  form.append("file", new File([bytes], "a.png", { type }));
  return new NextRequest("http://localhost:3000/api/staff/uploads", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/staff/uploads — F6 error leakage (AC14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({ id: "staff-1", role: "STAFF" });
    mocks.requireRole.mockReturnValue(undefined);
  });

  it("upload thành công -> 201 kèm secure_url", async () => {
    mocks.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/c/image/a.png" });

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.url).toBe("https://res.cloudinary.com/c/image/a.png");
  });

  it("SDK Cloudinary throw lỗi có chi tiết nội bộ -> message gửi client là generic, không chứa chi tiết SDK", async () => {
    const sdkDetail = "api_key 123456789 invalid at https://api.cloudinary.com/v1_1/secret-cloud";
    mocks.upload.mockRejectedValue(new Error(sdkDetail));

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).toBe("Tải ảnh lên thất bại — vui lòng thử lại sau.");
    expect(JSON.stringify(body)).not.toContain("api_key");
    expect(JSON.stringify(body)).not.toContain("secret-cloud");
  });

  it("message generic không đổi theo nội dung lỗi SDK (fixed message)", async () => {
    mocks.upload.mockRejectedValue(new Error("một lỗi hoàn toàn khác"));

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).toBe("Tải ảnh lên thất bại — vui lòng thử lại sau.");
    expect(JSON.stringify(body)).not.toContain("một lỗi hoàn toàn khác");
  });

  // H3 — PDF đổi đuôi .png + spoof Content-Type: header qua được pre-filter
  // nhưng magic bytes thì không.
  it("PDF giả dạng image/png -> 400, không gọi Cloudinary", async () => {
    const pdf = asBytes("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n");

    const response = await POST(uploadRequest(pdf, "image/png"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toContain("Chỉ chấp nhận file ảnh");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  // E3 — data URI phải dựng từ MIME đã sniff, không phải `file.type` client gửi.
  it("data URI gửi Cloudinary dùng MIME đã sniff, không dùng file.type giả", async () => {
    mocks.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/c/image/a.png" });

    // File là PNG thật nhưng client khai gian là image/webp.
    await POST(uploadRequest(pngBytes(), "image/webp"));

    const [dataUri] = mocks.upload.mock.calls[0];
    expect(dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("Cloudinary chưa cấu hình -> message generic, không lộ tên biến môi trường", async () => {
    vi.resetModules();
    vi.doMock("@/src/middlewares/authenticate.middlware", () => ({
      authenticate: mocks.authenticate,
      requireRole: mocks.requireRole,
    }));
    vi.doMock("@/lib/cloudinary", () => ({
      isCloudinaryConfigured: false,
      cloudinary: { uploader: { upload: mocks.upload } },
    }));

    const { POST: PostUnconfigured } = await import("./route");
    const response = await PostUnconfigured(uploadRequest());
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body.error.message).toBe("Tải ảnh lên thất bại — vui lòng thử lại sau.");
    expect(raw).not.toContain("CLOUDINARY_CLOUD_NAME");
    expect(raw).not.toContain("API_SECRET");

    vi.doUnmock("@/lib/cloudinary");
    vi.resetModules();
  });
});
