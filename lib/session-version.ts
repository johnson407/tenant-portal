import { Redis } from "@upstash/redis";
import type { RoomLetter } from "./rooms";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function versionKey(room: RoomLetter): string {
  const prefix = process.env.KV_ROOM_KEY_PREFIX || "room:";
  return `${prefix}${room}:session-version`;
}

function requireRedis(): Redis {
  const redis = getRedis();
  if (!redis) throw new Error("KV store is not configured");
  return redis;
}

export async function getRoomSessionVersion(room: RoomLetter): Promise<number> {
  const value = await requireRedis().get<number | string>(versionKey(room));
  const version = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(version) && version >= 0 ? version : 0;
}

export async function bumpRoomSessionVersion(room: RoomLetter): Promise<number> {
  return await requireRedis().incr(versionKey(room));
}
