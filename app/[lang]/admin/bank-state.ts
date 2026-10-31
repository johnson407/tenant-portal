export type BankAccountError = "invalid" | "generic";

export type BankAccountState =
  | { status: "idle" }
  | { status: "error"; message: BankAccountError }
  | { status: "success" };

export const GENERIC_BANK_ERROR = "generic" as const;
