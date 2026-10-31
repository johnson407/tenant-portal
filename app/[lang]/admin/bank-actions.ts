"use server";

import { parseBankAccount, saveBankAccount } from "@/lib/bank-account";
import { getSessionClaims } from "@/lib/session-cookies";

import { GENERIC_BANK_ERROR, type BankAccountState } from "./bank-state";

export async function saveBankAccountAction(
  localeInput: string,
  _previous: BankAccountState,
  formData: FormData,
): Promise<BankAccountState> {
  void localeInput;
  void _previous;

  const claims = await getSessionClaims();
  if (claims?.role !== "admin") {
    return { status: "error", message: GENERIC_BANK_ERROR };
  }

  const parsed = parseBankAccount({
    bankName: formData.get("bankName"),
    recipientName: formData.get("recipientName"),
    bankCode: formData.get("bankCode"),
    accountNo: formData.get("accountNo"),
  });
  if (!parsed.ok) {
    return { status: "error", message: "invalid" };
  }

  try {
    await saveBankAccount(parsed.value);
  } catch {
    return { status: "error", message: GENERIC_BANK_ERROR };
  }

  return { status: "success" };
}
