import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const actionState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  pending: false,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [actionState.value, vi.fn(), actionState.pending],
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
import AdminBankForm from "@/app/[lang]/admin/bank-form";

beforeEach(() => {
  actionState.value = {};
  actionState.pending = false;
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

describe("admin bank form", () => {
  const saved = {
    bankName: "玉山銀行",
    recipientName: "王小明",
    bankCode: "808",
    accountNo: "0123456789012",
  };

  it("renders prefilled bank values in Traditional Chinese", () => {
    const html = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "zh-TW",
        labels: zhTW.admin.bank,
        initialValues: saved,
      }),
    );

    expect(html).toContain("銀行名稱");
    expect(html).toContain("受款人姓名");
    expect(html).toContain("銀行代號");
    expect(html).toContain("帳號");
    expect(html).toContain('value="玉山銀行"');
    expect(html).toContain('value="王小明"');
    expect(html).toContain('value="808"');
    expect(html).toContain('value="0123456789012"');
    expect(html).toContain("儲存銀行帳戶");
    expect(html).toContain("例如 808");
    expect(html).toContain("僅限數字，3 至 7 碼");
    expect(html).toContain("僅限數字，6 至 20 碼");
  });

  it("renders an empty English form with localized placeholders", () => {
    const html = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "en",
        labels: en.admin.bank,
        initialValues: null,
      }),
    );

    expect(html).toContain("Bank name");
    expect(html).toContain("Recipient name");
    expect(html).toContain("Bank code");
    expect(html).toContain("Account number");
    expect(html).toContain('value=""');
    expect(html).toContain("e.g. 808");
    expect(html).toContain("Save bank account");
    expect(html).toContain("Digits only, 3 to 7 characters");
    expect(html).toContain("Digits only, 6 to 20 characters");
  });

  it("maps invalid and generic errors to the active locale", () => {
    actionState.value = { status: "error", message: "invalid" };
    const zhInvalid = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "zh-TW",
        labels: zhTW.admin.bank,
        initialValues: null,
      }),
    );
    const enInvalid = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "en",
        labels: en.admin.bank,
        initialValues: null,
      }),
    );

    expect(zhInvalid).toContain("請確認銀行資料後再試。");
    expect(enInvalid).toContain("Check the bank details and try again.");

    actionState.value = { status: "error", message: "generic" };
    const zhGeneric = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "zh-TW",
        labels: zhTW.admin.bank,
        initialValues: null,
      }),
    );
    const enGeneric = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "en",
        labels: en.admin.bank,
        initialValues: null,
      }),
    );

    expect(zhGeneric).toContain("無法儲存銀行帳戶，請再試一次。");
    expect(enGeneric).toContain("Could not save the bank account. Try again.");
  });

  it("shows the localized saved confirmation", () => {
    actionState.value = { status: "success" };
    const zh = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "zh-TW",
        labels: zhTW.admin.bank,
        initialValues: saved,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "en",
        labels: en.admin.bank,
        initialValues: saved,
      }),
    );

    expect(zh).toContain("銀行帳戶已儲存。");
    expect(enHtml).toContain("Bank account saved.");
  });

  it("disables the save button and shows the saving label while pending", () => {
    actionState.pending = true;
    const html = renderToStaticMarkup(
      createElement(AdminBankForm, {
        locale: "zh-TW",
        labels: zhTW.admin.bank,
        initialValues: saved,
      }),
    );

    expect(html).toContain("儲存中...");
    expect(html).toContain("disabled");
  });
});
