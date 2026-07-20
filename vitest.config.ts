import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "./vitest-stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    env: {
      // Secret riêng cho test — KHÔNG đọc từ .env thật (vitest không tự load
      // .env như Next.js dev server); tách biệt để test không phụ thuộc/rò rỉ
      // secret thật. Dùng cho features/auth/services/jwt.service.test.ts.
      ACCESS_TOKEN_SECRET: "test-only-access-token-secret-do-not-use-in-prod",
      REFRESH_TOKEN_SECRET: "test-only-refresh-token-secret-do-not-use-in-prod",
      EXPIRE_ACCESS_TOKEN: "15m",
      EXPIRE_REFRESH_TOKEN: "7d",
    },
  },
});
