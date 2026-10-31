export type AdminLoginState = { error?: string };

export type AdminResetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; room: string; code: string };

export const GENERIC_ADMIN_LOGIN_ERROR = "Access denied";
export const GENERIC_ADMIN_RESET_ERROR = "Access denied";
