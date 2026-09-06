import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const alias = {
  "@": path.resolve(__dirname, "."),
  "server-only": path.resolve(__dirname, "./vitest-stubs/server-only.ts"),
};

/**
 * Secret riêng cho test — KHÔNG đọc từ .env thật (vitest không tự load .env như
 * Next.js dev server); tách biệt để test không phụ thuộc/rò rỉ secret thật.
 * Dùng cho features/auth/services/jwt.service.test.ts.
 */
const testEnv = {
  ACCESS_TOKEN_SECRET: "test-only-access-token-secret-do-not-use-in-prod",
  REFRESH_TOKEN_SECRET: "test-only-refresh-token-secret-do-not-use-in-prod",
  EXPIRE_ACCESS_TOKEN: "15m",
  EXPIRE_REFRESH_TOKEN: "7d",
};

/**
 * HAI project tách biệt (RFC-2 / execute-instruction E4):
 *
 * - `unit`        — mọi test co-located; chạy mặc định qua `npm test`. LOẠI TRỪ
 *                   `tests/integration/**` để test cần Postgres thật không làm
 *                   đỏ suite trên máy không có DB.
 * - `integration` — chỉ `tests/integration/**`, chạy riêng qua
 *                   `npm run test:integration`. Cần `TEST_DATABASE_URL`; nếu
 *                   thiếu, các test tự skip thay vì fail.
 *
 * `npm test` cố ý dùng `--project unit` (không phải `vitest run` trần) vì
 * `vitest run` không tham số sẽ chạy CẢ HAI project.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          css: false,
          exclude: ["**/node_modules/**", "**/dist/**", "tests/integration/**"],
          env: testEnv,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Race/lock fixtures dùng nhiều connection pg độc lập trên CÙNG một
          // database; chạy song song nhiều file sẽ làm nhiễu lẫn nhau.
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 120_000,
          env: testEnv,
        },
      },
    ],
  },
});
