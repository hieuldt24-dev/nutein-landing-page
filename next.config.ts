import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Logo/icon/favicon hiện tại là SVG tĩnh trong public/images — cần bật để
    // next/image tối ưu được, các SVG này do team tự tạo/kiểm soát nội dung.
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
