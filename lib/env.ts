import "server-only";
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Logging
  LOG_LEVEL: z.enum(["info", "debug", "error", "warn"]).default("info"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Cloudinary (tuỳ chọn - dùng khi upload ảnh sản phẩm/blog)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // SePay (tuỳ chọn - thanh toán chuyển khoản qua QR + webhook đối soát)
  SEPAY_API_TOKEN: z.string().optional(),
  SEPAY_WEBHOOK_API_KEY: z.string().optional(),
  SEPAY_BANK_ACCOUNT_NUMBER: z.string().optional(),
  SEPAY_BANK_CODE: z.string().optional(),
  SEPAY_ACCOUNT_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Cấu hình biến môi trường không hợp lệ:",
    parsed.error.format()
  );
  throw new Error(
    "Cấu hình môi trường không hợp lệ. Vui lòng kiểm tra lại file .env"
  );
}

export const env = parsed.data;
