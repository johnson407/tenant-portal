import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/app/[lang]/admin/login/admin-login-form", () => ({
  default: () => null,
}));

import AdminLoginPage, { generateMetadata } from "@/app/[lang]/admin/login/page";

const REDIRECT = new Error("NEXT_REDIRECT");

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionClaims.mockResolvedValue(null);
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

describe("localized admin sign-in page", () => {
  it("renders Traditional Chinese copy by default", async () => {
    const html = renderToStaticMarkup(
      await AdminLoginPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("管理員登入");
    expect(html).toContain("僅限房東存取。");
    expect(html).toContain('href="/en/admin/login"');
    expect(html).not.toContain("Admin sign in");
  });

  it("renders English copy when the URL selects English", async () => {
    const html = renderToStaticMarkup(
      await AdminLoginPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Admin sign in");
    expect(html).toContain("Landlord access only.");
    expect(html).toContain('href="/zh-TW/admin/login"');
  });

  it("provides a localized page title", async () => {
    const zh = await generateMetadata({ params: Promise.resolve({ lang: "zh-TW" }) });
    const en = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });

    expect(zh.title).toBe("管理員登入");
    expect(en.title).toBe("Admin sign in");
  });

  it("redirects an admin session to the localized admin page", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });

    await expect(
      AdminLoginPage({ params: Promise.resolve({ lang: "en" }) }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/admin");
  });
});
