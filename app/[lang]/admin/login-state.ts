export type AdminLoginState = { error?: "access-denied" };

export type AdminResetError = "access-denied" | "invalid-room";

export type AdminResetState =
  | { status: "idle" }
  | { status: "error"; message: AdminResetError }
  | { status: "success"; room: string; code: string };

export const GENERIC_ADMIN_LOGIN_ERROR = "access-denied" as const;
export const GENERIC_ADMIN_RESET_ERROR = "access-denied" as const;
