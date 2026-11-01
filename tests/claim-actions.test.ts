import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  confirmClaim: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/appfeed/claims", () => ({
  confirmClaim: mocks.confirmClaim,
}));

import { confirmClaimAction } from "@/app/[lang]/admin/claim-actions";
import { GENERIC_CLAIM_CONFIRM_ERROR } from "@/app/[lang]/admin/claim-state";

function form(
  fields: Partial<Record<"room" | "period" | "paidOn" | "note", string>> = {},
): FormData {
  const data = new FormData();
  const values = {
    room: "a",
    period: "2026-10",
    paidOn: "2026-10-28",
    ...fields,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) data.set(name, value);
  }
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.isAdminSession.mockResolvedValue(true);
  mocks.confirmClaim.mockResolvedValue({ kind: "ok" });
});

describe("confirm claim action", () => {
  it("confirms the claim with the room, period, paid date, and note", async () => {
    const result = await confirmClaimAction(
      "en",
      { status: "idle" },
      form({ note: "  Transfer received.  " }),
    );

    expect(result).toEqual({ status: "success" });
    expect(mocks.confirmClaim).toHaveBeenCalledWith(
      "a",
      "2026-10",
      "2026-10-28",
      "  Transfer received.  ",
    );
  });

  it("denies a caller without an admin session before reading the form", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    const result = await confirmClaimAction("en", { status: "idle" }, form());

    expect(result).toEqual({
      status: "error",
      message: GENERIC_CLAIM_CONFIRM_ERROR,
    });
    expect(mocks.confirmClaim).not.toHaveBeenCalled();
  });

  it("rejects a malformed room before the claim call", async () => {
    const result = await confirmClaimAction(
      "en",
      { status: "idle" },
      form({ room: "z" }),
    );

    expect(result).toEqual({ status: "error", message: "not-found" });
    expect(mocks.confirmClaim).not.toHaveBeenCalled();
  });

  it("rejects a missing paid date before the claim call", async () => {
    const result = await confirmClaimAction(
      "en",
      { status: "idle" },
      form({ paidOn: undefined }),
    );

    expect(result).toEqual({ status: "error", message: "date" });
    expect(mocks.confirmClaim).not.toHaveBeenCalled();
  });

  it("maps each claim failure reason to its code", async () => {
    for (const reason of [
      "date",
      "note",
      "not-found",
      "paid",
      "unavailable",
      "rate",
    ] as const) {
      mocks.confirmClaim.mockResolvedValueOnce({ kind: "error", reason });

      const result = await confirmClaimAction("en", { status: "idle" }, form());

      expect(result).toEqual({ status: "error", message: reason });
    }
  });

  it("returns a generic error when the claim call throws", async () => {
    mocks.confirmClaim.mockRejectedValueOnce(new Error("network down"));

    const result = await confirmClaimAction("en", { status: "idle" }, form());

    expect(result).toEqual({
      status: "error",
      message: GENERIC_CLAIM_CONFIRM_ERROR,
    });
  });
});
