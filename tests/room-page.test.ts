import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RoomFeed, RoomRepair } from "@/lib/appfeed/types";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  getRoomSessionVersion: vi.fn(),
  getRoomFeed: vi.fn(),
  getRoomRepairs: vi.fn(),
  getBankAccount: vi.fn(),
  isAdminSession: vi.fn(),
  todayInTaipei: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

vi.mock("@/lib/appfeed/feed", () => ({
  getRoomFeed: mocks.getRoomFeed,
}));

vi.mock("@/lib/appfeed/repairs", () => ({
  getRoomRepairs: mocks.getRoomRepairs,
}));

vi.mock("@/lib/bank-account", () => ({
  getBankAccount: mocks.getBankAccount,
}));

vi.mock("@/lib/appfeed/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appfeed/dates")>();
  return { ...actual, todayInTaipei: mocks.todayInTaipei };
});

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

import RoomPage, { generateMetadata } from "@/app/[lang]/rooms/[room]/page";

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
      claim: null,
      waterBreakdown: { start: 1000, end: 1010, units: 10, rate: 10 },
      electricityBreakdown: { start: 2000, end: 2010, units: 10, rate: 5 },
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
  lastConfirmation: null,
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
      claim: null,
      waterBreakdown: null,
      electricityBreakdown: null,
    },
  ],
  payments: [],
  lease: null,
  lastConfirmation: null,
  fetchedAt: "2026-11-01T04:00:00.000Z",
};

const REPAIR_PENDING: RoomRepair = {
  requestId: "0123456789abcdef",
  category: "plumbing",
  note: "Leaking tap in the bathroom",
  submittedOn: "2026-10-30",
  status: "pending",
  visitStart: null,
  visitEnd: null,
  doneOn: null,
};

const REPAIR_DONE: RoomRepair = {
  requestId: "fedcba9876543210",
  category: "electrical",
  note: "Fixed light in the kitchen",
  submittedOn: "2026-10-20",
  status: "done",
  visitStart: null,
  visitEnd: null,
  doneOn: "2026-10-25",
};

async function renderRoom(room: string, lang = "zh-TW"): Promise<string> {
  const ui = await RoomPage({ params: Promise.resolve({ lang, room }) });
  return renderToStaticMarkup(ui);
}

function renewalBanner(html: string): string {
  return (
    html.match(
      /<section[^>]*aria-labelledby="renewal-reminder-heading"[\s\S]*?<\/section>/,
    )?.[0] ?? ""
  );
}

function summaryText(html: string): string | undefined {
  return html
    .match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
    .replace(/<[^>]*>/g, "")
    .trim();
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
  mocks.getRoomRepairs.mockReset();
  mocks.getBankAccount.mockReset();
  mocks.todayInTaipei.mockReset();

  mocks.todayInTaipei.mockReturnValue("2026-06-01");
  mocks.getSessionClaims.mockResolvedValue({
    role: "tenant",
    room: "a",
    v: 4,
    exp: 1,
  });
  mocks.getRoomSessionVersion.mockResolvedValue(4);
  mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_A });
  mocks.getRoomRepairs.mockResolvedValue({
    kind: "ok",
    repairs: [],
    lastDone: null,
  });
  mocks.getBankAccount.mockResolvedValue(null);
});

describe("room dashboard authorization", () => {
  it("renders the tenant's own room when the session version is current", async () => {
    const html = await renderRoom("a");

    expect(html).toContain("房間 A");
    expect(html).toContain("帳單");
    expect(html).toContain("付款");
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
    expect(html).toContain("hover:bg-slate-800");
    expect(html).toContain("focus-visible:ring-slate-300");
    expect(html).toContain("focus-visible:ring-offset-slate-950");
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

describe("room dashboard renewal reminder", () => {
  it("shows the reminder exactly 60 days before the lease end", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-11-01");

    const html = await renderRoom("a");

    expect(html).toContain("租約續約提醒");
    expect(html).toContain("2026年12月31日");
    expect(html).toContain("請聯絡房東討論續約");

    const bannerIndex = html.indexOf("租約續約提醒");
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeLessThan(html.indexOf("租約開始"));
    expect(bannerIndex).toBeLessThan(html.indexOf("帳單"));
  });

  it("hides the reminder 61 days before the lease end", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-10-31");

    const html = await renderRoom("a");

    expect(html).not.toContain("租約續約提醒");
    expect(html).toContain("租約開始");
  });

  it("shows the reminder on the lease end date", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-12-31");

    const html = await renderRoom("a");

    expect(html).toContain("租約續約提醒");
    expect(html).toContain("2026年12月31日");
  });

  it("hides the reminder the day after the lease end", async () => {
    mocks.todayInTaipei.mockReturnValue("2027-01-01");

    const html = await renderRoom("a");

    expect(html).not.toContain("租約續約提醒");
  });

  it("keeps the reminder when a renewal decision date is set", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-11-01");

    const html = await renderRoom("a");

    expect(html).toContain("租約續約提醒");
    expect(html).toContain("續約決定截止日");
    expect(html).toContain("2026年11月30日");
  });

  it("shows no reminder when the room has no lease", async () => {
    mocks.getSessionClaims.mockResolvedValue({
      role: "tenant",
      room: "b",
      v: 1,
      exp: 1,
    });
    mocks.getRoomSessionVersion.mockResolvedValue(1);
    mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_B });
    mocks.todayInTaipei.mockReturnValue("2026-12-01");

    const html = await renderRoom("b");

    expect(html).not.toContain("租約續約提醒");
  });

  it("shows no reminder when the room feed is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });
    mocks.todayInTaipei.mockReturnValue("2026-12-01");

    const html = await renderRoom("a");

    expect(html).not.toContain("租約續約提醒");
    expect(html).toContain("房間 A");
  });

  it("localizes the reminder heading and date in English", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-11-01");

    const html = await renderRoom("a", "en");

    expect(html).toContain("Lease renewal");
    expect(html).toContain("Dec 31, 2026");
    expect(html).toContain("Contact the landlord to discuss renewal.");
  });

  it("wraps the reminder without a fixed width or nowrap class", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-11-01");

    const banner = renewalBanner(await renderRoom("a"));

    expect(banner).toContain("flex flex-wrap");
    expect(banner).toContain("break-words");
    expect(banner).not.toContain("whitespace-nowrap");
    expect(banner).not.toContain("<button");
    expect(banner).not.toContain("<form");
  });

  it("does not show another room's reminder", async () => {
    mocks.getSessionClaims.mockResolvedValue({
      role: "tenant",
      room: "b",
      v: 1,
      exp: 1,
    });
    mocks.getRoomSessionVersion.mockResolvedValue(1);
    mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_B });
    mocks.todayInTaipei.mockReturnValue("2026-12-01");

    const html = await renderRoom("b", "en");

    expect(html).not.toContain("Lease renewal");
    expect(html).not.toContain("Room A");
  });
});

describe("room dashboard layout", () => {
  it("renders lease facts inside the header before the bills section", async () => {
    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toMatch(
      /<header[\s\S]*租約開始[\s\S]*租約結束[\s\S]*續約決定截止日[\s\S]*<\/header>/,
    );
    expect(en).toMatch(
      /<header[\s\S]*Lease start[\s\S]*Lease end[\s\S]*Renewal decision due[\s\S]*<\/header>/,
    );
    expect(zh.indexOf("租約開始")).toBeLessThan(zh.indexOf("帳單"));
    expect(en.indexOf("Lease start")).toBeLessThan(en.indexOf("Bills"));
    expect(zh).not.toMatch(/<h2[^>]*>租約日期<\/h2>/);
    expect(en).not.toMatch(/<h2[^>]*>Lease dates<\/h2>/);
  });

  it("renders payment history in a collapsed disclosure labeled Payments", async () => {
    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toMatch(/<details[^>]*>[\s\S]*<summary[^>]*>/);
    expect(en).toMatch(/<details[^>]*>[\s\S]*<summary[^>]*>/);
    expect(summaryText(zh)).toBe("付款");
    expect(summaryText(en)).toBe("Payments");
    expect(zh).not.toMatch(/<details[^>]*\sopen(?:[=\s>])/);
    expect(en).not.toMatch(/<details[^>]*\sopen(?:[=\s>])/);

    const zhDetails = zh.match(/<details[^>]*>[\s\S]*<\/details>/)?.[0] ?? "";
    const enDetails = en.match(/<details[^>]*>[\s\S]*<\/details>/)?.[0] ?? "";
    expect(zhDetails).toContain("期別 2026-09");
    expect(zhDetails).toContain("$700");
    expect(zhDetails).toContain("已收款 2026年10月5日");
    expect(enDetails).toContain("Period 2026-09");
    expect(enDetails).toContain("NT$700");
    expect(enDetails).toContain("received Oct 5, 2026");
  });

  it("gives the payments disclosure a visible keyboard focus ring", async () => {
    const html = await renderRoom("a");
    const summary = html.match(/<summary[^>]*>/)?.[0] ?? "";

    expect(summary).toContain("focus-visible:ring-2");
    expect(summary).toContain("focus-visible:ring-slate-300");
    expect(summary).toContain("focus-visible:ring-offset-2");
    expect(summary).toContain("focus-visible:ring-offset-slate-900");
    expect(summary).not.toContain("focus-visible:outline-none");
  });

  it("renders the lease stat strip, bill card badge, and responsive two-column grid", async () => {
    const html = await renderRoom("a");

    expect(html).toContain('class="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-slate-800"');
    expect(html).toContain("lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]");
    expect(html).toContain('href="/zh-TW/rooms/a"');
    expect(html).toContain("rounded-md border border-slate-800 bg-slate-950/50 p-4");
    expect(html).toMatch(
      /<span class="[^"]*rounded-full[^"]*bg-amber-950[^"]*">未付款<\/span>/,
    );

    const english = await renderRoom("a", "en");
    expect(english).toMatch(
      /<span class="[^"]*rounded-full[^"]*bg-amber-950[^"]*">open<\/span>/,
    );
  });
});

describe("room dashboard latest update", () => {
  const CONFIRMED = {
    date: "2026-10-28",
    note: "Transfer received.",
  };

  function withRepair(
    date: string,
    note: string | null,
  ): { kind: "ok"; repairs: RoomRepair[]; lastDone: { date: string; note: string | null } } {
    return {
      kind: "ok",
      repairs: [REPAIR_DONE],
      lastDone: { date, note },
    };
  }

  it("shows a completed repair in the header before the bills", async () => {
    mocks.getRoomRepairs.mockResolvedValue(
      withRepair("2026-10-30", "Fixed light in the kitchen"),
    );

    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toContain("最新動態");
    expect(zh).toContain("報修已完成");
    expect(zh).toContain("2026年10月30日");
    expect(zh).toContain("說明:");
    expect(zh).toContain("Fixed light in the kitchen");
    expect(en).toContain("Latest update");
    expect(en).toContain("Repair completed");
    expect(en).toContain("Oct 30, 2026");
    expect(en).toContain("Note:");
    expect(zh.indexOf("最新動態")).toBeLessThan(zh.indexOf("帳單"));
    expect(zh).toMatch(/<header[\s\S]*最新動態[\s\S]*<\/header>/);
  });

  it("shows a confirmed claim instead of an older repair", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lastConfirmation: CONFIRMED },
    });
    mocks.getRoomRepairs.mockResolvedValue(withRepair("2026-10-25", "Old note"));

    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toContain("付款已確認");
    expect(zh).toContain("2026年10月28日");
    expect(zh).toContain("Transfer received.");
    expect(zh).not.toContain("報修已完成");
    expect(en).toContain("Payment confirmed");
    expect(en).toContain("Oct 28, 2026");
  });

  it("shows the later repair when it is newer than the claim", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lastConfirmation: CONFIRMED },
    });
    mocks.getRoomRepairs.mockResolvedValue(withRepair("2026-10-30", "New note"));

    const html = await renderRoom("a");

    expect(html).toContain("報修已完成");
    expect(html).toContain("2026年10月30日");
    expect(html).not.toContain("付款已確認");
  });

  it("gives the claim the tie on the same date", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lastConfirmation: CONFIRMED },
    });
    mocks.getRoomRepairs.mockResolvedValue(withRepair("2026-10-28", "Tie note"));

    const html = await renderRoom("a");

    expect(html).toContain("付款已確認");
    expect(html).not.toContain("報修已完成");
    expect(html).not.toContain("Tie note");
  });

  it("renders no line when the room has no qualifying event", async () => {
    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).not.toContain("最新動態");
    expect(en).not.toContain("Latest update");
    expect(zh).toContain("最後更新 2026年11月1日");
  });

  it("keeps the repair line when Bills is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });
    mocks.getRoomRepairs.mockResolvedValue(withRepair("2026-10-30", "Repair only"));

    const html = await renderRoom("a");

    expect(html).toContain("報修已完成");
    expect(html).toContain("Repair only");
  });

  it("keeps the claim line when Repairs is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lastConfirmation: CONFIRMED },
    });
    mocks.getRoomRepairs.mockResolvedValue({ kind: "unavailable" });

    const html = await renderRoom("a");

    expect(html).toContain("付款已確認");
    expect(html).toContain("Transfer received.");
  });

  it("renders no line when both sources are unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });
    mocks.getRoomRepairs.mockResolvedValue({ kind: "unavailable" });

    const html = await renderRoom("a");

    expect(html).not.toContain("最新動態");
    expect(html).not.toContain("Latest update");
  });
});

describe("room dashboard meter breakdown", () => {
  it("shows the water meter breakdown under the amount in zh-TW", async () => {
    const html = await renderRoom("a");

    expect(html).toContain("1,000 - 1,010：10 度 × $10");
    expect(html).toContain("2,000 - 2,010：10 度 × $5");
  });

  it("shows the water meter breakdown under the amount in English", async () => {
    const html = await renderRoom("a", "en");

    expect(html).toContain("1,000 - 1,010: 10 x NT$10");
    expect(html).toContain("2,000 - 2,010: 10 x NT$5");
  });

  it("shows no breakdown line for a bill with a blank group", async () => {
    mocks.getSessionClaims.mockResolvedValue({
      role: "tenant",
      room: "b",
      v: 1,
      exp: 1,
    });
    mocks.getRoomSessionVersion.mockResolvedValue(1);
    mocks.getRoomFeed.mockResolvedValue({ kind: "ok", feed: FEED_B });

    const html = await renderRoom("b", "en");

    expect(html).not.toMatch(/\d[\d,]* - \d[\d,]*[：:]/);
  });

  it("keeps meter readings out of the payment disclosure", async () => {
    const html = await renderRoom("a", "en");
    const details = html.match(/<details[^>]*>[\s\S]*<\/details>/)?.[0] ?? "";

    expect(details).toContain("Period 2026-09");
    expect(details).not.toMatch(/\d[\d,]* - \d[\d,]*[：:]/);
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
    expect(html).toMatch(/<details[^>]*>[\s\S]*尚無付款紀錄。[\s\S]*<\/details>/);
    expect(html).toMatch(/<header[\s\S]*租約日期尚無法取得。[\s\S]*<\/header>/);
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
    expect(html).not.toContain("<details");
    expect(html).not.toContain("租約開始");
    expect(html).not.toContain("租約日期尚無法取得。");
    expectNoPlaceholderCopy(html);
  });

  it("catches a rejected feed call and hides the error message", async () => {
    mocks.getRoomFeed.mockRejectedValue(new Error("stack trace secret"));

    const html = await renderRoom("a", "en");

    expect(html).toContain("Data temporarily unavailable");
    expect(html).toContain("Please contact the landlord.");
    expect(html).not.toContain("stack trace secret");
    expect(html).not.toContain("Bills");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Lease start");
  });

  it("renders a missing lease while keeping bills and payments", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, lease: null },
    });

    const html = await renderRoom("a");

    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toMatch(/<header[\s\S]*租約日期尚無法取得。[\s\S]*<\/header>/);
  });

  it("renders not-available when a lease has no renewal date", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: {
        ...FEED_A,
        lease: { ...FEED_A.lease!, renewalDue: null },
      },
    });

    expect(await renderRoom("a")).toMatch(/<header[\s\S]*尚無資料[\s\S]*<\/header>/);
    expect(await renderRoom("a", "en")).toMatch(/<header[\s\S]*Not available[\s\S]*<\/header>/);
  });
});

const BANK = {
  bankName: "玉山銀行",
  recipientName: "王小明",
  bankCode: "808",
  accountNo: "0123456789012",
};

describe("room dashboard bank account", () => {
  it("shows all four values in the active locale", async () => {
    mocks.getBankAccount.mockResolvedValue(BANK);

    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toContain("租金匯款帳戶");
    expect(zh).toContain("玉山銀行");
    expect(zh).toContain("王小明");
    expect(zh).toContain("808");
    expect(zh).toContain("0123456789012");
    expect(zh).toMatch(/租金匯款帳戶[\s\S]*玉山銀行[\s\S]*0123456789012/);

    expect(en).toContain("Rent bank account");
    expect(en).toContain("Bank");
    expect(en).toContain("Recipient");
    expect(en).toContain("Bank code");
    expect(en).toContain("Account number");
    expect(en).toContain("0123456789012");
  });

  it("still shows bank details when AppFeed is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });
    mocks.getBankAccount.mockResolvedValue(BANK);

    const html = await renderRoom("a");

    expect(html).toContain("資料暫時無法取得");
    expect(html).toContain("租金匯款帳戶");
    expect(html).toContain("0123456789012");
  });

  it("omits the section entirely when no record exists", async () => {
    const html = await renderRoom("a");

    expect(html).not.toContain("租金匯款帳戶");
    expect(html).not.toContain(BANK.recipientName);
    expect(html).not.toContain(BANK.accountNo);
  });

  it("hides only the bank section when the read fails", async () => {
    mocks.getBankAccount.mockRejectedValue(new Error("kv secret"));

    const html = await renderRoom("a");

    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toContain("租約開始");
    expect(html).not.toContain("租金匯款帳戶");
    expect(html).not.toContain("kv secret");
  });
});

describe("room dashboard payment claims", () => {
  it("renders a claim form on an open bill", async () => {
    const html = await renderRoom("a");

    expect(html).toContain('name="period"');
    expect(html).toContain('value="2026-10"');
    expect(html).toContain('name="claimedOn"');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="bankLast5"');
    expect(html).toMatch(/maxlength="5"/i);
    expect(html).toMatch(/inputmode="numeric"/i);
    expect(html).toContain("回報付款");
  });

  it("shows a pending claim with only the last two suffix digits", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: {
        ...FEED_A,
        openBills: [
          {
            ...FEED_A.openBills[0],
            claim: { claimedOn: "2026-10-28", bankLast5: "01234" },
          },
        ],
      },
    });

    const zh = await renderRoom("a");
    const en = await renderRoom("a", "en");

    expect(zh).toContain("已於 2026年10月28日 回報付款");
    expect(zh).toContain("•••34");
    expect(zh).not.toContain("01234");
    expect(zh).toContain('name="bankLast5"');
    expect(zh).toContain('name="claimedOn"');
    expect(zh).toContain('value="2026-10-28"');

    expect(en).toContain("Payment reported on Oct 28, 2026");
    expect(en).toContain("•••34");
    expect(en).not.toContain("01234");
  });

  it("shows no form on a paid bill", async () => {
    mocks.getRoomFeed.mockResolvedValue({
      kind: "ok",
      feed: { ...FEED_A, openBills: [] },
    });

    const html = await renderRoom("a");

    expect(html).toContain("已收款 2026年10月5日");
    expect(html).not.toContain('name="bankLast5"');
    expect(html).not.toContain("回報付款");
  });

  it("shows no form when the feed is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });

    const html = await renderRoom("a");

    expect(html).not.toContain('name="bankLast5"');
    expect(html).not.toContain("回報付款");
  });
});

describe("room dashboard repairs", () => {
  it("renders the form and history with the pending request first", async () => {
    mocks.getRoomRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR_PENDING, REPAIR_DONE],
      lastDone: { date: "2026-10-25", note: null },
    });

    const html = await renderRoom("a");

    expect(html).toContain("報修申請");
    expect(html).toContain("送出報修申請");
    expect(html).toContain('name="category"');
    expect(html).toContain('name="note"');
    expect(html).toMatch(/maxlength="200"/i);
    expect(html).toContain("水管");
    expect(html).toContain("Leaking tap in the bathroom");
    expect(html).toContain("待處理");
    expect(html).toContain("已完成");
    expect(html).toContain("2026年10月30日");
    expect(html).toContain("2026年10月25日");
    expect(html.indexOf("Leaking tap")).toBeLessThan(
      html.indexOf("Fixed light"),
    );
    expect(mocks.getRoomRepairs).toHaveBeenCalledWith("a");
  });

  it("renders the repair form and history in English", async () => {
    mocks.getRoomRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR_PENDING, REPAIR_DONE],
      lastDone: { date: "2026-10-25", note: null },
    });

    const html = await renderRoom("a", "en");

    expect(html).toContain("Repair requests");
    expect(html).toContain("Send repair request");
    expect(html).toContain("Plumbing");
    expect(html).toContain("Electrical");
    expect(html).toContain("Pending");
    expect(html).toContain("Done");
    expect(html).toContain("Oct 30, 2026");
    expect(html).toContain("Oct 25, 2026");
  });

  it("shows the scheduled status and visit window in the active locale", async () => {
    mocks.getRoomRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [
        {
          ...REPAIR_PENDING,
          status: "scheduled",
          visitStart: "2026-11-04T09:00+08:00",
          visitEnd: "2026-11-04T12:00+08:00",
        },
      ],
      lastDone: null,
    });

    const en = await renderRoom("a", "en");
    expect(en).toContain("Scheduled");
    expect(en).toContain("Planned visit");
    expect(en).toContain("Nov 4, 2026");

    const zh = await renderRoom("a");
    expect(zh).toContain("已安排");
    expect(zh).toContain("預計到訪時間");
  });

  it("keeps the form and shows the empty state when there are no requests", async () => {
    const html = await renderRoom("a");

    expect(html).toContain("送出報修申請");
    expect(html).toContain("尚無報修申請。");
    expect(html.indexOf("送出報修申請")).toBeLessThan(
      html.indexOf("尚無報修申請。"),
    );
  });

  it("hides the form and history when repairs are unavailable", async () => {
    mocks.getRoomRepairs.mockResolvedValue({ kind: "unavailable" });

    const html = await renderRoom("a");

    expect(html).toContain("報修資料暫時無法取得");
    expect(html).not.toContain('name="category"');
    expect(html).not.toContain('name="note"');
    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toContain("租約開始");
  });

  it("keeps bills visible when the repair read fails", async () => {
    mocks.getRoomRepairs.mockRejectedValue(new Error("sheet secret"));

    const html = await renderRoom("a", "en");

    expect(html).toContain("Repair requests are temporarily unavailable");
    expect(html).toContain("Bills");
    expect(html).toContain("Payments");
    expect(html).toContain("Lease start");
    expect(html).not.toContain("sheet secret");
    expect(html).not.toContain('name="category"');
  });

  it("keeps the repair section visible when the feed is unavailable", async () => {
    mocks.getRoomFeed.mockResolvedValue({ kind: "unavailable" });
    mocks.getRoomRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR_PENDING],
      lastDone: null,
    });

    const html = await renderRoom("a", "en");

    expect(html).toContain("Data temporarily unavailable");
    expect(html).toContain("Repair requests");
    expect(html).toContain("Leaking tap in the bathroom");
    expect(html).toContain("Send repair request");
  });
});

describe("room dashboard metadata", () => {
  it("does not include bank details in page metadata", async () => {
    mocks.getBankAccount.mockResolvedValue(BANK);

    const metadata = await generateMetadata({
      params: Promise.resolve({ lang: "zh-TW", room: "a" }),
    });

    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toContain(BANK.recipientName);
    expect(serialized).not.toContain(BANK.bankCode);
    expect(serialized).not.toContain(BANK.accountNo);
    expect(mocks.getBankAccount).not.toHaveBeenCalled();
  });
});

describe("room dashboard denial", () => {
  it("denies a tenant requesting another room without loading that room", async () => {
    mocks.getBankAccount.mockResolvedValue(BANK);

    const html = await renderRoom("b");

    expect(html).toContain("未獲授權");
    expect(html).toContain("您無權檢視此房間的儀表板。");
    expect(html).toContain("返回您的儀表板");
    expect(html).toContain("登出");
    expect(html.split("登出")).toHaveLength(2);
    expect(html).toContain('href="/zh-TW"');
    expect(html).toContain(
      "rounded-lg border border-slate-800 bg-slate-900 p-8 text-center text-slate-100",
    );
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).not.toContain("房間 B");
    expect(html).not.toContain("70000");
    expect(html).not.toContain(BANK.recipientName);
    expect(html).not.toContain(BANK.accountNo);
    expect(html).not.toContain("租金匯款帳戶");
    expect(mocks.getRoomFeed).not.toHaveBeenCalled();
    expect(mocks.getBankAccount).not.toHaveBeenCalled();
  });

  it("denies a tenant whose code was reset after the session was issued", async () => {
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const html = await renderRoom("a", "en");

    expect(html).toContain("Not authorized");
    expect(html).toContain("Back to your dashboard");
    expect(html.split("Log out")).toHaveLength(2);
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
