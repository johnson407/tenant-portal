import "server-only";
import { importPKCS8, SignJWT } from "jose";
import type {
  NewRepair,
  RepairsSnapshotResult,
  SnapshotFailure,
  SnapshotFailureReason,
  SnapshotResult,
} from "./types";
import {
  BILLS_HEADER,
  LEASES_HEADER,
  REPAIRS_HEADER,
  REPAIRS_RANGE,
  hasExactHeaderRow,
  isRealIsoDate,
  parseRepairRow,
} from "./validate";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const EXPECTED_TITLE = "AppFeed";
const BILLS_RANGE = "Bills!A:O";
const LEASES_RANGE = "Leases!A:D";
const TIMEOUT_MS = 8000;
const TOKEN_EXPIRY_SKEW_MS = 60_000;

type Credentials = {
  email: string;
  privateKey: string;
  spreadsheetId: string;
};

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCacheEntry | null = null;

function failure(
  reason: SnapshotFailureReason,
  transient = false,
): SnapshotFailure {
  return { kind: "unavailable", reason, transient };
}

function statusFailure(status: number): SnapshotFailure {
  if (status === 401 || status === 403) return failure("auth");
  if (status === 429) return failure("quota", true);
  if (status >= 500) return failure("server", true);
  if (status === 400) return failure("server");
  return failure("auth");
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function requestFailure(error: unknown): SnapshotFailure {
  return isTimeoutError(error) ? failure("timeout", true) : failure("network", true);
}

function readCredentials(): Credentials | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const spreadsheetId = process.env.APPFEED_SPREADSHEET_ID?.trim();

  if (!email || !privateKey || !spreadsheetId) return null;

  return {
    email,
    privateKey: privateKey.replace(/\\n/g, "\n").trim(),
    spreadsheetId,
  };
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch (error) {
    if (isTimeoutError(error)) throw error;
    return null;
  }
}

async function getAccessToken(
  credentials: Credentials,
  signal: AbortSignal,
): Promise<{ kind: "ok"; token: string } | SnapshotFailure> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_EXPIRY_SKEW_MS) {
    return { kind: "ok", token: tokenCache.token };
  }

  let assertion: string;
  try {
    const now = Math.floor(Date.now() / 1000);
    const key = await importPKCS8(credentials.privateKey, "RS256");
    assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(credentials.email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
  } catch {
    return failure("config");
  }

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: JWT_GRANT_TYPE,
        assertion,
      }).toString(),
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  let body: unknown;
  try {
    body = await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  const data = body as { access_token?: unknown; expires_in?: unknown } | null;
  if (!data || typeof data.access_token !== "string" || !data.access_token) {
    return failure("auth");
  }

  const expiresIn = Number(data.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return failure("auth");

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return { kind: "ok", token: data.access_token };
}

type MetadataResult =
  | { kind: "ok"; hasRepairs: boolean }
  | SnapshotFailure;

type ValueRangesResult =
  | {
      kind: "ok";
      valueRanges: Array<{ range: string; values: unknown[][] }>;
    }
  | SnapshotFailure;

async function fetchMetadata(
  credentials: Credentials,
  token: string,
  signal: AbortSignal,
): Promise<MetadataResult> {
  const url = `${SHEETS_API}/${encodeURIComponent(
    credentials.spreadsheetId,
  )}?fields=properties.title,sheets.properties.title,sheets.properties.hidden`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  let body: unknown;
  try {
    body = await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  const data = body as
    | {
        properties?: { title?: unknown };
        sheets?: Array<{
          properties?: { title?: unknown; hidden?: unknown };
        }>;
      }
    | null;

  const title = data?.properties?.title;
  const tabs = Array.isArray(data?.sheets)
    ? data.sheets.map((sheet) => sheet?.properties?.title)
    : [];

  const hasBills = tabs.filter((tab) => tab === "Bills").length === 1;
  const hasLeases = tabs.filter((tab) => tab === "Leases").length === 1;
  const hasRepairs = tabs.filter((tab) => tab === "Repairs").length === 1;
  const hasUnknownTab = tabs.some(
    (tab) => tab !== "Bills" && tab !== "Leases" && tab !== "Repairs",
  );
  const hasValidTabCount =
    tabs.length === 2 || (tabs.length === 3 && hasRepairs);
  const hasHiddenTab =
    Array.isArray(data?.sheets) &&
    data.sheets.some((sheet) => sheet?.properties?.hidden === true);

  if (
    title !== EXPECTED_TITLE ||
    !hasBills ||
    !hasLeases ||
    hasUnknownTab ||
    !hasValidTabCount ||
    hasHiddenTab
  ) {
    return failure("wrong-file");
  }

  return { kind: "ok", hasRepairs };
}

async function fetchValueRanges(
  credentials: Credentials,
  token: string,
  signal: AbortSignal,
  ranges: string[],
): Promise<ValueRangesResult> {
  const query = new URLSearchParams();
  for (const range of ranges) query.append("ranges", range);
  query.set("majorDimension", "ROWS");
  query.set("valueRenderOption", "UNFORMATTED_VALUE");
  const url = `${SHEETS_API}/${encodeURIComponent(
    credentials.spreadsheetId,
  )}/values:batchGet?${query.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  let body: unknown;
  try {
    body = await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  const data = body as
    | {
        valueRanges?: Array<{ range?: unknown; values?: unknown }>;
      }
    | null;

  const valueRanges = Array.isArray(data?.valueRanges) ? data.valueRanges : [];
  if (valueRanges.length !== ranges.length) return failure("server");

  return {
    kind: "ok",
    valueRanges: valueRanges.map((valueRange) => ({
      range: String(valueRange?.range ?? ""),
      values: Array.isArray(valueRange?.values)
        ? (valueRange.values as unknown[][])
        : [],
    })),
  };
}

/**
 * Writes the two claim cells for one existing bill row. Uses RAW input so
 * Sheets keeps the date as text and never evaluates the suffix. Only columns
 * H and I change; no structure call is made.
 */
export async function writeClaimCells(
  rowNumber: number,
  claim: { claimedOn: string; bankLast5: string },
): Promise<{ kind: "ok" } | SnapshotFailure> {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) {
    return failure("server");
  }

  const credentials = readCredentials();
  if (!credentials) return failure("config");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const token = await getAccessToken(credentials, signal);
  if (token.kind === "unavailable") return token;

  const range = `Bills!H${rowNumber}:I${rowNumber}`;
  const url = `${SHEETS_API}/${encodeURIComponent(
    credentials.spreadsheetId,
  )}/values/${range}?valueInputOption=RAW`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        values: [[claim.claimedOn, claim.bankLast5]],
      }),
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  try {
    await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  return { kind: "ok" };
}

/**
 * Appends one complete pending repair row to `Repairs!A:G`. Uses RAW input so
 * Sheets keeps dates and the request ID as text. Only an append is requested;
 * no existing row, tab, or column is changed.
 */
export async function appendRepairRow(
  repair: NewRepair,
): Promise<{ kind: "ok" } | SnapshotFailure> {
  const parsed = parseRepairRow([
    repair.room,
    repair.requestId,
    repair.category,
    repair.note,
    repair.submittedOn,
    "pending",
    "",
  ]);
  if (!parsed) return failure("server");

  const credentials = readCredentials();
  if (!credentials) return failure("config");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const token = await getAccessToken(credentials, signal);
  if (token.kind === "unavailable") return token;

  const url = `${SHEETS_API}/${encodeURIComponent(
    credentials.spreadsheetId,
  )}/values/${REPAIRS_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        values: [
          [
            parsed.room.toUpperCase(),
            parsed.requestId,
            parsed.category,
            parsed.note,
            parsed.submittedOn,
            "pending",
            "",
          ],
        ],
      }),
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  try {
    await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  return { kind: "ok" };
}

/**
 * Writes `done` and the completion date to `Repairs!F{row}:G{row}`. The caller
 * finds the row after a fresh read; no saved row number is trusted across reads.
 */
export async function writeRepairDone(
  rowNumber: number,
  doneOn: string,
): Promise<{ kind: "ok" } | SnapshotFailure> {
  if (
    !Number.isSafeInteger(rowNumber) ||
    rowNumber < 2 ||
    !isRealIsoDate(doneOn)
  ) {
    return failure("server");
  }

  const credentials = readCredentials();
  if (!credentials) return failure("config");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const token = await getAccessToken(credentials, signal);
  if (token.kind === "unavailable") return token;

  const range = `Repairs!F${rowNumber}:G${rowNumber}`;
  const url = `${SHEETS_API}/${encodeURIComponent(
    credentials.spreadsheetId,
  )}/values/${range}?valueInputOption=RAW`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values: [["done", doneOn]] }),
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    return requestFailure(error);
  }

  if (!response.ok) return statusFailure(response.status);

  try {
    await readJson(response);
  } catch (error) {
    return requestFailure(error);
  }

  return { kind: "ok" };
}

/**
 * Reads the two fixed bill and lease AppFeed ranges after checking the file
 * title and tab set. An optional `Repairs` tab is allowed but is not read here.
 * All failures are returned as typed results; no response body, ID, token, or
 * key is included or logged.
 */
export async function fetchAppFeedSnapshot(): Promise<SnapshotResult> {
  const credentials = readCredentials();
  if (!credentials) {
    const result = failure("config");
    console.warn("[appfeed] snapshot unavailable", { reason: result.reason });
    return result;
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);

  const token = await getAccessToken(credentials, signal);
  if (token.kind === "unavailable") {
    console.warn("[appfeed] snapshot unavailable", { reason: token.reason });
    return token;
  }

  const metadata = await fetchMetadata(credentials, token.token, signal);
  if (metadata.kind === "unavailable") {
    console.warn("[appfeed] snapshot unavailable", { reason: metadata.reason });
    return metadata;
  }

  const result = await fetchValueRanges(
    credentials,
    token.token,
    signal,
    [BILLS_RANGE, LEASES_RANGE],
  );
  if (result.kind === "unavailable") {
    console.warn("[appfeed] snapshot unavailable", { reason: result.reason });
    return result;
  }

  const [billsRange, leasesRange] = result.valueRanges;
  if (
    !billsRange.range.startsWith("Bills!") ||
    !leasesRange.range.startsWith("Leases!")
  ) {
    console.warn("[appfeed] snapshot unavailable", { reason: "server" });
    return failure("server");
  }

  const bills = billsRange.values;
  const leases = leasesRange.values;
  if (
    !hasExactHeaderRow(bills, BILLS_HEADER) ||
    !hasExactHeaderRow(leases, LEASES_HEADER)
  ) {
    console.warn("[appfeed] snapshot unavailable", { reason: "headers" });
    return failure("headers");
  }

  return {
    kind: "ok",
    snapshot: { bills, leases },
  };
}

/**
 * Reads the fixed `Repairs` range after checking the file title and tab set. A
 * missing tab is a stable `missing-tab` result, not an empty list. The values
 * stay server-side; no response body, ID, token, or key is logged.
 */
export async function fetchRepairsSnapshot(): Promise<RepairsSnapshotResult> {
  const credentials = readCredentials();
  if (!credentials) {
    const result = failure("config");
    console.warn("[appfeed] repairs unavailable", { reason: result.reason });
    return result;
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);

  const token = await getAccessToken(credentials, signal);
  if (token.kind === "unavailable") {
    console.warn("[appfeed] repairs unavailable", { reason: token.reason });
    return token;
  }

  const metadata = await fetchMetadata(credentials, token.token, signal);
  if (metadata.kind === "unavailable") {
    console.warn("[appfeed] repairs unavailable", { reason: metadata.reason });
    return metadata;
  }

  if (!metadata.hasRepairs) {
    const result = failure("missing-tab");
    console.warn("[appfeed] repairs unavailable", { reason: result.reason });
    return result;
  }

  const result = await fetchValueRanges(
    credentials,
    token.token,
    signal,
    [REPAIRS_RANGE],
  );
  if (result.kind === "unavailable") {
    console.warn("[appfeed] repairs unavailable", { reason: result.reason });
    return result;
  }

  const [repairsRange] = result.valueRanges;
  if (!repairsRange.range.startsWith("Repairs!")) {
    console.warn("[appfeed] repairs unavailable", { reason: "server" });
    return failure("server");
  }

  const repairs = repairsRange.values;
  if (!hasExactHeaderRow(repairs, REPAIRS_HEADER)) {
    console.warn("[appfeed] repairs unavailable", { reason: "headers" });
    return failure("headers");
  }

  return { kind: "ok", snapshot: { repairs } };
}
