import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const actionState = vi.hoisted(() => ({
  value: { status: "idle" } as Record<string, unknown>,
  pending: false,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [actionState.value, vi.fn(), actionState.pending],
  };
});

import en from "@/lib/i18n/dictionaries/en";
import zhTW from "@/lib/i18n/dictionaries/zh-TW";
import ClaimConfirmForm from "@/app/[lang]/admin/claim-confirm-form";

const CLAIM = {
  room: "a",
  period: "2026-11",
  claimedOn: "2026-10-30",
};

beforeEach(() => {
  actionState.value = { status: "idle" };
  actionState.pending = false;
});

describe("claim confirmation form", () => {
  it("renders the hidden row keys and a paid date prefilled from the claim", () => {
    const zh = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "zh-TW",
        ...CLAIM,
        labels: zhTW.admin.claims,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "en",
        ...CLAIM,
        labels: en.admin.claims,
      }),
    );

    expect(zh).toContain('name="room"');
    expect(zh).toContain('name="period"');
    expect(zh).toContain('name="paidOn"');
    expect(zh).toContain('type="date"');
    expect(zh).toContain('value="2026-10-30"');
    expect(zh).toContain("付款日期");
    expect(zh).toContain("確認付款");
    expect(enHtml).toContain('value="2026-10-30"');
    expect(enHtml).toContain("Paid date");
    expect(enHtml).toContain("Confirm claim");
  });

  it("renders an optional note with a length limit", () => {
    const zh = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "zh-TW",
        ...CLAIM,
        labels: zhTW.admin.claims,
      }),
    );

    expect(zh).toContain('name="note"');
    expect(zh).toContain("確認說明（選填）");
    expect(zh).toContain('maxLength="200"');
    expect(zh).toContain("例如：已收到轉帳。");
  });

  it("renders a form that submits without client-side JavaScript", () => {
    const html = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "en",
        ...CLAIM,
        labels: en.admin.claims,
      }),
    );

    expect(html).toContain("<form");
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("onClick");
  });

  it.each([
    ["date", "請輸入有效的付款日期", "Enter a real paid date"],
    ["note", "請輸入簡短說明", "Use a short note"],
    ["not-found", "此回報已不在待確認清單", "no longer pending"],
    ["paid", "此帳單已付款。", "already paid"],
    ["unavailable", "目前無法確認付款", "could not be confirmed"],
    ["rate", "嘗試次數過多", "Too many attempts"],
    ["generic", "無法確認付款", "Could not confirm the claim"],
  ] as const)("maps the %s error to the active locale", (message, zhText, enText) => {
    actionState.value = { status: "error", message };

    const zh = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "zh-TW",
        ...CLAIM,
        labels: zhTW.admin.claims,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "en",
        ...CLAIM,
        labels: en.admin.claims,
      }),
    );

    expect(zh).toContain(zhText);
    expect(enHtml).toContain(enText);
  });

  it("disables the action while pending", () => {
    actionState.pending = true;

    const html = renderToStaticMarkup(
      createElement(ClaimConfirmForm, {
        locale: "zh-TW",
        ...CLAIM,
        labels: zhTW.admin.claims,
      }),
    );

    expect(html).toContain("確認中...");
    expect(html).toContain("disabled");
  });
});
