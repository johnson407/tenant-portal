import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from "jose";
import { BILLS_HEADER, LEASES_HEADER } from "@/lib/appfeed/validate";

const SHEET_ID = "sheet-id-never-log-123456";
const SERVICE_EMAIL = "appfeed-reader@example.iam.gserviceaccount.com";

let privatePem: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  privatePem = await exportPKCS8(privateKey);
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function metadataResponse(
  title = "AppFeed",
  tabs: string[] = ["Bills", "Leases"],
): Response {
  return jsonResponse({
    properties: { title },
    sheets: tabs.map((tab) => ({ properties: { title: tab } })),
  });
}

function valuesResponse(
  billsHeader: readonly unknown[] = BILLS_HEADER,
  leasesHeader: readonly unknown[] = LEASES_HEADER,
): Response {
  return jsonResponse({
    valueRanges: [
      {
        range: "Bills!A1:G2",
        values: [
          [...billsHeader],
          ["a", "2026-10", 750, "", "", "2026-11-01", ""],
        ],
      },
      {
        range: "Leases!A1:D2",
        values: [
          [...leasesHeader],
          ["a", "2026-01-01", "2026-12-31", ""],
        ],
      },
    ],
  });
}

function queueSuccess(): void {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ access_token: "token-123", expires_in: 3600 }))
    .mockResolvedValueOnce(metadataResponse())
    .mockResolvedValueOnce(valuesResponse());
}

async function loadClient() {
  return import("@/lib/appfeed/google");
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", SERVICE_EMAIL);
  vi.stubEnv("GOOGLE_PRIVATE_KEY", privatePem);
  vi.stubEnv("APPFEED_SPREADSHEET_ID", SHEET_ID);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("service-account token", () => {
  it("signs the expected RS256 assertion and posts the jwt-bearer grant", async () => {
    queueSuccess();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    await fetchAppFeedSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(tokenInit).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
    });
    expect(tokenInit.headers).toEqual({
      "content-type": "application/x-www-form-urlencoded",
    });

    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );

    const assertion = body.get("assertion");
    expect(assertion).toBeTruthy();
    expect(decodeProtectedHeader(assertion!)).toMatchObject({
      alg: "RS256",
      typ: "JWT",
    });

    const claims = decodeJwt(assertion!);
    expect(claims).toMatchObject({
      iss: SERVICE_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
    });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(3600);
  });

  it("reuses a token until 60 seconds before expiry", async () => {
    queueSuccess();
    fetchMock
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(valuesResponse());
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    await fetchAppFeedSnapshot();
    await fetchAppFeedSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const thirdCall = fetchMock.mock.calls[2][0];
    const fourthCall = fetchMock.mock.calls[3][0];
    expect(thirdCall).toContain("/values:batchGet");
    expect(fourthCall).toContain(`/spreadsheets/${SHEET_ID}?fields=`);
    expect(fetchMock.mock.calls[4][0]).toContain("/values:batchGet");
  });

  it("accepts a single-line private key with literal newlines", async () => {
    vi.stubEnv("GOOGLE_PRIVATE_KEY", privatePem.replace(/\n/g, "\\n"));
    queueSuccess();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
  });

  it("accepts a real multi-line private key", async () => {
    queueSuccess();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
  });
});

describe("wrong-file and header guards", () => {
  it("checks metadata before values and fetches only the fixed ranges", async () => {
    queueSuccess();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.snapshot.bills[0]).toEqual([...BILLS_HEADER]);
    expect(result.snapshot.leases[0]).toEqual([...LEASES_HEADER]);

    const metadataUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(metadataUrl.pathname).toContain(`/spreadsheets/${SHEET_ID}`);
    expect(metadataUrl.searchParams.get("fields")).toBe(
      "properties.title,sheets.properties.title",
    );

    const valuesUrl = new URL(fetchMock.mock.calls[2][0] as string);
    expect(valuesUrl.pathname).toContain(`/spreadsheets/${SHEET_ID}/values:batchGet`);
    expect(valuesUrl.searchParams.getAll("ranges")).toEqual([
      "Bills!A:G",
      "Leases!A:D",
    ]);
    expect(valuesUrl.searchParams.get("majorDimension")).toBe("ROWS");
    expect(valuesUrl.searchParams.get("valueRenderOption")).toBe(
      "UNFORMATTED_VALUE",
    );

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { authorization: "Bearer token-123" },
      redirect: "error",
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      headers: { authorization: "Bearer token-123" },
      redirect: "error",
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[0][1].signal).toBe(fetchMock.mock.calls[1][1].signal);
    expect(fetchMock.mock.calls[1][1].signal).toBe(fetchMock.mock.calls[2][1].signal);
  });

  it.each([
    ["wrong title", "Rent Sheet", ["Bills", "Leases"]],
    ["extra tab", "AppFeed", ["Bills", "Leases", "Residents"]],
    ["missing tab", "AppFeed", ["Bills"]],
    ["duplicate tab", "AppFeed", ["Bills", "Bills"]],
  ])("refuses %s before reading cells", async (_label, title, tabs) => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(metadataResponse(title, tabs));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "wrong-file",
      transient: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a header mismatch", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(
        valuesResponse(["room", "period", "rent", "water", "electricity", "due", "paid_on"]),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "headers",
      transient: false,
    });
  });

  it("accepts header cells with surrounding whitespace", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(
        valuesResponse(
          BILLS_HEADER.map((header) => ` ${header} `),
          LEASES_HEADER.map((header) => ` ${header} `),
        ),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
  });

  it("refuses value ranges in the wrong order", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          valueRanges: [
            { range: "Leases!A1:D1", values: [[...LEASES_HEADER]] },
            { range: "Bills!A1:G1", values: [[...BILLS_HEADER]] },
          ],
        }),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });
  });
});

describe("failure mapping", () => {
  it("returns config without touching the network when credentials are missing", async () => {
    vi.stubEnv("APPFEED_SPREADSHEET_ID", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "config",
      transient: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "auth", false],
    [403, "auth", false],
    [429, "quota", true],
    [500, "server", true],
  ])("maps a token HTTP %i to %s", async (status, reason, transient) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, Number(status)));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason,
      transient,
    });
  });

  it.each([
    [401, "auth", false],
    [403, "auth", false],
    [429, "quota", true],
    [503, "server", true],
  ])("maps metadata HTTP %i to %s", async (status, reason, transient) => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, Number(status)));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason,
      transient,
    });
  });

  it.each([
    [401, "auth", false],
    [403, "auth", false],
    [429, "quota", true],
    [502, "server", true],
  ])("maps values HTTP %i to %s", async (status, reason, transient) => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, Number(status)));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason,
      transient,
    });
  });

  it("maps a timeout to a transient timeout", async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error("timed out"), { name: "TimeoutError" }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });
  });

  it("maps a network failure to a transient network result", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "network",
      transient: true,
    });
  });

  it("never includes the spreadsheet ID in a result or log", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(JSON.stringify(result)).not.toContain(SHEET_ID);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SHEET_ID);
  });
});
