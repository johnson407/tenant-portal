import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  getRoomSessionVersion: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

import RoomPage from "@/app/[lang]/rooms/[room]/page";

async function renderRoom(room: string, lang = "zh-TW"): Promise<string> {
  const ui = await RoomPage({ params: Promise.resolve({ lang, room }) });
  return renderToStaticMarkup(ui);
}

function expectNoPersonalData(html: string) {
  expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  expect(html).not.toMatch(/\+886/);
  expect(html).not.toMatch(/\b09\d{8}\b/);
}

beforeEach(() => {
  mocks.getSessionClaims.mockReset();
  mocks.getRoomSessionVersion.mockReset();
});

describe("room dashboard authorization", () => {
  it("renders the tenant's own room when the session version is current", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(4);

    const html = await renderRoom("a");

    expect(html).toContain("房間 A");
    expect(html).toContain("範例資料 - 僅供示範");
    expect(html).toContain("帳單");
    expect(html).toContain("付款");
    expect(html).toContain("租約日期");
    expect(html).toContain("本月租金");
    expect(html).toContain("水電費");
    expect(html).toContain("上月租金");
    expect(html).toContain("未付款");
    expect(html).toContain("到期");
    expect(html).toContain("已收款");
    expect(html).toContain("租約開始");
    expect(html).toContain("登出");
    expect(html).toContain("$750.00");
    expect(html).toContain("2026年11月1日");
    expect(html).toContain('href="/en/rooms/a"');
    expect(html).toContain("hover:bg-slate-200");
    expect(html).toContain("focus-visible:ring-slate-700");
    expect(html).toContain("focus-visible:ring-offset-slate-100");
    expect(html).not.toContain("Not authorized");
    expect(html).not.toContain("Rent - current month");
    expectNoPersonalData(html);
  });

  it("renders the English dashboard with TWD amounts and localized dates", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(4);

    const html = await renderRoom("a", "en");

    expect(html).toContain("Room A");
    expect(html).toContain("Rent - current month");
    expect(html).toContain("Utilities");
    expect(html).toContain("Rent - previous month");
    expect(html).toContain("NT$750.00");
    expect(html).toContain("Nov 1, 2026");
    expect(html).toContain("due");
    expect(html).toContain("open");
    expect(html).toContain("received");
    expect(html).toContain("Log out");
    expect(html).toContain('href="/zh-TW/rooms/a"');
    expect(html).not.toContain("本月租金");
    expectNoPersonalData(html);
  });

  it("denies a tenant requesting another room and does not render that room's data", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(4);

    const html = await renderRoom("b");

    expect(html).toContain("未獲授權");
    expect(html).toContain("您無權檢視此房間的儀表板。");
    expect(html).toContain("登出");
    expect(html).toContain('href="/zh-TW"');
    expect(html).not.toContain("房間 B");
    expect(html).not.toContain("70000");
  });

  it("denies a tenant whose code was reset after the session was issued", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const html = await renderRoom("a", "en");

    expect(html).toContain("Not authorized");
    expect(html).toContain("Log out");
    expect(html).not.toContain("Rent - current month");
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
  });
});
