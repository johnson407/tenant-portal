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
import RepairForm from "@/app/[lang]/rooms/[room]/repair-form";
import RepairDoneForm from "@/app/[lang]/admin/repair-done-form";

beforeEach(() => {
  actionState.value = { status: "idle" };
  actionState.pending = false;
});

describe("repair form", () => {
  it("renders the Traditional Chinese form with all categories and limits", () => {
    const html = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "zh-TW",
        room: "a",
        labels: zhTW.room.repairs,
      }),
    );

    expect(html).toContain("類別");
    expect(html).toContain("簡短說明");
    expect(html).toContain("水管");
    expect(html).toContain("電路");
    expect(html).toContain("家電");
    expect(html).toContain("其他");
    expect(html).toContain("請輸入 1 至 200 個字元");
    expect(html).toContain("請勿輸入姓名");
    expect(html).toContain("送出報修申請");
    expect(html).toContain('name="category"');
    expect(html).toContain('name="note"');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain("required");
  });

  it("renders the English form with localized placeholders", () => {
    const html = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "en",
        room: "a",
        labels: en.room.repairs,
      }),
    );

    expect(html).toContain("Category");
    expect(html).toContain("Short note");
    expect(html).toContain("Plumbing");
    expect(html).toContain("Electrical");
    expect(html).toContain("Appliance");
    expect(html).toContain("Other");
    expect(html).toContain("Use 1 to 200 characters");
    expect(html).toContain("Do not include names");
    expect(html).toContain("Send repair request");
    expect(html).toContain("For example: The kitchen tap leaks.");
  });

  it.each([
    ["category", "請選擇類別。", "Select a category."],
    [
      "note",
      "請輸入簡短說明",
      "Use a short note with no email, URL, or long number.",
    ],
    [
      "unavailable",
      "報修資料暫時無法取得",
      "Repair requests are temporarily unavailable.",
    ],
    ["rate", "嘗試次數過多", "Too many attempts."],
    [
      "generic",
      "無法送出報修申請",
      "Could not send the repair request.",
    ],
  ] as const)("maps the %s error to the active locale", (message, zhText, enText) => {
    actionState.value = { status: "error", message };

    const zh = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "zh-TW",
        room: "a",
        labels: zhTW.room.repairs,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "en",
        room: "a",
        labels: en.room.repairs,
      }),
    );

    expect(zh).toContain(zhText);
    expect(enHtml).toContain(enText);
  });

  it("shows the localized success message", () => {
    actionState.value = { status: "success" };

    const zh = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "zh-TW",
        room: "a",
        labels: zhTW.room.repairs,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "en",
        room: "a",
        labels: en.room.repairs,
      }),
    );

    expect(zh).toContain("報修申請已送出。");
    expect(enHtml).toContain("Repair request sent.");
  });

  it("disables the submit control while pending", () => {
    actionState.pending = true;

    const html = renderToStaticMarkup(
      createElement(RepairForm, {
        locale: "zh-TW",
        room: "a",
        labels: zhTW.room.repairs,
      }),
    );

    expect(html).toContain("送出中...");
    expect(html).toContain("disabled");
  });
});

describe("repair done form", () => {
  const REQUEST_ID = "0123456789abcdef";

  it("renders a hidden request ID and the localized action", () => {
    const zh = renderToStaticMarkup(
      createElement(RepairDoneForm, {
        locale: "zh-TW",
        requestId: REQUEST_ID,
        labels: zhTW.admin.repairs,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(RepairDoneForm, {
        locale: "en",
        requestId: REQUEST_ID,
        labels: en.admin.repairs,
      }),
    );

    expect(zh).toContain('name="requestId"');
    expect(zh).toContain(`value="${REQUEST_ID}"`);
    expect(zh).toContain("標記為完成");
    expect(zh).toContain('name="note"');
    expect(zh).toContain("完成說明（選填）");
    expect(zh).toContain('maxLength="200"');
    expect(enHtml).toContain(`value="${REQUEST_ID}"`);
    expect(enHtml).toContain("Mark done");
    expect(enHtml).toContain('name="note"');
    expect(enHtml).toContain("Completion note (optional)");
  });

  it.each([
    [
      "already-done",
      "此申請已完成。",
      "This request is already done.",
    ],
    ["not-found", "找不到此申請。", "This request was not found."],
    [
      "invalid-note",
      "請輸入簡短說明，且不要包含電子郵件、網址或長串數字。",
      "Use a short note with no email, URL, or long number.",
    ],
    [
      "unavailable",
      "無法更新申請",
      "Could not update the request.",
    ],
    ["rate", "嘗試次數過多", "Too many attempts."],
    [
      "generic",
      "無法更新申請",
      "Could not update the request.",
    ],
  ] as const)("maps the %s error to the active locale", (message, zhText, enText) => {
    actionState.value = { status: "error", message };

    const zh = renderToStaticMarkup(
      createElement(RepairDoneForm, {
        locale: "zh-TW",
        requestId: REQUEST_ID,
        labels: zhTW.admin.repairs,
      }),
    );
    const enHtml = renderToStaticMarkup(
      createElement(RepairDoneForm, {
        locale: "en",
        requestId: REQUEST_ID,
        labels: en.admin.repairs,
      }),
    );

    expect(zh).toContain(zhText);
    expect(enHtml).toContain(enText);
  });

  it("disables the action while pending", () => {
    actionState.pending = true;

    const html = renderToStaticMarkup(
      createElement(RepairDoneForm, {
        locale: "zh-TW",
        requestId: REQUEST_ID,
        labels: zhTW.admin.repairs,
      }),
    );

    expect(html).toContain("儲存中...");
    expect(html).toContain("disabled");
  });
});
