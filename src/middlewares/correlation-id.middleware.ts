import { NextRequest, NextResponse } from "next/server";

export const getCorrelationId = (req: NextRequest): string => {
  return req.headers.get("x-request-id") || crypto.randomUUID();
};

export const setCorrelationIdHeader = (res: NextResponse, id: string): NextResponse => {
  res.headers.set("x-request-id", id);
  return res;
};
