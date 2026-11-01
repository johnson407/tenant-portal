export type RepairDoneError =
  | "already-done"
  | "not-found"
  | "invalid-note"
  | "unavailable"
  | "rate"
  | "generic";

export type RepairDoneState =
  | { status: "idle" }
  | { status: "error"; message: RepairDoneError }
  | { status: "success" };

export const GENERIC_REPAIR_DONE_ERROR = "generic" as const;
