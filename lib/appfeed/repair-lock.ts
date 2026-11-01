import "server-only";
import { Redis } from "@upstash/redis";

const LOCK_TTL_SECONDS = 30;
const LOCK_PREFIX = "repair:done:";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Takes a short lock for one request ID. The lock stops two admins from
 * completing the same request at the same time. It stores no repair data.
 * Returns null when another completion holds the lock. Throws when Redis is
 * not configured, so the caller fails closed.
 */
export async function acquireRepairDoneLock(
  requestId: string,
): Promise<(() => Promise<void>) | null> {
  const redis = getRedis();
  if (!redis) throw new Error("KV store is not configured");

  const key = `${LOCK_PREFIX}${requestId}`;
  const acquired = await redis.set(key, "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  if (acquired === null) return null;

  return async () => {
    await redis.del(key);
  };
}
