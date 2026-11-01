import "server-only";
import type { FeedEvent, FeedResult, RoomRepairsResult } from "./types";

export type LatestUpdateKind = "repair-done" | "claim-confirmed";

export type LatestUpdate = FeedEvent & {
  kind: LatestUpdateKind;
};

/**
 * Picks the newest tenant-visible landlord event from the readable sources.
 * A missing source hides only its own events. The claim wins a date tie.
 */
export function selectLatestUpdate(
  feed: FeedResult,
  repairs: RoomRepairsResult,
): LatestUpdate | null {
  const confirmation = feed.kind === "ok" ? feed.feed.lastConfirmation : null;
  const done = repairs.kind === "ok" ? repairs.lastDone : null;

  if (confirmation && done) {
    if (done.date > confirmation.date) {
      return { kind: "repair-done", ...done };
    }
    return { kind: "claim-confirmed", ...confirmation };
  }

  if (confirmation) return { kind: "claim-confirmed", ...confirmation };
  if (done) return { kind: "repair-done", ...done };
  return null;
}
