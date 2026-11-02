import { Redis } from "@upstash/redis";

export type RateBucket = {
  prefix: string;
  maxAttempts: number;
  windowSeconds: number;
};

export const LOGIN_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:login",
  maxAttempts: 10,
  windowSeconds: 15 * 60,
};

export const ADMIN_LOGIN_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:admin-login",
  maxAttempts: 10,
  windowSeconds: 15 * 60,
};

export const ADMIN_RESET_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:admin-reset",
  maxAttempts: 10,
  windowSeconds: 15 * 60,
};

export const CLAIM_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:claim",
  maxAttempts: 10,
  windowSeconds: 15 * 60,
};

export const CLAIM_CONFIRM_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:claim-confirm",
  maxAttempts: 60,
  windowSeconds: 15 * 60,
};

export const REPAIR_SUBMIT_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:repair-submit",
  maxAttempts: 10,
  windowSeconds: 15 * 60,
};

export const REPAIR_DONE_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:repair-done",
  maxAttempts: 60,
  windowSeconds: 15 * 60,
};

export const REPAIR_ADMIN_UPDATE_RATE_BUCKET: RateBucket = {
  prefix: "ratelimit:repair-admin-update",
  maxAttempts: 60,
  windowSeconds: 15 * 60,
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number | null;
};

const MAX_BACKOFF_SECONDS = 30 * 60;

// After exhausting maxAttempts, each further failure doubles the lockout:
// 1 min, 2 min, 4 min, ... up to 30 min.
export function backoffSecondsFor(attempts: number, bucket: RateBucket): number {
  if (attempts <= bucket.maxAttempts) return 0;
  const overshoot = attempts - bucket.maxAttempts;
  return Math.min(60 * 2 ** (overshoot - 1), MAX_BACKOFF_SECONDS);
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function attemptsKey(bucket: RateBucket, key: string): string {
  return `${bucket.prefix}:${key}:attempts`;
}

function lockKey(bucket: RateBucket, key: string): string {
  return `${bucket.prefix}:${key}:lock`;
}

// Atomically registers one attempt for every key and returns whether all keys
// are still under their limit. The increment happens before the caller checks
// credentials, so concurrent submissions cannot all pass a stale read.
export async function consumeAttempt(
  bucket: RateBucket,
  keys: string[],
  nowEpochMs: number = Date.now(),
): Promise<RateLimitDecision> {
  const redis = getRedis();
  if (!redis || keys.length === 0) throw new Error("KV store is not configured");

  const retries = await Promise.all(
    keys.map(async (key) => {
      const attempts = await redis.incr(attemptsKey(bucket, key));
      await redis.expire(attemptsKey(bucket, key), bucket.windowSeconds);

      const existingLock = await redis.get<number>(lockKey(bucket, key));
      let retryAfter = 0;
      if (typeof existingLock === "number" && existingLock * 1000 > nowEpochMs) {
        retryAfter = Math.ceil((existingLock * 1000 - nowEpochMs) / 1000);
      }

      if (typeof attempts === "number" && attempts > bucket.maxAttempts) {
        const lockExpired = !(typeof existingLock === "number" && existingLock * 1000 > nowEpochMs);
        const backoff = backoffSecondsFor(attempts, bucket);
        if (lockExpired) {
          await redis.set(
            lockKey(bucket, key),
            Math.floor(nowEpochMs / 1000) + backoff,
            { ex: backoff },
          );
        }
        retryAfter = Math.max(retryAfter, backoff);
      }

      return retryAfter;
    }),
  );

  const retryAfterSeconds = Math.max(0, ...retries);
  return retryAfterSeconds > 0
    ? { allowed: false, retryAfterSeconds }
    : { allowed: true, retryAfterSeconds: null };
}

export async function clearRateLimit(bucket: RateBucket, keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  await Promise.all(
    keys.flatMap((key) => [redis.del(attemptsKey(bucket, key)), redis.del(lockKey(bucket, key))]),
  );
}
