import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";
import {
  BILLS_HEADER,
  LEASES_HEADER,
  REPAIRS_HEADER,
  REPAIRS_RANGE,
} from "@/lib/appfeed/validate";

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
  hiddenTabs: string[] = [],
): Response {
  return jsonResponse({
    properties: { title },
    sheets: tabs.map((tab) => ({
      properties: hiddenTabs.includes(tab)
        ? { title: tab, hidden: true }
        : { title: tab },
    })),
  });
}

function validRepairRow(): unknown[] {
  return [
    "a",
    "0123456789abcdef",
    "plumbing",
    "Leaking tap in the bathroom",
    "2026-10-30",
    "pending",
    "",
  ];
}

type ValuesOptions = {
  billsHeader?: readonly unknown[];
  leasesHeader?: readonly unknown[];
  repairsHeader?: readonly unknown[];
  repairsRows?: unknown[][];
};

function feedValuesResponse(options: ValuesOptions = {}): Response {
  return jsonResponse({
    valueRanges: [
      {
        range: "Bills!A1:I2",
        values: [
          [...(options.billsHeader ?? BILLS_HEADER)],
          ["a", "2026-10", 750, "", "", "2026-11-01", "", "", ""],
        ],
      },
      {
        range: "Leases!A1:D2",
        values: [
          [...(options.leasesHeader ?? LEASES_HEADER)],
          ["a", "2026-01-01", "2026-12-31", ""],
        ],
      },
    ],
  });
}

function repairsValuesResponse(options: ValuesOptions = {}): Response {
  return jsonResponse({
    valueRanges: [
      {
        range: "Repairs!A1:G2",
        values: [
          [...(options.repairsHeader ?? REPAIRS_HEADER)],
          ...(options.repairsRows ?? [validRepairRow()]),
        ],
      },
    ],
  });
}

function queueFeedSuccess(
  includeRepairs = true,
  options: ValuesOptions = {},
): void {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({ access_token: "token-123", expires_in: 3600 }),
    )
    .mockResolvedValueOnce(
      metadataResponse(
        "AppFeed",
        includeRepairs
          ? ["Bills", "Leases", "Repairs"]
          : ["Bills", "Leases"],
      ),
    )
    .mockResolvedValueOnce(feedValuesResponse(options));
}

function queueRepairsSuccess(options: ValuesOptions = {}): void {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({ access_token: "token-123", expires_in: 3600 }),
    )
    .mockResolvedValueOnce(
      metadataResponse("AppFeed", ["Bills", "Leases", "Repairs"]),
    )
    .mockResolvedValueOnce(repairsValuesResponse(options));
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

describe("optional Repairs tab", () => {
  it("accepts Bills, Leases, and Repairs but reads only the feed ranges", async () => {
    queueFeedSuccess(true);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.snapshot).not.toHaveProperty("repairs");

    const valuesUrl = new URL(fetchMock.mock.calls[2][0] as string);
    expect(valuesUrl.searchParams.getAll("ranges")).toEqual([
      "Bills!A:I",
      "Leases!A:D",
    ]);
  });

  it("accepts the two-tab set and requests two ranges", async () => {
    queueFeedSuccess(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAppFeedSnapshot } = await loadClient();
    const result = await fetchAppFeedSnapshot();

    expect(result.kind).toBe("ok");
    const valuesUrl = new URL(fetchMock.mock.calls[2][0] as string);
    expect(valuesUrl.searchParams.getAll("ranges")).toEqual([
      "Bills!A:I",
      "Leases!A:D",
    ]);
  });

  it("reads only the Repairs rows through fetchRepairsSnapshot", async () => {
    queueRepairsSuccess();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.snapshot.repairs[0]).toEqual([...REPAIRS_HEADER]);
    expect(result.snapshot.repairs[1]).toEqual(validRepairRow());
    expect(result.snapshot).not.toHaveProperty("bills");
    expect(result.snapshot).not.toHaveProperty("leases");

    const valuesUrl = new URL(fetchMock.mock.calls[2][0] as string);
    expect(valuesUrl.searchParams.getAll("ranges")).toEqual([REPAIRS_RANGE]);
  });

  it("returns missing-tab without reading values when Repairs is absent", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(metadataResponse());
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("logs only a fixed reason and never the spreadsheet ID or repair values", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(metadataResponse());

    const { fetchRepairsSnapshot } = await loadClient();
    await fetchRepairsSnapshot();

    expect(warn).toHaveBeenCalledWith("[appfeed] repairs unavailable", {
      reason: "missing-tab",
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(SHEET_ID);
    expect(logged).not.toContain("0123456789abcdef");
    expect(logged).not.toContain("Leaking tap");
  });

  it("returns a header failure for a wrong Repairs header", async () => {
    queueRepairsSuccess({
      repairsHeader: [...REPAIRS_HEADER].slice(0, 6),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "headers",
      transient: false,
    });
  });

  it("returns config without network access when credentials are missing", async () => {
    vi.stubEnv("APPFEED_SPREADSHEET_ID", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "config",
      transient: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("repair writes", () => {
  const newRepair = {
    room: "a" as const,
    requestId: "0123456789abcdef",
    category: "plumbing" as const,
    note: "Leaking tap",
    submittedOn: "2026-10-30",
  };

  it("appends one pending row with POST, RAW, and INSERT_ROWS", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(jsonResponse({ updates: { updatedRows: 1 } }));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { appendRepairRow } = await loadClient();
    const result = await appendRepairRow(newRepair);

    expect(result).toEqual({ kind: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Repairs!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    );
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
    });
    expect(init.headers).toMatchObject({
      authorization: "Bearer token-123",
      "content-type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      values: [
        [
          "A",
          "0123456789abcdef",
          "plumbing",
          "Leaking tap",
          "2026-10-30",
          "pending",
          "",
        ],
      ],
    });
    expect(
      fetchMock.mock.calls.some(([callUrl]) =>
        String(callUrl).includes(":batchUpdate"),
      ),
    ).toBe(false);
  });

  it("rejects an invalid repair before touching the network", async () => {
    const { appendRepairRow } = await loadClient();
    const result = await appendRepairRow({
      ...newRepair,
      note: "Contact jane@example.com",
    });

    expect(result).toEqual({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [403, "auth", false],
    [429, "quota", true],
    [500, "server", true],
  ])("maps an append HTTP %i to %s", async (status, reason, transient) => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, Number(status)));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { appendRepairRow } = await loadClient();
    const result = await appendRepairRow(newRepair);

    expect(result).toEqual({ kind: "unavailable", reason, transient });
  });

  it("maps an append timeout to a transient timeout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("timed out"), { name: "TimeoutError" }),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { appendRepairRow } = await loadClient();
    const result = await appendRepairRow(newRepair);

    expect(result).toEqual({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });
  });

  it("writes only the status and done date with PUT", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(jsonResponse({ updatedRange: "Repairs!F5:G5" }));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { writeRepairDone } = await loadClient();
    const result = await writeRepairDone(5, "2026-11-01");

    expect(result).toEqual({ kind: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Repairs!F5:G5?valueInputOption=RAW`,
    );
    expect(init).toMatchObject({
      method: "PUT",
      redirect: "error",
      cache: "no-store",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      values: [["done", "2026-11-01"]],
    });
    expect(
      fetchMock.mock.calls.some(([callUrl]) =>
        String(callUrl).includes(":batchUpdate"),
      ),
    ).toBe(false);
  });

  it.each([
    ["row 1", 1, "2026-11-01"],
    ["a non-integer row", 2.5, "2026-11-01"],
    ["an impossible date", 2, "2026-02-30"],
  ])("rejects %s before touching the network", async (_label, row, date) => {
    const { writeRepairDone } = await loadClient();
    const result = await writeRepairDone(row, date);

    expect(result).toEqual({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "auth", false],
    [403, "auth", false],
    [429, "quota", true],
    [502, "server", true],
  ])("maps a status write HTTP %i to %s", async (status, reason, transient) => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, Number(status)));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { writeRepairDone } = await loadClient();
    const result = await writeRepairDone(5, "2026-11-01");

    expect(result).toEqual({ kind: "unavailable", reason, transient });
  });

  it("maps a status write timeout to a transient timeout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("timed out"), { name: "TimeoutError" }),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { writeRepairDone } = await loadClient();
    const result = await writeRepairDone(5, "2026-11-01");

    expect(result).toEqual({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });
  });
});

describe("repair tab guard", () => {
  it.each([
    ["an extra tab", ["Bills", "Leases", "Repairs", "Residents"]],
    ["a duplicate Repairs tab", ["Bills", "Leases", "Repairs", "Repairs"]],
    ["a missing Bills tab", ["Leases", "Repairs"]],
    ["a missing Leases tab", ["Bills", "Repairs"]],
  ])("rejects %s before reading values", async (_label, tabs) => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(metadataResponse("AppFeed", tabs));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "wrong-file",
      transient: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a hidden tab before reading values", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-123", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        metadataResponse(
          "AppFeed",
          ["Bills", "Leases", "Repairs"],
          ["Repairs"],
        ),
      );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchRepairsSnapshot } = await loadClient();
    const result = await fetchRepairsSnapshot();

    expect(result).toEqual({
      kind: "unavailable",
      reason: "wrong-file",
      transient: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
