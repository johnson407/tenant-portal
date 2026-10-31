import { Redis } from "@upstash/redis";
import { ROOM_UPPER, type RoomLetter } from "./rooms";

export const NO_CODE_CONFIGURED_MESSAGE = "No access code configured for this room";

export const PASSWORD_HASH_COST = 12;

function roomKeyPrefix(): string {
  return process.env.KV_ROOM_KEY_PREFIX || "room:";
}

export function roomKey(room: RoomLetter): string {
  return `${roomKeyPrefix()}${room}`;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function seededHashFor(room: RoomLetter): string | null {
  const value = process.env[`ROOM_CODE_HASH_${ROOM_UPPER[room]}`];
  return typeof value === "string" && value.length > 0 ? value : null;
}

let warnedMissingRedis = false;

export async function getStoredHash(room: RoomLetter): Promise<string | null> {
  const redis = getRedis();
  if (!redis) {
    if (!warnedMissingRedis) console.error("KV_REST_API_URL/KV_REST_API_TOKEN not configured");
    warnedMissingRedis = true;
    throw new Error("KV store is not configured");
  }

  const key = roomKey(room);
  let stored: string | null = null;
  try {
    stored = await redis.get<string>(key);
  } catch (err) {
    console.error("KV read failed");
    throw err;
  }
  if (typeof stored === "string" && stored.length > 0) return stored;

  const seeded = seededHashFor(room);
  if (!seeded) return null;

  const wrote = await redis.set(key, seeded, { nx: true });
  if (wrote !== null) return seeded;
  return await redis.get<string>(key);
}

export async function setStoredHash(room: RoomLetter, hash: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("KV store is not configured");
  await redis.set(roomKey(room), hash);
}
