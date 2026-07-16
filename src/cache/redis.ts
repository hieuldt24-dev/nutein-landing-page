import Redis from "ioredis";
import { logger } from "@/src/logging/logger";

const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: true, // Don't connect immediately on startup
    });

    redis.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Redis client");
    redis = null;
  }
} else {
  logger.info("REDIS_URL is not set. Redis caching and rate limiting are disabled.");
}

export { redis };
