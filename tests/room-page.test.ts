import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RoomFeed } from "@/lib/appfeed/types";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  getRoomSessionVersion: vi.fn(),
  getRoomFeed: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

vi.mock("@/lib/appfeed/feed", () => ({
  getRoomFeed: mocks.getRoomFeed,
}));

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

import RoomPage from "@/app/[lang]/rooms/[room]/page";

const FEED_A: RoomFeed = {
  room: "a",
  openBills: [
    {
      period: "2026-10",
      rent: 750,
      water: 100,
      electricity: 50,
      total: 900,
      dueDate: "2026-11-01",
    },
  ],
  payments: [
    { period: "2026-09", amount: 700, receivedOn: "2026-10-05" },
  ],
  lease: {
    start: "2026-01-01",
    end: "2026-12-31",
    renewalDue: "2026-11-30",
  },
  fetchedAt: "2026-11-01T04:00:00.000Z",
};

const FEED_B: RoomFeed = {
  room: "b",
  openBills: [
    {
      period: "2026-11",
      rent: 800,
      water: null,
      electricity: 0,
      total: 800,
      dueDate: "2026-12-01",
    },
  ],
  payments: [],
  lease: null,
  fetchedAt: "2026-11-01T04:00:00.000Z",
};

async function renderRoom(room: string, lang = "zh-TW"): Promise<string> {
  const ui = await RoomPage({ params: Promise.resolve({ lang, room }) });
  return renderToStaticMarkup(ui);
}

function expectNoPersonalData(html: string) {
  expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  expect(html).not.toMatch(/\+886/);
  expect(html).not.toMatch(/\b09\d{8}\b/);
}

function expectNoPlaceholderCopy(html: string) {
  expect(html).not.toMatch(/sample|placeholder|範例/i);
}

beforeEach(() => {
  mocks.getSessionClaims.mockReset();
  mocks.getRoomSessionVersion.mockReset();
  mocks.getRoomFeed.mockReset();

  mocks.getSessionClaims.mockResolvedValue({
    role: "tenant",
    room: "a",
    v: 4,
    exp: 1,
  });
  mocks.getRoomSessionVersion.mockResolvedValue(4);
  mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_A });
});

describe("room dashboard authorization", () => {
  it("renders the tenant's own room when the session version is current", async () => {
    const html = await renderRoom("a");

    expect(html).toContain("房間 A");
    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toContain("租約日期");
    expect(html).toContain("期別 2026-10");
    expect(html).toContain("合計 $900");
    expect(html).toContain("租金</dt>");
    expect(html).toContain("$750</dd>");
    expect(html).toContain("水費</dt>");
    expect(html).toContain("$100</dd>");
    expect(html).toContain("電費</dt>");
    expect(html).toContain("$50</dd>");
    expect(html).toContain("到期 2026年11月1日");
    expect(html).toContain("未付款");
    expect(html).toContain("已收款 2026年10月5日");
    expect(html).toContain("最後更新 2026年11月1日 中午12:00");
    expect(html).toContain("租約開始");
    expect(html).toContain("租約結束");
    expect(html).toContain("續約決定截止日");
    expect(html).toContain("2026年11月30日");
    expect(html).toContain('href="/en/rooms/a"');
    expect(html).toContain("hover:bg-slate-200");
    expect(html).toContain("focus-visible:ring-slate-700");
    expect(html).toContain("focus-visible:ring-offset-slate-100");
    expect(html).not.toContain("Not authorized");
    expectNoPlaceholderCopy(html);
    expectNoPersonalData(html);
    expect(mocks.getRoomFeed).toHaveBeenCalledWith("a");
  });

  it("renders the English dashboard with TWD amounts and localized dates", async () => {
    const html = await renderRoom("a", "en");

    expect(html).toContain("Room A");
    expect(html).toContain("Bills");
    expect(html).toContain("Payments");
    expect(html).toContain("Lease dates");
    expect(html).toContain("Period 2026-10");
    expect(html).toContain("Total NT$900");
    expect(html).toContain("Rent</dt>");
    expect(html).toContain("NT$750</dd>");
    expect(html).toContain("Water</dt>");
    expect(html).toContain("NT$100</dd>");
    expect(html).toContain("Electricity</dt>");
    expect(html).toContain("NT$50</dd>");
    expect(html).toContain("due Nov 1, 2026");
    expect(html).toContain("open");
    expect(html).toContain("received Oct 5, 2026");
    expect(html).toContain("Last updated Nov 1, 2026, 12:00 PM");
    expect(html).toContain("Lease start");
    expect(html).toContain("Lease end");
    expect(html).toContain("Renewal decision due");
    expect(html).toContain("Nov 30, 2026");
    expect(html).toContain("Log out");
    expect(html).toContain('href="/zh-TW/rooms/a"');
    expect(html).not.toContain("本月租金");
    expectNoPlaceholderCopy(html);
    expectNoPersonalData(html);
  });

  it("renders room B without room A values", async () => {
    mocks.getSessionClaims.mockResolvedValue({
      role: "tenant",
      room: "b",
      v: 1,
      exp: 1,
    });
    mocks.getRoomSessionVersion.mockResolvedValue(1);
    mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_B });

    const html = await renderRoom("b", "en");

    expect(html).toContain("Room B");
    expect(html).toContain("Total NT$800");
    expect(html).toContain("No payments recorded yet.");
    expect(html).toContain("Lease dates are not available.");
    expect(html).not.toContain("NT$900");
    expect(html).not.toContain("2026-09");
    expect(mocks.getRoomFeed).toHaveBeenCalledWith("b");
  });
});

describe("room dashboard states", () => {
  it("renders the no-bills, no-payments, and no-lease empty states", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, openBills: [], payments: [], lease: null },
    });

    const html = await renderRoom("a");

    expect(html).toContain("尚無帳單。");
    expect(html).toContain("尚無付款紀錄。");
    expect(html).toContain("租約日期尚無法取得。");
    expect(html).toContain("最後更新");
    expectNoPlaceholderCopy(html);
  });

  it("renders the generic unavailable card for a structural failure", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });

    const html = await renderRoom("a");

    expect(html).toContain("資料暫時無法取得");
    expect(html).toContain("請聯絡房東。");
    expect(html).not.toContain("帳單");
    expect(html).not.toContain("付款");
    expect(html).not.toContain("租約日期");
    expectNoPlaceholderCopy(html);
  });

  it("catches a rejected feed call and hides the error message", async () => {
    mocks.getRoomFeed.mockRejectedValue(new Error("stack trace secret"));

    const html = await renderRoom("a", "en");

    expect(html).toContain("Data temporarily unavailable");
    expect(html).toContain("Please contact the landlord.");
    expect(html).not.toContain("stack trace secret");
    expect(html).not.toContain("Bills");
  });

  it("renders a missing lease while keeping bills and payments", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lease: null },
    });

    const html = await renderRoom("a");

    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toContain("租約日期尚無法取得。");
  });

  it("renders not-available when a lease has no renewal date", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: {
        ...FEED_A,
        lease: { ...FEED_A.lease!, renewalDue: null },
      },
    });

    expect(await renderRoom("a")).toContain("尚無資料");
    expect(await renderRoom("a", "en")).toContain("Not available");
  });
});

describe("room dashboard denial", () => {
  it("denies a tenant requesting another room without loading that room", async () => {
    const html = await renderRoom("b");

    expect(html).toContain("未獲授權");
    expect(html).toContain("您無權檢視此房間的儀表板。");
    expect(html).toContain("登出");
    expect(html).toContain('href="/zh-TW"');
    expect(html).not.toContain("房間 B");
    expect(html).not.toContain("70000");
    expect(mocks.getRoomFeed).not.toHaveBeenCalled();
  });

  it("denies a tenant whose code was reset after the session was issued", async () => {
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const html = await renderRoom("a", "en");

    expect(html).toContain("Not authorized");
    expect(html).toContain("Log out");
    expect(html).not.toContain("Bills");
    expect(mocks.getRoomFeed).not.toHaveBeenCalled();
  });

  it("denies an admin session and an anonymous request", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(0);
    const adminHtml = await renderRoom("a");
    expect(adminHtml).toContain("未獲授權");
    expect(adminHtml).not.toContain("登出");

    mocks.getSessionClaims.mockResolvedValue(null);
    const anonymousHtml = await renderRoom("a", "en");
    expect(anonymousHtml).toContain("Not authorized");
    expect(anonymousHtml).not.toContain("Log out");
    expect(mocks.getRoomFeed).not.toHaveBeenCalled();
  });
});
