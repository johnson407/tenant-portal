export type ClaimError = "date" | "suffix" | "generic";

export type ClaimState =
  | { status: "idle" }
  | { status: "error"; message: ClaimError }
  | { status: "success" };

export const GENERIC_CLAIM_ERROR = "generic" as const;
