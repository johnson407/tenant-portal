import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  getBankAccount: vi.fn(),
  listPendingClaims: vi.fn(),
  listAdminRepairs: vi.fn(),
  listLeaseRenewals: vi.fn(),
  resetForm: vi.fn(),
  bankForm: vi.fn(),
  claimConfirmForm: vi.fn(),
  repairDoneForm: vi.fn(),
  repairStatusForm: vi.fn(),
  repairExpenseForm: vi.fn(),
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

vi.mock("@/lib/appfeed/repairs", () => ({
  listAdminRepairs: mocks.listAdminRepairs,
}));

vi.mock("@/lib/appfeed/renewal", () => ({
  listLeaseRenewals: mocks.listLeaseRenewals,
}));

vi.mock("@/app/[lang]/admin/reset-form", () => ({
  default: mocks.resetForm,
}));

vi.mock("@/app/[lang]/admin/bank-form", () => ({
  default: mocks.bankForm,
}));

vi.mock("@/app/[lang]/admin/repair-done-form", () => ({
  default: mocks.repairDoneForm,
}));

vi.mock("@/app/[lang]/admin/repair-status-form", () => ({
  default: mocks.repairStatusForm,
}));

vi.mock("@/app/[lang]/admin/repair-expense-form", () => ({
  default: mocks.repairExpenseForm,
}));

vi.mock("@/app/[lang]/admin/claim-confirm-form", () => ({
  default: mocks.claimConfirmForm,
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
  mocks.listAdminRepairs.mockResolvedValue({ kind: "ok", repairs: [], expenseTotal: 0 });
  mocks.listLeaseRenewals.mockResolvedValue({ kind: "ok", renewals: [] });
  mocks.resetForm.mockReturnValue(null);
  mocks.bankForm.mockReturnValue(null);
  mocks.claimConfirmForm.mockReturnValue(null);
  mocks.repairDoneForm.mockReturnValue(null);
  mocks.repairStatusForm.mockReturnValue(null);
  mocks.repairExpenseForm.mockReturnValue(null);
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
    expect(mocks.listAdminRepairs).not.toHaveBeenCalled();
    expect(mocks.listLeaseRenewals).not.toHaveBeenCalled();
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
    expect(mocks.claimConfirmForm).toHaveBeenCalledWith(
      {
        locale: "zh-TW",
        room: "a",
        period: "2026-11",
        claimedOn: "2026-10-30",
        labels: expect.any(Object),
      },
      undefined,
    );
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

describe("admin repair requests", () => {
  const REPAIR = {
    room: "a" as const,
    requestId: "0123456789abcdef",
    category: "plumbing" as const,
    note: "Leaking tap in the bathroom",
    submittedOn: "2026-10-30",
    status: "pending" as const,
    visitStart: null,
    visitEnd: null,
    doneOn: null,
    expenseAmount: null,
  };

  it("lists pending repairs with the category, note, date, status, and form", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR],
    });
    mocks.repairDoneForm.mockReturnValue("repair-done-form");

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );

    expect(html).toContain("報修申請");
    expect(html).toContain("房間 a</span>");
    expect(html).toContain("水管");
    expect(html).toContain("Leaking tap in the bathroom");
    expect(html).toContain("2026年10月30日");
    expect(html).toContain("待處理");
    expect(html).toContain("repair-done-form");
    expect(html).toContain("break-words");
    const repairsAt = html.indexOf("報修申請");
    expect(html.slice(repairsAt)).not.toContain("<table");
    expect(html.slice(repairsAt)).not.toContain("overflow-x-auto");
    expect(mocks.repairDoneForm).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "zh-TW",
        requestId: REPAIR.requestId,
      }),
      undefined,
    );
  });

  it("renders the English repair queue labels", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR],
    });
    mocks.repairDoneForm.mockReturnValue("repair-done-form");

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Repair requests");
    expect(html).toContain("Plumbing");
    expect(html).toContain("Oct 30, 2026");
    expect(html).toContain("Pending");
  });

  it("shows active controls and completed expense editing in both locales", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      expenseTotal: 1250,
      repairs: [
        {
          ...REPAIR,
          status: "scheduled",
          visitStart: "2026-11-04T09:00+08:00",
          visitEnd: "2026-11-04T12:00+08:00",
        },
        {
          ...REPAIR,
          requestId: "fedcba9876543210",
          status: "done",
          doneOn: "2026-11-01",
          expenseAmount: 1250,
        },
      ],
    });
    mocks.repairStatusForm.mockReturnValue("repair-status-form");
    mocks.repairExpenseForm.mockReturnValue("repair-expense-form");
    mocks.repairDoneForm.mockReturnValue("repair-done-form");

    const en = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );
    expect(en).toContain("Active repairs");
    expect(en).toContain("Completed repairs");
    expect(en).toContain("Total recorded expenses");
    expect(en).toContain("NT$1,250");
    expect(en).toContain("repair-status-form");
    expect(en).toContain("repair-expense-form");
    expect(mocks.repairStatusForm).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", visitStart: "2026-11-04T09:00+08:00" }),
      undefined,
    );
    expect(mocks.repairExpenseForm).toHaveBeenCalledWith(
      expect.objectContaining({ expenseAmount: 1250 }),
      undefined,
    );

    const zh = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "zh-TW" }) }),
    );
    expect(zh).toContain("處理中的報修");
    expect(zh).toContain("已完成的報修");
    expect(zh).toContain("已記錄費用總額");
    expect(mocks.repairStatusForm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({ saveStatus: "儲存狀態與到訪時間" }),
      }),
      undefined,
    );
    expect(mocks.repairExpenseForm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({ saveExpense: "儲存費用" }),
      }),
      undefined,
    );
  });

  it("renders the empty queue state", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Repair requests");
    expect(html).toContain("No repair requests.");
    expect(mocks.repairDoneForm).not.toHaveBeenCalled();
  });

  it("redirects when the repair accessor denies the session", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listAdminRepairs.mockResolvedValue({ kind: "denied" });

    await expect(
      AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/admin/login");
  });

  it("shows the repair unavailable notice while claims stay usable", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listAdminRepairs.mockResolvedValue({ kind: "unavailable" });
    mocks.listPendingClaims.mockResolvedValue({
      kind: "ok",
      claims: [
        {
          room: "a",
          period: "2026-11",
          claimedOn: "2026-10-30",
          bankLast5: "01234",
        },
      ],
    });

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Repair requests are temporarily unavailable");
    expect(html).not.toContain("Total recorded expenses");
    expect(html).toContain("Pending payment claims");
    expect(html).toContain("01234");
    expect(mocks.resetForm).toHaveBeenCalled();
    expect(mocks.bankForm).toHaveBeenCalled();
  });

  it("keeps repairs usable when the claims list fails", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listPendingClaims.mockRejectedValue(new Error("claims down"));
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR],
    });
    mocks.repairDoneForm.mockReturnValue("repair-done-form");

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html).toContain("Payment claims are temporarily unavailable");
    expect(html).toContain("Leaking tap in the bathroom");
    expect(html).toContain("repair-done-form");
  });

  it("places the repairs card after the claims card at full width", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listPendingClaims.mockResolvedValue({
      kind: "ok",
      claims: [
        {
          room: "a",
          period: "2026-11",
          claimedOn: "2026-10-30",
          bankLast5: "01234",
        },
      ],
    });
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [REPAIR],
    });
    mocks.repairDoneForm.mockReturnValue("repair-done-form");

    const html = renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang: "en" }) }),
    );

    expect(html.indexOf("Pending payment claims")).toBeLessThan(
      html.indexOf("Repair requests"),
    );
    expect(html).toContain("lg:col-span-2");
    expect(mocks.listPendingClaims).toHaveBeenCalledTimes(1);
    expect(mocks.listAdminRepairs).toHaveBeenCalledTimes(1);
  });
});

describe("admin lease renewal reminders", () => {
  async function renderAdmin(lang = "zh-TW"): Promise<string> {
    return renderToStaticMarkup(
      await AdminPage({ params: Promise.resolve({ lang }) }),
    );
  }

  it("lists one room inside the window", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({
      kind: "ok",
      renewals: [{ room: "c", end: "2027-01-15" }],
    });

    const html = await renderAdmin();

    expect(html).toContain("待續約租約");
    expect(html).toContain("未來 60 天內到期的租約。");
    expect(html).toContain("房間 C");
    expect(html).toContain("租約結束");
    expect(html).toContain("2027年1月15日");
  });

  it("lists several rooms in the order given by the accessor", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({
      kind: "ok",
      renewals: [
        { room: "b", end: "2027-01-05" },
        { room: "a", end: "2027-01-10" },
        { room: "d", end: "2027-02-01" },
      ],
    });

    const html = await renderAdmin();

    const b = html.indexOf("房間 B");
    const a = html.indexOf("房間 A");
    const d = html.indexOf("房間 D");
    expect(b).toBeGreaterThan(-1);
    expect(b).toBeLessThan(a);
    expect(a).toBeLessThan(d);
  });

  it("lists rooms with the same end date by room letter", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({
      kind: "ok",
      renewals: [
        { room: "a", end: "2027-01-20" },
        { room: "c", end: "2027-01-20" },
      ],
    });

    const html = await renderAdmin();

    expect(html.indexOf("房間 A")).toBeLessThan(html.indexOf("房間 C"));
  });

  it("renders no banner when no room is inside the window", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = await renderAdmin();

    expect(html).not.toContain("待續約租約");
    expect(html).not.toContain("Lease renewals due");
  });

  it("places the banner after the header and before the admin cards", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({
      kind: "ok",
      renewals: [{ room: "a", end: "2027-01-10" }],
    });

    const html = await renderAdmin();

    const banner = html.indexOf("待續約租約");
    expect(banner).toBeGreaterThan(html.indexOf("</header>"));
    expect(banner).toBeLessThan(html.indexOf('class="mt-8 grid gap-6'));
    expect(banner).toBeLessThan(html.indexOf("待確認的付款回報"));
    expect(banner).toBeLessThan(html.indexOf("報修申請"));
  });

  it("localizes the banner in English", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({
      kind: "ok",
      renewals: [{ room: "c", end: "2027-01-15" }],
    });

    const html = await renderAdmin("en");

    expect(html).toContain("Lease renewals due");
    expect(html).toContain("Leases ending within the next 60 days.");
    expect(html).toContain("Room C");
    expect(html).toContain("Lease end");
    expect(html).toContain("Jan 15, 2027");
  });

  it("shows the unavailable notice and keeps every other card usable", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({ kind: "unavailable" });
    mocks.listPendingClaims.mockResolvedValue({
      kind: "ok",
      claims: [
        {
          room: "a",
          period: "2026-11",
          claimedOn: "2026-10-30",
          bankLast5: "01234",
        },
      ],
    });
    mocks.listAdminRepairs.mockResolvedValue({
      kind: "ok",
      repairs: [
        {
          requestId: "0123456789abcdef",
          room: "a",
          category: "plumbing",
          note: "Leaking tap",
          submittedOn: "2026-10-30",
          status: "pending",
          doneOn: null,
        },
      ],
    });

    const html = await renderAdmin("en");

    expect(html).toContain(
      "Lease renewal reminders are temporarily unavailable. Try again later.",
    );
    expect(html).not.toContain("Lease renewals due");
    expect(html).toContain("Pending payment claims");
    expect(html).toContain("01234");
    expect(html).toContain("Repair requests");
    expect(html).toContain("Leaking tap");
    expect(mocks.resetForm).toHaveBeenCalled();
    expect(mocks.bankForm).toHaveBeenCalled();
  });

  it("shows the unavailable notice when the renewal read throws", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockRejectedValue(new Error("boom"));

    const html = await renderAdmin("en");

    expect(html).toContain(
      "Lease renewal reminders are temporarily unavailable. Try again later.",
    );
    expect(html).toContain("Pending payment claims");
    expect(html).toContain("Repair requests");
    expect(mocks.resetForm).toHaveBeenCalled();
    expect(mocks.bankForm).toHaveBeenCalled();
  });

  it("redirects when the renewal accessor denies the session", async () => {
    mocks.isAdminSession.mockResolvedValue(true);
    mocks.listLeaseRenewals.mockResolvedValue({ kind: "denied" });

    await expect(renderAdmin("en")).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/admin/login");
  });
});
