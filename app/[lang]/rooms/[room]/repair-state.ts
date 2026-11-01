export type RepairError =
  | "category"
  | "note"
  | "unavailable"
  | "rate"
  | "generic";

export type RepairState =
  | { status: "idle" }
  | { status: "error"; message: RepairError }
  | { status: "success" };

export const GENERIC_REPAIR_ERROR = "generic" as const;
