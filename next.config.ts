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
    // Ảnh upload staff (sản phẩm / blog) trả về từ Cloudinary.
    // Chỉ cho phép cloud name của chính project (URL Cloudinary có dạng
    // https://res.cloudinary.com/<cloud_name>/...) — chặn proxy ảnh của tài
    // khoản Cloudinary khác. Nếu CLOUDINARY_CLOUD_NAME chưa set, pattern trở
    // thành "/undefined/**" (không khớp gì) — fail-safe, giống convention
    // isCloudinaryConfigured ở lib/cloudinary.ts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/**`,
      },
    ],
  },
};

export default nextConfig;
