export type RepairUpdateError =
  | "already-done"
  | "not-found"
  | "invalid-status"
  | "invalid-window"
  | "unavailable"
  | "rate"
  | "generic";

export type RepairUpdateState =
  | { status: "idle" }
  | { status: "error"; message: RepairUpdateError }
  | { status: "success" };
