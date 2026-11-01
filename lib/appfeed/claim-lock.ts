import "server-only";
import { Redis } from "@upstash/redis";

const LOCK_TTL_SECONDS = 90;
const LOCK_PREFIX = "claim:confirm:";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Takes a short lock for one room and billing period. The lock stops two
 * admins from confirming the same claim at the same time. It stores no bill
 * data. Returns null when another confirmation holds the lock. Throws when
 * Redis is not configured, so the caller fails closed.
 */
export async function acquireClaimConfirmLock(
  room: string,
  period: string,
): Promise<(() => Promise<void>) | null> {
  const redis = getRedis();
  if (!redis) throw new Error("KV store is not configured");

  const key = `${LOCK_PREFIX}${room}:${period}`;
  const acquired = await redis.set(key, "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  if (acquired === null) return null;

  return async () => {
    await redis.del(key);
  };
}
