import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/src/cache/redis";
import { logger } from "@/src/logging/logger";

type CacheKeyBuilder = string | ((req: NextRequest) => string);

const formatResponse = (data: unknown, ttlSecs: number, cacheHit: boolean) => {
  const dataObj =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : { data };
  return {
    ...dataObj,
    cacheAt: new Date(new Date().getTime() + ttlSecs * 1000).toISOString(),
    cacheHit,
  };
};

const parseCachedPayload = (cached: unknown) => {
  if (typeof cached === "string") {
    try {
      return JSON.parse(cached);
    } catch {
      return cached;
    }
  }
  return cached;
};

const getCacheKey = (keyPrefix: CacheKeyBuilder, req: NextRequest) => {
  return typeof keyPrefix === "function" ? keyPrefix(req) : keyPrefix;
};

export const getCachedResponse = async (
  req: NextRequest,
  keyPrefix: CacheKeyBuilder,
  ttlSecs: number,
): Promise<NextResponse | null> => {
  if (!redis) return null;
  try {
    const cacheKey = getCacheKey(keyPrefix, req);
    const cached = await redis.get(cacheKey);

    if (cached !== null && cached !== undefined) {
      const parsedData = parseCachedPayload(cached);
      const responseData = formatResponse(parsedData, ttlSecs, true);
      const response = NextResponse.json(responseData, { status: 200 });
      response.headers.set("X-Cache", "HIT");
      return response;
    }
  } catch (error) {
    logger.error({ err: error }, "Cache read error");
  }
  return null;
};

export const setCachedResponse = async (
  req: NextRequest,
  keyPrefix: CacheKeyBuilder,
  body: unknown,
  ttlSecs: number,
) => {
  if (!redis) return;
  try {
    const cacheKey = getCacheKey(keyPrefix, req);
    // ioredis stores strings only — serialize the payload; reads JSON.parse it back.
    await redis.set(cacheKey, JSON.stringify(body), "EX", ttlSecs);
  } catch (error) {
    logger.error({ err: error }, "Cache write error");
  }
};

export const clearCache = async (keyPrefixes: string[]) => {
  const activeRedis = redis;
  if (!activeRedis) return;
  try {
    await Promise.all(keyPrefixes.map((key) => activeRedis.del(key)));
  } catch (error) {
    logger.error({ err: error }, "Cache clearing error");
  }
};
