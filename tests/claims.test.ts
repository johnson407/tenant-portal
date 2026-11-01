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
  writeClaimConfirmation: vi.fn(),
  writeBillPaidOn: vi.fn(),
  acquireClaimConfirmLock: vi.fn(),
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
  CLAIM_CONFIRM_RATE_BUCKET: {
    prefix: "ratelimit:claim-confirm",
    maxAttempts: 60,
    windowSeconds: 900,
  },
  consumeAttempt: mocks.consumeAttempt,
}));

vi.mock("@/lib/appfeed/google", () => ({
  fetchAppFeedSnapshot: mocks.fetchAppFeedSnapshot,
  writeClaimCells: mocks.writeClaimCells,
  writeClaimConfirmation: mocks.writeClaimConfirmation,
  writeBillPaidOn: mocks.writeBillPaidOn,
}));

vi.mock("@/lib/appfeed/claim-lock", () => ({
  acquireClaimConfirmLock: mocks.acquireClaimConfirmLock,
}));

import {
  confirmClaim,
  listPendingClaims,
  parseClaimInput,
  submitClaim,
} from "@/lib/appfeed/claims";
import { todayInTaipei } from "@/lib/appfeed/dates";

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
    "",
    "",
    "",
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
  mocks.writeClaimConfirmation.mockResolvedValue({ kind: "ok" });
  mocks.writeBillPaidOn.mockResolvedValue({ kind: "ok" });
  mocks.acquireClaimConfirmLock.mockResolvedValue(async () => {});
  mocks.isAdminSession.mockResolvedValue(true);
});

function claimedBill(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  return bill({ 7: "2026-10-28", 8: "01234", 15: "", 16: "", ...overrides });
}

function confirmedBill(
  paidOn: string,
  confirmedOn: string,
  note = "",
): unknown[] {
  return claimedBill({ 6: paidOn, 15: confirmedOn, 16: note });
}

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

  it("rejects a bill with a partial confirmation", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([
        bill({
          7: "2026-10-28",
          8: "01234",
          15: "2026-10-31",
        }),
      ]),
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

describe("confirmClaim", () => {
  const PAID_ON = "2026-10-30";

  it("writes the confirmation, then the paid date, and refreshes only room a", async () => {
    const confirmedOn = todayInTaipei();
    mocks.fetchAppFeedSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([claimedBill()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([
          confirmedBill(PAID_ON, confirmedOn, "Thank you"),
        ]),
      });

    const result = await confirmClaim(
      "a",
      "2026-10",
      PAID_ON,
      "  Thank you  ",
    );

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.acquireClaimConfirmLock).toHaveBeenCalledWith("a", "2026-10");
    expect(mocks.writeClaimConfirmation).toHaveBeenCalledWith(
      2,
      confirmedOn,
      "Thank you",
    );
    expect(mocks.writeBillPaidOn).toHaveBeenCalledWith(2, PAID_ON);
    expect(
      mocks.writeClaimConfirmation.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.writeBillPaidOn.mock.invocationCallOrder[0]);
    expect(mocks.writeBillPaidOn.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.revalidateTag.mock.invocationCallOrder[0],
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith("appfeed:room:a", {
      expire: 0,
    });
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("limits by admin client IP before reading the sheet", async () => {
    mocks.fetchAppFeedSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([claimedBill()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([
          confirmedBill(PAID_ON, todayInTaipei()),
        ]),
      });

    await confirmClaim("a", "2026-10", PAID_ON);

    expect(mocks.consumeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "ratelimit:claim-confirm" }),
      ["ip:203.0.113.9"],
    );
    expect(mocks.consumeAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchAppFeedSnapshot.mock.invocationCallOrder[0],
    );
  });

  it("denies a tenant or anonymous caller before reading", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    expect(await confirmClaim("a", "2026-10", PAID_ON)).toEqual({
      kind: "denied",
    });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it.each([
    ["a future date", "2999-01-01"],
    ["an impossible date", "2026-02-30"],
    ["a formatted date", "2026/10/30"],
    ["a blank date", ""],
  ])("rejects %s before the rate limit", async (_label, paidOn) => {
    const result = await confirmClaim("a", "2026-10", paidOn);

    expect(result).toEqual({ kind: "error", reason: "date" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it.each([
    ["an email", "Contact jane@example.com"],
    ["a URL", "See https://example.com"],
    ["seven digits", "Reference 1234567"],
    ["a control character", "Line\nbreak"],
    ["more than 200 characters", "x".repeat(201)],
  ])("rejects a note with %s before the rate limit", async (_label, note) => {
    const result = await confirmClaim("a", "2026-10", PAID_ON, note);

    expect(result).toEqual({ kind: "error", reason: "note" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it("rejects a malformed period without a write", async () => {
    const result = await confirmClaim("a", "2026-10\nforged", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "not-found" });
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it("rejects a paid bill without a write", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([claimedBill({ 6: PAID_ON })]),
    });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "paid" });
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
    expect(mocks.writeBillPaidOn).not.toHaveBeenCalled();
  });

  it("rejects a bill with no claim without a write", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([bill()]),
    });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "not-found" });
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it("rejects an unknown period without a write", async () => {
    const result = await confirmClaim("a", "2026-09", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "not-found" });
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it("rejects when another confirmation holds the lock", async () => {
    mocks.acquireClaimConfirmLock.mockResolvedValue(null);

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeClaimConfirmation).not.toHaveBeenCalled();
  });

  it("fails closed when the lock store is unavailable", async () => {
    mocks.acquireClaimConfirmLock.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("rejects the write when the limiter denies", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "rate" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed when KV is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("does not write the paid date when the confirmation write fails", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([claimedBill()]),
    });
    mocks.writeClaimConfirmation.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeClaimConfirmation).toHaveBeenCalledTimes(1);
    expect(mocks.writeBillPaidOn).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("keeps the claim pending when the paid write fails", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([claimedBill()]),
    });
    mocks.writeBillPaidOn.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeClaimConfirmation).toHaveBeenCalledTimes(1);
    expect(mocks.writeBillPaidOn).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("fails when verification does not show the expected row", async () => {
    mocks.fetchAppFeedSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([claimedBill()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: snapshot([
          confirmedBill(PAID_ON, todayInTaipei(), "A different note"),
        ]),
      });

    const result = await confirmClaim("a", "2026-10", PAID_ON);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("logs no note or suffix when a write fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: snapshot([claimedBill()]),
    });
    mocks.writeBillPaidOn.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });

    await confirmClaim("a", "2026-10", PAID_ON, "Thank you");

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("Thank you");
    expect(logged).not.toContain("01234");
    expect(logged).not.toContain(PAID_ON);
    expect(warn).toHaveBeenCalledWith("[claims] confirmation not saved", {
      room: "a",
      period: "2026-10",
      reason: "paid-write",
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
