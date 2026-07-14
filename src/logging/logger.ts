import pino from "pino";

/**
 * Logger tập trung sử dụng Pino - thư viện logging hiệu suất cao cho Node.js.
 *
 * - Development: Output dạng human-readable (màu sắc, dễ đọc) nhờ pino-pretty
 * - Production: Output dạng JSON thuần để dễ thu thập bởi log aggregators
 *
 * Sử dụng:
 *   import { logger } from "@/src/logging/logger";
 *   logger.info("Server started");
 *   logger.error({ err }, "Something went wrong");
 */
const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:dd/mm/yyyy HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

/**
 * Tạo child logger với context cụ thể (ví dụ: per-request, per-feature)
 * Ví dụ: const reqLogger = createChildLogger({ requestId: "abc123" });
 */
export function createChildLogger(bindings: pino.Bindings): pino.Logger {
  return logger.child(bindings);
}
