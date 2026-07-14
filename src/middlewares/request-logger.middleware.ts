import { NextRequest } from "next/server";
import { logger } from "@/src/logging/logger";

export const getRequestLogger = (req: NextRequest, reqId: string) => {
  return logger.child({ reqId });
};
