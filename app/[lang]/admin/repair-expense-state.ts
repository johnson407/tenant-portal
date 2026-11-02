export type RepairExpenseError =
  | "not-found"
  | "not-done"
  | "invalid-amount"
  | "unavailable"
  | "rate"
  | "generic";

export type RepairExpenseState =
  | { status: "idle" }
  | { status: "error"; message: RepairExpenseError }
  | { status: "success" };
