import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
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

vi.mock("@/app/[lang]/admin/reset-form", () => ({
  default: () => null,
}));

import AdminPage, { generateMetadata } from "@/app/[lang]/admin/page";

const REDIRECT = new Error("NEXT_REDIRECT");

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

describe("localized admin page", () => {
  it("renders the Traditional Chinese heading and logout control", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("房間門禁碼");
    expect(html).toContain("重設任何房間的門禁碼。");
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

    expect(html).toContain("Room access codes");
    expect(html).toContain("Reset the access code for any room.");
    expect(html).toContain("Log out");
    expect(html).toContain('href="/zh-TW/admin"');
  });

  it("provides a localized page title", async () => {
    const zh = await generateMetadata({ params: Promise.resolve({ lang: "zh-TW" }) });
    const en = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });

    expect(zh.title).toBe("管理員 - 重設房間門禁碼");
    expect(en.title).toBe("Admin - Reset room code");
  });

  it("redirects a non-admin session to the localized admin login", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    await expect(
      AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/admin/login");
  });
});
