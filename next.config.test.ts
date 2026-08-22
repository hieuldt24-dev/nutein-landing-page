// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * F7 — Cloudinary remotePatterns phải được scope theo cloud name của project,
 * không để "/**" (mở proxy ảnh cho mọi tài khoản Cloudinary).
 */

const CLOUD_NAME = "nutein-test-cloud";

type RemotePattern = { protocol?: string; hostname: string; pathname?: string };

async function loadCloudinaryPattern(): Promise<RemotePattern> {
  vi.resetModules();
  const mod = await import("./next.config");
  const config = mod.default as {
    images?: { remotePatterns?: RemotePattern[] };
  };
  const patterns = config.images?.remotePatterns ?? [];
  const cloudinary = patterns.find((p) => p.hostname === "res.cloudinary.com");
  if (!cloudinary) throw new Error("Cloudinary remotePattern not found in next.config");
  return cloudinary;
}

/** Kiểm tra pathname pattern kiểu next/image ("/foo/**") có khớp path không. */
function pathnameMatches(pattern: string, pathname: string): boolean {
  const escaped = pattern
    .split("**")
    .map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(pathname);
}

describe("next.config.ts — Cloudinary remotePatterns (F7)", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", CLOUD_NAME);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // AC15
  it("scopes remotePatterns.pathname to this project's own cloud-name segment instead of a bare /**", async () => {
    const pattern = await loadCloudinaryPattern();

    expect(pattern.protocol).toBe("https");
    expect(pattern.hostname).toBe("res.cloudinary.com");
    expect(pattern.pathname).not.toBe("/**");
    expect(pattern.pathname).toBe(`/${CLOUD_NAME}/**`);
  });

  // AC16
  it("still matches an own-cloud image URL through the scoped pattern, and rejects another cloud", async () => {
    const pattern = await loadCloudinaryPattern();
    const pathnamePattern = pattern.pathname as string;

    expect(pathnameMatches(pathnamePattern, `/${CLOUD_NAME}/image/upload/v1/products/a.jpg`)).toBe(
      true,
    );
    expect(pathnameMatches(pathnamePattern, `/${CLOUD_NAME}/video/upload/v1/blog/b.mp4`)).toBe(true);
    expect(pathnameMatches(pathnamePattern, "/attacker-cloud/image/upload/v1/evil.jpg")).toBe(false);
  });
});
