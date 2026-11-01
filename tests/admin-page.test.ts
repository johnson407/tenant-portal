import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  getBankAccount: vi.fn(),
  listPendingClaims: vi.fn(),
  resetForm: vi.fn(),
  bankForm: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/lib/bank-account", () => ({
  getBankAccount: mocks.getBankAccount,
}));

vi.mock("@/lib/appfeed/claims", () => ({
  listPendingClaims: mocks.listPendingClaims,
}));

vi.mock("@/app/[lang]/admin/reset-form", () => ({
  default: mocks.resetForm,
}));

vi.mock("@/app/[lang]/admin/bank-form", () => ({
  default: mocks.bankForm,
}));

import AdminPage, { generateMetadata } from "@/app/[lang]/admin/page";

const REDIRECT = new Error("NEXT_REDIRECT");

const SAVED = {
  bankName: "玉山銀行",
  recipientName: "王小明",
  bankCode: "808",
  accountNo: "0123456789012",
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
  mocks.getBankAccount.mockResolvedValue(null);
  mocks.listPendingClaims.mockResolvedValue({ kind: "ok", claims: [] });
  mocks.resetForm.mockReturnValue(null);
  mocks.bankForm.mockReturnValue(null);
});

describe("localized admin page", () => {
  it("renders the Traditional Chinese heading and logout control", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("管理後台");
    expect(html).toContain("重設房間門禁碼，並維護租客看到的租金匯款帳戶。");
    expect(html).toContain("登出");
    expect(html).toContain('href="/en/admin"');
    expect(html).toContain('href="/zh-TW/admin"');
    expect(html).toContain("focus-visible:ring-slate-300");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("lg:items-start");
    expect(html).toMatch(/<header[\s\S]*登出[\s\S]*<\/header>/);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("renders the English heading when the URL selects English", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Reset room access codes and maintain the bank account shown to tenants.");
    expect(html).toContain("Log out");
    expect(html).toContain('href="/zh-TW/admin"');
    expect(html).toContain('href="/en/admin"');
  });

  it("provides a localized page title", async () => {
    const zh = await generateMetadata({ params: Promise.resolve({ lang: "zh-TW" }) });
    const en = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });

    expect(zh.title).toBe("管理員");
    expect(en.title).toBe("Admin");
  });

  it("redirects a non-admin session to the localized admin login", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    await expect(
      AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/admin/login");
    expect(mocks.getBankAccount).not.toHaveBeenCalled();
    expect(mocks.listPendingClaims).not.toHaveBeenCalled();
  });

  it("passes saved values to the bank form for prefill", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.getBankAccount.mockResolvedValue(SAVED);

    renderToStaticMarkup(await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }));

    expect(mocks.bankForm).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-TW", initialValues: SAVED }),
      undefined,
    );
  });

  it("renders an empty bank form when no record exists", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    renderToStaticMarkup(await AdminPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(mocks.getBankAccount).toHaveBeenCalledTimes(1);
    expect(mocks.bankForm).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en", initialValues: null }),
      undefined,
    );
  });

  it("shows the unavailable notice instead of the form when the read fails", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.getBankAccount.mockRejectedValue(new Error("kv down"));

    const zh = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );
    const enHtml = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(zh).toContain("銀行帳戶資料暫時無法取得，請稍後再試。");
    expect(zh).toContain('<h2 class="text-xl font-semibold">租金匯款帳戶</h2>');
    expect(enHtml).toContain("Bank account details are temporarily unavailable. Try again later.");
    expect(mocks.bankForm).not.toHaveBeenCalled();
    expect(mocks.resetForm).toHaveBeenCalled();
  });
});

describe("admin payment claims", () => {
  const CLAIM = {
    room: "a",
    period: "2026-11",
    claimedOn: "2026-10-30",
    bankLast5: "01234",
  };

  it("lists pending claims with the full suffix and a formatted date", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listPendingClaims.mockResolvedValue({ kind: "ok", claims: [CLAIM] });

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("待確認的付款回報");
    expect(html).toContain(">a</td>");
    expect(html).toContain("2026-11");
    expect(html).toContain("2026年10月30日");
    expect(html).toContain("01234");
    expect(mocks.listPendingClaims).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when no claim is pending", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Pending payment claims");
    expect(html).toContain("No pending payment claims.");
  });

  it("shows the unavailable notice and keeps the reset and bank cards", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listPendingClaims.mockRejectedValue(new Error("sheet down"));

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Payment claims are temporarily unavailable. Try again later.");
    expect(mocks.getBankAccount).toHaveBeenCalledTimes(1);
    expect(mocks.resetForm).toHaveBeenCalled();
    expect(mocks.bankForm).toHaveBeenCalled();
  });

  it("places the full-width claims card after the reset and bank cards", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.resetForm.mockReturnValue("reset-card");
    mocks.bankForm.mockReturnValue("bank-card");

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    const resetAt = html.indexOf("reset-card");
    const bankAt = html.indexOf("bank-card");
    const claimsAt = html.indexOf("Pending payment claims");

    expect(html).toContain("grid gap-6 lg:grid-cols-2");
    expect(html).toContain("lg:col-span-2");
    expect(resetAt).toBeGreaterThan(-1);
    expect(bankAt).toBeGreaterThan(resetAt);
    expect(claimsAt).toBeGreaterThan(bankAt);
  });
});
