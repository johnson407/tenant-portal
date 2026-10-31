import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isRoomLetter, type RoomLetter } from "../rooms";
import { fetchAppFeedSnapshot } from "./google";
import type { FeedResult } from "./types";
import { buildRoomFeed } from "./validate";

export class AppFeedUnavailableError extends Error {
  constructor() {
    super("AppFeed unavailable");
    this.name = "AppFeedUnavailableError";
  }
}

/**
 * Returns only the requested room's projection. The sheet is read and filtered
 * inside this cached function; the raw snapshot never escapes.
 */
export async function getRoomFeed(room: RoomLetter): Promise<FeedResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(`appfeed:room:${room}`);

  if (!isRoomLetter(room)) throw new AppFeedUnavailableError();

  const snapshot = await fetchAppFeedSnapshot();

  if (snapshot.kind === "unavailable") {
    if (snapshot.transient) throw new AppFeedUnavailableError();
    return { kind: "unavailable" };
  }

  return buildRoomFeed(snapshot.snapshot, room, new Date().toISOString());
}
