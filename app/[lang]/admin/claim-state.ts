export type ClaimConfirmError =
  | "date"
  | "note"
  | "not-found"
  | "paid"
  | "unavailable"
  | "rate"
  | "generic";

export type ClaimConfirmState =
  | { status: "idle" }
  | { status: "error"; message: ClaimConfirmError }
  | { status: "success" };

export const GENERIC_CLAIM_CONFIRM_ERROR = "generic" as const;
