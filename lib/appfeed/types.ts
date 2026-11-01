import type { RoomLetter } from "../rooms";

export type BillClaim = {
  claimedOn: string;
  bankLast5: string;
};

export type FeedBill = {
  period: string;
  rent: number;
  water: number | null;
  electricity: number | null;
  total: number;
  dueDate: string;
  claim: BillClaim | null;
};

export type PendingClaim = {
  room: RoomLetter;
  period: string;
  claimedOn: string;
  bankLast5: string;
};

export type FeedPayment = {
  period: string;
  amount: number;
  receivedOn: string;
};

export type FeedLease = {
  start: string;
  end: string;
  renewalDue: string | null;
};

export type RoomFeed = {
  room: RoomLetter;
  openBills: FeedBill[];
  payments: FeedPayment[];
  lease: FeedLease | null;
  fetchedAt: string;
};

export type FeedResult =
  | { kind: "ok"; feed: RoomFeed }
  | { kind: "unavailable" };

/** Raw rows from the two fixed ranges, including each header row. */
export type AppFeedSnapshot = {
  bills: unknown[][];
  leases: unknown[][];
};

export type SnapshotFailureReason =
  | "config"
  | "auth"
  | "quota"
  | "server"
  | "timeout"
  | "network"
  | "wrong-file"
  | "headers";

export type SnapshotFailure = {
  kind: "unavailable";
  reason: SnapshotFailureReason;
  transient: boolean;
};

export type SnapshotResult =
  | { kind: "ok"; snapshot: AppFeedSnapshot }
  | SnapshotFailure;
