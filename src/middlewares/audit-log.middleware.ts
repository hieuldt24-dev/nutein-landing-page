import { logger } from "@/src/logging/logger";

export interface AuditLogOptions {
  action: string;
  userId?: string;
  ip?: string;
  resource?: string;
  statusCode: number;
  duration: number;
  url: string;
}

export const logAudit = (options: AuditLogOptions) => {
  if (options.statusCode < 400) {
    logger.info({ audit: options }, "Audit Log");
  }
};
