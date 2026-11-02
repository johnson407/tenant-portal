import type { RoomLetter } from "../rooms";

export type BillClaim = {
  claimedOn: string;
  bankLast5: string;
};

export type UtilityBreakdown = {
  start: number;
  end: number;
  units: number;
  rate: number;
};

export type FeedBill = {
  period: string;
  rent: number;
  water: number | null;
  electricity: number | null;
  total: number;
  dueDate: string;
  claim: BillClaim | null;
  waterBreakdown: UtilityBreakdown | null;
  electricityBreakdown: UtilityBreakdown | null;
};

export type PendingClaim = {
  room: RoomLetter;
  period: string;
  claimedOn: string;
  bankLast5: string;
};

export type RepairCategory = "plumbing" | "electrical" | "appliance" | "other";

export type RepairStatus = "pending" | "scheduled" | "in_progress" | "done";

export type RepairInput = {
  category: RepairCategory;
  note: string;
};

export type NewRepair = {
  room: RoomLetter;
  requestId: string;
  category: RepairCategory;
  note: string;
  submittedOn: string;
};

export type RoomRepair = {
  requestId: string;
  category: RepairCategory;
  note: string;
  submittedOn: string;
  status: RepairStatus;
  visitStart: string | null;
  visitEnd: string | null;
  doneOn: string | null;
};

export type AdminRepair = {
  room: RoomLetter;
  requestId: string;
  category: RepairCategory;
  note: string;
  submittedOn: string;
  status: RepairStatus;
  visitStart: string | null;
  visitEnd: string | null;
  doneOn: string | null;
  expenseAmount: number | null;
};

export type PendingRepair = Pick<
  AdminRepair,
  "room" | "requestId" | "category" | "note" | "submittedOn"
>;

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

/** One tenant-visible event with its event date and optional note. */
export type FeedEvent = {
  date: string;
  note: string | null;
};

export type RoomFeed = {
  room: RoomLetter;
  openBills: FeedBill[];
  payments: FeedPayment[];
  lease: FeedLease | null;
  lastConfirmation: FeedEvent | null;
  fetchedAt: string;
};

export type FeedResult =
  | { kind: "ok"; feed: RoomFeed }
  | { kind: "unavailable" };

export type RoomRepairsResult =
  | { kind: "ok"; repairs: RoomRepair[]; lastDone: FeedEvent | null }
  | { kind: "unavailable" };

export type AdminRepairsResult =
  | { kind: "ok"; repairs: AdminRepair[]; expenseTotal: number }
  | { kind: "denied" }
  | { kind: "unavailable" };

export type PendingRepairsResult =
  | { kind: "ok"; repairs: PendingRepair[] }
  | { kind: "denied" }
  | { kind: "unavailable" };

export type LeaseRenewal = {
  room: RoomLetter;
  end: string;
};

export type AdminLeaseRenewalsResult =
  | { kind: "ok"; renewals: LeaseRenewal[] }
  | { kind: "denied" }
  | { kind: "unavailable" };

/** Raw rows from the two fixed ranges, including each header row. */
export type AppFeedSnapshot = {
  bills: unknown[][];
  leases: unknown[][];
};

/** Raw rows from the fixed Repairs range, including its header row. */
export type RepairsSnapshot = {
  repairs: unknown[][];
};

export type SnapshotFailureReason =
  | "config"
  | "auth"
  | "quota"
  | "server"
  | "timeout"
  | "network"
  | "wrong-file"
  | "headers"
  | "missing-tab";

export type SnapshotFailure = {
  kind: "unavailable";
  reason: SnapshotFailureReason;
  transient: boolean;
};

export type SnapshotResult =
  | { kind: "ok"; snapshot: AppFeedSnapshot }
  | SnapshotFailure;

export type RepairsSnapshotResult =
  | { kind: "ok"; snapshot: RepairsSnapshot }
  | SnapshotFailure;
