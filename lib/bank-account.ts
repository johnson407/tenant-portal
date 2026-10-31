import { Redis } from "@upstash/redis";

export type BankAccount = {
  bankName: string;
  recipientName: string;
  bankCode: string;
  accountNo: string;
};

export type BankAccountField = keyof BankAccount;

export type ParseBankAccountResult =
  | { ok: true; value: BankAccount }
  | { ok: false; field: BankAccountField };

const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/;
const BANK_CODE = /^\d{3,7}$/;
const ACCOUNT_NO = /^\d{6,20}$/;
const MAX_NAME_LENGTH = 80;

function readField(input: Record<string, unknown>, field: BankAccountField): string | null {
  const value = input[field];
  return typeof value === "string" ? value.trim() : null;
}

function isValidName(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= 1 &&
    value.length <= MAX_NAME_LENGTH &&
    !CONTROL_CHARACTER.test(value)
  );
}

export function parseBankAccount(input: Record<string, unknown>): ParseBankAccountResult {
  const source = input && typeof input === "object" ? input : {};

  const bankName = readField(source, "bankName");
  if (!isValidName(bankName)) return { ok: false, field: "bankName" };

  const recipientName = readField(source, "recipientName");
  if (!isValidName(recipientName)) return { ok: false, field: "recipientName" };

  const bankCode = readField(source, "bankCode");
  if (bankCode === null || !BANK_CODE.test(bankCode)) {
    return { ok: false, field: "bankCode" };
  }

  const accountNo = readField(source, "accountNo");
  if (accountNo === null || !ACCOUNT_NO.test(accountNo)) {
    return { ok: false, field: "accountNo" };
  }

  return { ok: true, value: { bankName, recipientName, bankCode, accountNo } };
}

const BANK_ACCOUNT_KEY = "bank:account";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  // Hash values are digit strings; automatic JSON deserialization would turn
  // "808" into a number and break validation, so read them raw.
  return new Redis({ url, token, automaticDeserialization: false });
}

let warnedMissingRedis = false;

function requireRedis(): Redis {
  const redis = getRedis();
  if (!redis) {
    if (!warnedMissingRedis) console.error("KV store is not configured for bank account");
    warnedMissingRedis = true;
    throw new Error("KV store is not configured");
  }
  return redis;
}

export async function getBankAccount(): Promise<BankAccount | null> {
  const redis = requireRedis();

  let raw: unknown;
  try {
    raw = await redis.hgetall(BANK_ACCOUNT_KEY);
  } catch {
    console.error("Bank account read failed");
    throw new Error("Bank account read failed");
  }

  if (!Array.isArray(raw) || raw.length === 0 || raw.length % 2 !== 0) {
    return null;
  }

  const stored: Record<string, unknown> = {};
  for (let index = 0; index < raw.length; index += 2) {
    const field = raw[index];
    const value = raw[index + 1];
    if (typeof field !== "string" || typeof value !== "string") return null;
    stored[field] = value;
  }

  const parsed = parseBankAccount(stored);
  return parsed.ok ? parsed.value : null;
}

export async function saveBankAccount(record: BankAccount): Promise<void> {
  const parsed = parseBankAccount(record);
  if (!parsed.ok) throw new Error("Invalid bank account record");

  const redis = requireRedis();
  try {
    await redis.hset(BANK_ACCOUNT_KEY, parsed.value);
  } catch {
    console.error("Bank account write failed");
    throw new Error("Bank account write failed");
  }
}
