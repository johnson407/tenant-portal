import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  saveBankAccount: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/bank-account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-account")>();
  return {
    ...actual,
    saveBankAccount: mocks.saveBankAccount,
  };
});

import { saveBankAccountAction } from "@/app/[lang]/admin/bank-actions";
import { GENERIC_BANK_ERROR } from "@/app/[lang]/admin/bank-state";

const VALID = {
  bankName: "玉山銀行",
  recipientName: "王小明",
  bankCode: "808",
  accountNo: "0123456789012",
};

function form(overrides: Partial<Record<keyof typeof VALID, string>> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });
  mocks.saveBankAccount.mockResolvedValue(undefined);
});

describe("saveBankAccountAction", () => {
  it("saves a valid record and reports success", async () => {
    const result = await saveBankAccountAction("zh-TW", { status: "idle" }, form());

    expect(result).toEqual({ status: "success" });
    expect(mocks.saveBankAccount).toHaveBeenCalledWith(VALID);
  });

  it("trims surrounding whitespace before saving", async () => {
    await saveBankAccountAction(
      "en",
      { status: "idle" },
      form({ bankName: "  玉山銀行  ", bankCode: " 808 " }),
    );

    expect(mocks.saveBankAccount).toHaveBeenCalledWith(VALID);
  });

  it("rejects a tenant session before reading or writing bank data", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 0, exp: 1 });

    const result = await saveBankAccountAction("zh-TW", { status: "idle" }, form({ bankCode: "x" }));

    expect(result).toEqual({ status: "error", message: GENERIC_BANK_ERROR });
    expect(mocks.saveBankAccount).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller without writing", async () => {
    mocks.getSessionClaims.mockResolvedValue(null);

    const result = await saveBankAccountAction("zh-TW", { status: "idle" }, form());

    expect(result).toEqual({ status: "error", message: GENERIC_BANK_ERROR });
    expect(mocks.saveBankAccount).not.toHaveBeenCalled();
  });

  it("returns an invalid code for each malformed field without writing", async () => {
    const cases = [
      { bankName: "   " },
      { recipientName: "" },
      { bankCode: "80a" },
      { accountNo: "012-345" },
    ];

    for (const overrides of cases) {
      const result = await saveBankAccountAction("zh-TW", { status: "idle" }, form(overrides));
      expect(result).toEqual({ status: "error", message: "invalid" });
    }
    expect(mocks.saveBankAccount).not.toHaveBeenCalled();
  });

  it("returns a generic error without leaking values when the write fails", async () => {
    mocks.saveBankAccount.mockRejectedValue(new Error("kv down"));

    const result = await saveBankAccountAction("zh-TW", { status: "idle" }, form());

    expect(result).toEqual({ status: "error", message: GENERIC_BANK_ERROR });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(VALID.recipientName);
    expect(serialized).not.toContain(VALID.accountNo);
  });
});
