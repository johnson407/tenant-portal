import { describe, expect, it } from "vitest";
import type { FeedEvent, FeedResult, RoomRepairsResult } from "@/lib/appfeed/types";
import { selectLatestUpdate } from "@/lib/appfeed/updates";

function claimEvent(date: string, note: string | null = null): FeedResult {
  return {
    kind: "ok",
    feed: {
      room: "a",
      openBills: [],
      payments: [],
      lease: null,
      lastConfirmation: { date, note },
      fetchedAt: "2026-11-01T00:00:00.000Z",
    },
  };
}

function repairEvent(date: string, note: string | null = null): RoomRepairsResult {
  return {
    kind: "ok",
    repairs: [],
    lastDone: { date, note },
  };
}

const noClaim: FeedResult = {
  kind: "ok",
  feed: {
    room: "a",
    openBills: [],
    payments: [],
    lease: null,
    lastConfirmation: null,
    fetchedAt: "2026-11-01T00:00:00.000Z",
  },
};

const noRepair: RoomRepairsResult = {
  kind: "ok",
  repairs: [],
  lastDone: null,
};

describe("selectLatestUpdate", () => {
  it("returns a repair when it is the only event", () => {
    const expected: FeedEvent & { kind: "repair-done" } = {
      kind: "repair-done",
      date: "2026-10-20",
      note: "Fixed the tap",
    };

    expect(selectLatestUpdate(noClaim, repairEvent("2026-10-20", "Fixed the tap"))).toEqual(
      expected,
    );
  });

  it("returns a claim confirmation when it is the only event", () => {
    expect(selectLatestUpdate(claimEvent("2026-10-21", "Thank you"), noRepair)).toEqual({
      kind: "claim-confirmed",
      date: "2026-10-21",
      note: "Thank you",
    });
  });

  it("returns the later event when both sources have one", () => {
    expect(
      selectLatestUpdate(
        claimEvent("2026-10-21", "Thank you"),
        repairEvent("2026-10-20", "Fixed the tap"),
      ),
    ).toEqual({
      kind: "claim-confirmed",
      date: "2026-10-21",
      note: "Thank you",
    });

    expect(
      selectLatestUpdate(
        claimEvent("2026-10-19"),
        repairEvent("2026-10-20", "Fixed the tap"),
      ),
    ).toEqual({
      kind: "repair-done",
      date: "2026-10-20",
      note: "Fixed the tap",
    });
  });

  it("lets the claim win a date tie", () => {
    expect(
      selectLatestUpdate(
        claimEvent("2026-10-21", "Confirmed"),
        repairEvent("2026-10-21", "Fixed the tap"),
      ),
    ).toEqual({
      kind: "claim-confirmed",
      date: "2026-10-21",
      note: "Confirmed",
    });
  });

  it("returns null when neither source has an event", () => {
    expect(selectLatestUpdate(noClaim, noRepair)).toBeNull();
  });

  it("keeps the repair when Bills is unavailable", () => {
    expect(
      selectLatestUpdate({ kind: "unavailable" }, repairEvent("2026-10-20", "Fixed the tap")),
    ).toEqual({
      kind: "repair-done",
      date: "2026-10-20",
      note: "Fixed the tap",
    });
  });

  it("keeps the claim when Repairs is unavailable", () => {
    expect(
      selectLatestUpdate(claimEvent("2026-10-21", "Thank you"), { kind: "unavailable" }),
    ).toEqual({
      kind: "claim-confirmed",
      date: "2026-10-21",
      note: "Thank you",
    });
  });

  it("returns null when both sources are unavailable", () => {
    expect(
      selectLatestUpdate({ kind: "unavailable" }, { kind: "unavailable" }),
    ).toBeNull();
  });
});
