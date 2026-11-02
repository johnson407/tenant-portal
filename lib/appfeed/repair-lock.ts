import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

const LOCK_TTL_SECONDS = 120;
const LOCK_PREFIX = "repair:update:";
const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Takes a short lock for one request ID. The lock stops concurrent admin
 * updates to the same repair. It stores no repair data. Returns null when
 * another update holds the lock. Throws when Redis is
 * not configured, so the caller fails closed.
 */
export async function acquireRepairLock(
  requestId: string,
): Promise<(() => Promise<void>) | null> {
  const redis = getRedis();
  if (!redis) throw new Error("KV store is not configured");

  const key = `${LOCK_PREFIX}${requestId}`;
  const token = randomUUID();
  const acquired = await redis.set(key, token, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  if (acquired === null) return null;

  const releaseLock = redis.createScript<number>(RELEASE_LOCK_SCRIPT);
  return async () => {
    await releaseLock.eval([key], [token]);
  };
}
