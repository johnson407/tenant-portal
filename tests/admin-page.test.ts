import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  getBankAccount: vi.fn(),
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
    expect(html).toContain("focus-visible:ring-slate-300");
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
