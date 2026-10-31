import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const actionState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [actionState.value, vi.fn(), false],
  };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

import en from "@/lib/i18n/dictionaries/en";
import zhTW from "@/lib/i18n/dictionaries/zh-TW";
import LoginForm from "@/app/[lang]/login/login-form";
import AdminLoginForm from "@/app/[lang]/admin/login/admin-login-form";
import AdminResetForm from "@/app/[lang]/admin/reset-form";

beforeEach(() => {
  actionState.value = {};
});

describe("localized client forms", () => {
  it("renders the tenant sign-in form in Traditional Chinese", () => {
    const html = renderToStaticMarkup(
      createElement(LoginForm, { locale: "zh-TW", labels: zhTW.login }),
    );

    expect(html).toContain("房間");
    expect(html).toContain("門禁碼");
    expect(html).toContain("10 字元代碼");
    expect(html).toContain("登入");
    expect(html).toContain("房間 A");
  });

  it("maps the login error code to the active locale", () => {
    actionState.value = { error: "invalid-credentials" };

    const zh = renderToStaticMarkup(
      createElement(LoginForm, { locale: "zh-TW", labels: zhTW.login }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(LoginForm, { locale: "en", labels: en.login }),
    );

    expect(zh).toContain("房間或門禁碼不正確");
    expect(enHtml).toContain("Invalid room or access code");
  });

  it("renders the admin sign-in form and error in the active locale", () => {
    actionState.value = { error: "access-denied" };

    const zh = renderToStaticMarkup(
      createElement(AdminLoginForm, { locale: "zh-TW", labels: zhTW.adminLogin }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(AdminLoginForm, { locale: "en", labels: en.adminLogin }),
    );

    expect(zh).toContain("管理員密碼");
    expect(zh).toContain("存取遭拒");
    expect(enHtml).toContain("Admin password");
    expect(enHtml).toContain("Access denied");
  });

  it("renders the admin reset form and error in Traditional Chinese", () => {
    actionState.value = { status: "error", message: "invalid-room" };

    const html = renderToStaticMarkup(
      createElement(AdminResetForm, { locale: "zh-TW", labels: zhTW.admin }),
    );

    expect(html).toContain("新的 10 字元代碼");
    expect(html).toContain("重設代碼");
    expect(html).toContain("請選擇房間（A-E）。");
    expect(html).toContain("房間 A");
  });

  it("renders the localized reset success panel", () => {
    actionState.value = { status: "success", room: "b", code: "ABC1234567" };

    const zh = renderToStaticMarkup(
      createElement(AdminResetForm, { locale: "zh-TW", labels: zhTW.admin }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(AdminResetForm, { locale: "en", labels: en.admin }),
    );

    expect(zh).toContain("房間 B 的門禁碼已重設。");
    expect(zh).toContain("複製");
    expect(zh).toContain("此代碼只會顯示一次");
    expect(zh).toContain("重設其他房間");
    expect(enHtml).toContain("Room B access code reset.");
    expect(enHtml).toContain("Copy");
    expect(enHtml).toContain("This code is shown only once.");
    expect(enHtml).toContain("Reset another room");
  });
});
