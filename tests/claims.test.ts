import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppFeedSnapshot } from "@/lib/appfeed/types";
import { BILLS_HEADER, LEASES_HEADER } from "@/lib/appfeed/validate";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  revalidateTag: vi.fn(),
  isAdminSession: vi.fn(),
  consumeAttempt: vi.fn(),
  fetchAppFeedSnapshot: vi.fn(),
  writeClaimCells: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  CLAIM_RATE_BUCKET: {
    prefix: "ratelimit:claim",
    maxAttempts: 10,
    windowSeconds: 900,
  },
  consumeAttempt: mocks.consumeAttempt,
}));

vi.mock("@/lib/appfeed/google", () => ({
  fetchAppFeedSnapshot: mocks.fetchAppFeedSnapshot,
  writeClaimCells: mocks.writeClaimCells,
}));

import {
  listPendingClaims,
  parseClaimInput,
  submitClaim,
  todayInTaipei,
} from "@/lib/appfeed/claims";

const NOW = new Date("2026-10-31T16:30:00.000Z"); // 2026-11-01 in Asia/Taipei

function bill(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = [
    "a",
    "2026-10",
    "750",
    "",
    "",
    "2026-11-01",
    "",
    "",
    "",
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function snapshot(bills: unknown[][] = [bill()]): AppFeedSnapshot {
  return {
    bills: [[...BILLS_HEADER], ...bills],
    leases: [[...LEASES_HEADER]],
  };
}

const VALID_INPUT = { claimedOn: "2026-10-28", bankLast5: "01234" };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.headersGet.mockReturnValue("203.0.113.9");
  mocks.consumeAttempt.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: null,
  });
  mocks.fetchAppFeedSnapshot.mockResolvedValue({ kind: "ok", snapshot: snapshot() });
  mocks.writeClaimCells.mockResolvedValue({ kind: "ok" });
  mocks.isAdminSession.mockResolvedValue(true);
});

describe("todayInTaipei", () => {
  it("uses the Taipei calendar day, not the UTC day", () => {
    expect(todayInTaipei(NOW)).toBe("2026-11-01");
    expect(todayInTaipei(new Date("2026-10-31T15:59:00.000Z"))).toBe(
      "2026-10-31",
    );
  });
});

describe("parseClaimInput", () => {
  it("accepts a real past date and trims the suffix", () => {
    expect(
      parseClaimInput({ claimedOn: " 2026-10-28 ", bankLast5: " 01234 " }, NOW),
    ).toEqual({
      ok: true,
      value: { claimedOn: "2026-10-28", bankLast5: "01234" },
    });
  });

  it("accepts today in Taipei and rejects tomorrow", () => {
    expect(
      parseClaimInput({ claimedOn: "2026-11-01", bankLast5: "01234" }, NOW).ok,
    ).toBe(true);
    expect(
      parseClaimInput({ claimedOn: "2026-11-02", bankLast5: "01234" }, NOW),
    ).toEqual({ ok: false, reason: "date" });
  });

  it.each([
    ["an impossible date", "2026-02-30"],
    ["a formatted date", "2026/10/28"],
    ["a missing date", ""],
  ])("rejects %s", (_label, claimedOn) => {
    expect(parseClaimInput({ claimedOn, bankLast5: "01234" }, NOW)).toEqual({
      ok: false,
      reason: "date",
    });
  });

  it.each([
    ["four digits", "0123"],
    ["six digits", "012345"],
    ["letters", "0123a"],
    ["an empty value", ""],
  ])("rejects a suffix with %s", (_label, bankLast5) => {
    expect(
      parseClaimInput({ claimedOn: "2026-10-28", bankLast5 }, NOW),
    ).toEqual({ ok: false, reason: "suffix" });
  });
});

describe("submitClaim", () => {
  it("writes both cells for the owning room and invalidates only its tag", async () => {
    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.writeClaimCells).toHaveBeenCalledWith(2, VALID_INPUT);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("appfeed:room:a", {
      expire: 0,
    });
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("limits by client IP and room before reading the sheet", async () => {
    await submitClaim("a", "2026-10", VALID_INPUT);

    expect(mocks.consumeAttempt).toHaveBeenCalledWith(expect.anything(), [
      "ip:203.0.113.9",
      "room:a",
    ]);
    expect(mocks.consumeAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchAppFeedSnapshot.mock.invocationCallOrder[0],
    );
  });

  it("rejects a room that does not own the bill", async () => {
    const result = await submitClaim("b", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeClaimCells).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a paid bill", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([bill({ 6: "2026-10-30" })]),
    });

    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeClaimCells).not.toHaveBeenCalled();
  });

  it("leaves the bill unchanged when the write fails", async () => {
    mocks.writeClaimCells.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: true,
    });

    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects the write when the limiter denies", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed when KV is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("rejects the write when the fresh read fails", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "quota",
      transient: true,
    });

    const result = await submitClaim("a", "2026-10", VALID_INPUT);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeClaimCells).not.toHaveBeenCalled();
  });

  it.each([
    [500, "server", true],
    [403, "auth", false],
    [0, "timeout", true],
  ])(
    "logs only fixed fields when a write fails with %s",
    async (_status, reason, transient) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.writeClaimCells.mockResolvedValue({
        kind: "unavailable",
        reason,
        transient,
      });

      await submitClaim("a", "2026-10", VALID_INPUT);

      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain("01234");
      expect(logged).not.toContain("2026-10-28");
      expect(logged).toContain("2026-10");
      expect(warn).toHaveBeenCalledWith("[claims] claim not saved", {
        room: "a",
        period: "2026-10",
        reason: "write",
      });
    },
  );

  it("does not log an invalid period", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "quota",
      transient: true,
    });

    await submitClaim("a", "2026-10\nforged", VALID_INPUT);

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("forged");
    expect(warn).toHaveBeenCalledWith("[claims] claim not saved", {
      room: "a",
      period: "",
      reason: "read",
    });
  });
});

describe("listPendingClaims", () => {
  it("returns only pending claims with a narrow field set", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([
        bill({ 7: "2026-10-28", 8: "01234" }),
        bill({ 0: "b", 7: "2026-10-27", 8: "56789" }),
        bill({ 0: "c", 6: "2026-10-26", 7: "2026-10-25", 8: "11111" }),
        bill({ 0: "d" }),
      ]),
    });

    const result = await listPendingClaims();

    expect(result).toEqual({
      kind: "ok",
      claims: [
        {
          room: "a",
          period: "2026-10",
          claimedOn: "2026-10-28",
          bankLast5: "01234",
        },
        {
          room: "b",
          period: "2026-10",
          claimedOn: "2026-10-27",
          bankLast5: "56789",
        },
      ],
    });
    if (result.kind !== "ok") return;
    expect(Object.keys(result.claims[0]).sort()).toEqual([
      "bankLast5",
      "claimedOn",
      "period",
      "room",
    ]);
  });

  it("denies a tenant or anonymous caller before reading the sheet", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    expect(await listPendingClaims()).toEqual({ kind: "denied" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("reports unavailable when the sheet cannot be read", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "auth",
      transient: false,
    });

    expect(await listPendingClaims()).toEqual({ kind: "unavailable" });
  });

  it("returns an empty list when no bill has a pending claim", async () => {
    expect(await listPendingClaims()).toEqual({ kind: "ok", claims: [] });
  });
});
