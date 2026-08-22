import { describe, it, expect } from "vitest";
import { ALLOWED_IMAGE_MIMES, sniffImageType } from "./sniff-image-type";

/** Header thật của từng định dạng + padding cho đủ độ dài `file-type` cần. */
function pad(header: number[], size = 64): Buffer {
  const buf = Buffer.alloc(size);
  Buffer.from(header).copy(buf);
  return buf;
}

function pngHeader(): Buffer {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf);
  buf.writeUInt32BE(13, 8); // độ dài chunk IHDR
  buf.write("IHDR", 12, "ascii");
  return buf;
}

const PNG = pngHeader();
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

function riffWebp(): Buffer {
  const buf = Buffer.alloc(64);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(56, 4);
  buf.write("WEBPVP8 ", 8, "ascii");
  return buf;
}

function ftypAvif(): Buffer {
  const buf = Buffer.alloc(64);
  buf.writeUInt32BE(32, 0);
  buf.write("ftypavif", 4, "ascii");
  buf.write("avifmif1miaf", 12, "ascii");
  return buf;
}

describe("sniffImageType", () => {
  it("PNG header -> image/png", async () => {
    await expect(sniffImageType(PNG)).resolves.toBe("image/png");
  });

  it("JPEG header -> image/jpeg", async () => {
    await expect(sniffImageType(JPEG)).resolves.toBe("image/jpeg");
  });

  it("GIF header -> image/gif", async () => {
    await expect(sniffImageType(GIF)).resolves.toBe("image/gif");
  });

  it("WebP (RIFF....WEBP) -> image/webp", async () => {
    await expect(sniffImageType(riffWebp())).resolves.toBe("image/webp");
  });

  it("AVIF (ftypavif) -> image/avif", async () => {
    await expect(sniffImageType(ftypAvif())).resolves.toBe("image/avif");
  });

  // H3 — đây là kịch bản tấn công: PDF đổi đuôi .png + spoof Content-Type.
  it("PDF header -> null (không nằm trong allowlist ảnh)", async () => {
    const pdf = Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n", "binary");
    await expect(sniffImageType(pdf)).resolves.toBeNull();
  });

  it("plain text buffer -> null", async () => {
    await expect(sniffImageType(Buffer.from("hello world, definitely not an image"))).resolves.toBeNull();
  });

  it("buffer rỗng -> null", async () => {
    await expect(sniffImageType(Buffer.alloc(0))).resolves.toBeNull();
  });

  it("allowlist đúng 5 định dạng ảnh", () => {
    expect([...ALLOWED_IMAGE_MIMES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
    ]);
  });
});
