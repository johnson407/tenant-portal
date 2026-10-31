import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getTenantRoom: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  getTenantRoom: undefined,
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/lib/session-cookies", () => ({
  getTenantRoom: mocks.getTenantRoom,
}));

vi.mock("@/app/[lang]/login/login-form", () => ({
  default: () => null,
}));

import LoginPage, { generateMetadata } from "@/app/[lang]/login/page";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getTenantRoom.mockResolvedValue(null);
});

describe("localized tenant sign-in page", () => {
  it("renders Traditional Chinese copy by default", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("租客登入");
    expect(html).toContain("請選擇您的房間並輸入門禁碼。");
    expect(html).toContain("房東嗎？");
    expect(html).toContain("管理區");
    expect(html).toContain('href="/zh-TW/admin/login"');
    expect(html).toContain('href="/en/login"');
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]");
    expect(html).toContain("租客入口");
    expect(html).toContain("查看租金帳單、付款與租約日期。");
    expect(html).not.toContain("Tenant sign in");
  });

  it("renders English copy when the URL selects English", async () => {
    const html = renderToStaticMarkup(await LoginPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(html).toContain("Tenant sign in");
    expect(html).toContain("Select your room and enter your access code.");
    expect(html).toContain("Landlord?");
    expect(html).toContain('href="/en/admin/login"');
    expect(html).toContain('href="/zh-TW/login"');
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]");
    expect(html).toContain("Tenant Portal");
    expect(html).toContain("View rent bills, payments, and lease dates.");
  });

  it("provides a localized page title", async () => {
    const zh = await generateMetadata({ params: Promise.resolve({ lang: "zh-TW" }) });
    const en = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });

    expect(zh.title).toBe("租客登入");
    expect(en.title).toBe("Tenant sign in");
  });

  it("redirects a signed-in tenant to the localized home", async () => {
    mocks.getTenantRoom.mockResolvedValue("a");
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(LoginPage({ params: Promise.resolve({ lang: "en" }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/en");
  });
});
