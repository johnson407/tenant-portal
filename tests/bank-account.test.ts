import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBankAccount, parseBankAccount, saveBankAccount } from "@/lib/bank-account";

const state = vi.hoisted(() => ({
  storage: new Map<string, Record<string, string>>(),
  hgetall: vi.fn(),
  hset: vi.fn(),
  failRead: false,
  failWrite: false,
  rawOverride: null as unknown[] | null,
}));

vi.mock("@upstash/redis", () => {
  class Redis {
    url: string;
    token: string;
    automaticDeserialization: boolean;
    constructor(opts: { url: string; token: string; automaticDeserialization?: boolean }) {
      this.url = opts.url;
      this.token = opts.token;
      this.automaticDeserialization = opts.automaticDeserialization !== false;
    }
    async hgetall(key: string) {
      state.hgetall(key);
      if (state.failRead) throw new Error("read boom");
      if (state.rawOverride) return state.rawOverride;
      const record = state.storage.get(key);
      if (!record) return this.automaticDeserialization ? {} : [];
      if (!this.automaticDeserialization) return Object.entries(record).flat();
      const parsed: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(record)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }
      return parsed;
    }
    async hset(key: string, value: Record<string, string>) {
      state.hset(key, value);
      if (state.failWrite) throw new Error("write boom");
      state.storage.set(key, { ...value });
      return 1;
    }
  }
  return { Redis };
});

function env(overrides: Record<string, string | undefined>) {
  const base: Record<string, string | undefined> = {
    KV_REST_API_URL: "https://example.test",
    KV_REST_API_TOKEN: "token",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const valid = {
  bankName: "玉山銀行",
  recipientName: "王小明",
  bankCode: "808",
  accountNo: "0123456789012",
};

function expectField(input: Record<string, unknown>, field: string) {
  const result = parseBankAccount(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.field).toBe(field);
}

describe("parseBankAccount", () => {
  it("accepts a valid record and trims every field", () => {
    const result = parseBankAccount({
      bankName: "  玉山銀行  ",
      recipientName: "  王小明  ",
      bankCode: " 808 ",
      accountNo: " 0123456789012 ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        bankName: "玉山銀行",
        recipientName: "王小明",
        bankCode: "808",
        accountNo: "0123456789012",
      },
    });
  });

  it("rejects a missing or non-string field", () => {
    expectField({ ...valid, bankName: undefined }, "bankName");
    expectField({ ...valid, recipientName: 123 }, "recipientName");
    expectField({ ...valid, bankCode: null }, "bankCode");
    expectField({ ...valid, accountNo: {} }, "accountNo");
  });

  it("rejects blank names and codes", () => {
    expectField({ ...valid, bankName: "" }, "bankName");
    expectField({ ...valid, bankName: "   " }, "bankName");
    expectField({ ...valid, recipientName: "\t\n" }, "recipientName");
    expectField({ ...valid, bankCode: "" }, "bankCode");
    expectField({ ...valid, accountNo: "" }, "accountNo");
  });

  it("rejects control characters inside names", () => {
    expectField({ ...valid, bankName: "玉山\n銀行" }, "bankName");
    expectField({ ...valid, recipientName: "王\u0000小明" }, "recipientName");
  });

  it("enforces the 80-character name limit", () => {
    expect(parseBankAccount({ ...valid, bankName: "a".repeat(80) }).ok).toBe(true);
    expect(parseBankAccount({ ...valid, recipientName: "b".repeat(80) }).ok).toBe(true);
    expectField({ ...valid, bankName: "a".repeat(81) }, "bankName");
    expectField({ ...valid, recipientName: "b".repeat(81) }, "recipientName");
  });

  it("only accepts 3 to 7 digit bank codes", () => {
    expect(parseBankAccount({ ...valid, bankCode: "008" }).ok).toBe(true);
    expect(parseBankAccount({ ...valid, bankCode: "1234567" }).ok).toBe(true);
    expectField({ ...valid, bankCode: "12" }, "bankCode");
    expectField({ ...valid, bankCode: "12345678" }, "bankCode");
    expectField({ ...valid, bankCode: "80a" }, "bankCode");
    expectField({ ...valid, bankCode: "8 08" }, "bankCode");
    expectField({ ...valid, bankCode: "808-1" }, "bankCode");
  });

  it("only accepts 6 to 20 digit account numbers", () => {
    expect(parseBankAccount({ ...valid, accountNo: "123456" }).ok).toBe(true);
    expect(parseBankAccount({ ...valid, accountNo: "1".repeat(20) }).ok).toBe(true);
    expectField({ ...valid, accountNo: "12345" }, "accountNo");
    expectField({ ...valid, accountNo: "1".repeat(21) }, "accountNo");
    expectField({ ...valid, accountNo: "012-345" }, "accountNo");
    expectField({ ...valid, accountNo: "012 345" }, "accountNo");
  });
});

describe("bank account storage", () => {
  beforeEach(() => {
    state.storage.clear();
    state.hgetall.mockClear();
    state.hset.mockClear();
    state.failRead = false;
    state.failWrite = false;
    state.rawOverride = null;
    env({});
    vi.restoreAllMocks();
  });

  it("round-trips a record under the fixed bank:account key", async () => {
    await saveBankAccount(valid);
    expect(state.hset).toHaveBeenCalledWith("bank:account", valid);
    await expect(getBankAccount()).resolves.toEqual(valid);
  });

  it("reads numeric-looking values exactly as stored", async () => {
    const numeric = { ...valid, bankCode: "808", accountNo: "1234567890" };
    await saveBankAccount(numeric);
    await expect(getBankAccount()).resolves.toEqual(numeric);
  });

  it("returns null when nothing is stored", async () => {
    await expect(getBankAccount()).resolves.toBeNull();
  });

  it("returns null for a corrupt or partial record", async () => {
    state.storage.set("bank:account", { ...valid, accountNo: "abc" });
    await expect(getBankAccount()).resolves.toBeNull();

    state.storage.set("bank:account", { bankName: valid.bankName });
    await expect(getBankAccount()).resolves.toBeNull();
  });

  it("rejects raw values that are not strings instead of coercing them", async () => {
    state.rawOverride = [
      "bankName",
      valid.bankName,
      "recipientName",
      valid.recipientName,
      "bankCode",
      808,
      "accountNo",
      valid.accountNo,
    ];

    await expect(getBankAccount()).resolves.toBeNull();
  });

  it("rejects a raw hash with an odd number of entries", async () => {
    state.rawOverride = Object.entries(valid).flat().slice(0, -1);

    await expect(getBankAccount()).resolves.toBeNull();
  });

  it("fails closed when KV is not configured without logging values", async () => {
    env({ KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getBankAccount()).rejects.toThrow("KV store is not configured");
    await expect(saveBankAccount(valid)).rejects.toThrow("KV store is not configured");

    expect(state.hgetall).not.toHaveBeenCalled();
    expect(state.hset).not.toHaveBeenCalled();
    const output = logged.mock.calls.flat().join(" ");
    expect(output).not.toContain(valid.recipientName);
    expect(output).not.toContain(valid.accountNo);
  });

  it("throws and logs a fixed reason when the read fails", async () => {
    state.failRead = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getBankAccount()).rejects.toThrow("Bank account read failed");
    expect(logged.mock.calls.flat().join(" ")).toBe("Bank account read failed");
  });

  it("leaves the previous record unchanged when the write fails", async () => {
    await saveBankAccount(valid);
    state.failWrite = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(saveBankAccount({ ...valid, accountNo: "999999" })).rejects.toThrow(
      "Bank account write failed",
    );

    state.failWrite = false;
    await expect(getBankAccount()).resolves.toEqual(valid);
    expect(logged.mock.calls.flat().join(" ")).toBe("Bank account write failed");
  });

  it("rejects saving an invalid record without writing", async () => {
    await expect(saveBankAccount({ ...valid, bankCode: "80" })).rejects.toThrow();
    expect(state.hset).not.toHaveBeenCalled();
  });
});
