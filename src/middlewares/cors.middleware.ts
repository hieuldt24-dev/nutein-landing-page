import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

export const applyCors = (req: NextRequest, res: NextResponse): NextResponse => {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id");
  }
  return res;
};

export const handleCorsPreflight = (req: NextRequest): NextResponse | null => {
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    return applyCors(req, res);
  }
  return null;
};
