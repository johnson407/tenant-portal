import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitClaim: vi.fn(),
  getSessionClaims: vi.fn(),
  getRoomSessionVersion: vi.fn(),
}));

vi.mock("@/lib/appfeed/claims", () => ({
  submitClaim: mocks.submitClaim,
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

import { submitClaimAction } from "@/app/[lang]/rooms/[room]/actions";

function form(
  period = "2026-10",
  claimedOn = "2026-10-28",
  bankLast5 = "01234",
): FormData {
  const data = new FormData();
  data.set("period", period);
  data.set("claimedOn", claimedOn);
  data.set("bankLast5", bankLast5);
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionClaims.mockResolvedValue({
    role: "tenant",
    room: "a",
    v: 4,
    exp: 1,
  });
  mocks.getRoomSessionVersion.mockResolvedValue(4);
  mocks.submitClaim.mockResolvedValue({ kind: "ok" });
});

describe("submitClaimAction", () => {
  it("submits the claim for the signed-in room", async () => {
    const state = await submitClaimAction(
      "zh-TW",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "success" });
    expect(mocks.submitClaim).toHaveBeenCalledWith("a", "2026-10", {
      claimedOn: "2026-10-28",
      bankLast5: "01234",
    });
  });

  it.each([
    ["date", "date"],
    ["suffix", "suffix"],
  ] as const)("returns a %s field error", async (reason, message) => {
    mocks.submitClaim.mockResolvedValue({ kind: "error", reason });

    expect(
      await submitClaimAction("en", "a", { status: "idle" }, form()),
    ).toEqual({ status: "error", message });
  });

  it("hides every other failure behind the generic message", async () => {
    mocks.submitClaim.mockResolvedValue({
      kind: "error",
      reason: "unavailable",
    });

    expect(
      await submitClaimAction("en", "a", { status: "idle" }, form()),
    ).toEqual({ status: "error", message: "generic" });
  });

  it("rejects a session that an admin reset has revoked", async () => {
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const state = await submitClaimAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });

  it("rejects when the session version cannot be read", async () => {
    mocks.getRoomSessionVersion.mockRejectedValue(new Error("kv down"));

    const state = await submitClaimAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });

  it("rejects a request for another room before calling the claim service", async () => {
    const state = await submitClaimAction(
      "en",
      "b",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });

  it("rejects an anonymous request", async () => {
    mocks.getSessionClaims.mockResolvedValue(null);

    const state = await submitClaimAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });

  it("rejects an admin session", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "admin" });

    const state = await submitClaimAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });

  it("rejects an invalid room path", async () => {
    const state = await submitClaimAction(
      "en",
      "z",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.submitClaim).not.toHaveBeenCalled();
  });
});
