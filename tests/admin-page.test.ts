import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/app/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/app/admin/reset-form", () => ({
  default: () => null,
}));

import AdminPage from "@/app/admin/page";

const REDIRECT = new Error("NEXT_REDIRECT");

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

describe("admin page logout control", () => {
  it("renders the heading and Log out control for an admin session", async () => {
    mocks.isAdminSession.mockResolvedValue(true);

    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("Room access codes");
    expect(html).toContain("Log out");
    expect(html).toContain("Reset the access code for any room.");
    expect(html).toContain("focus-visible:ring-slate-300");
    expect(html).toMatch(/<header[\s\S]*Log out[\s\S]*<\/header>/);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a non-admin session without rendering the control", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    await expect(AdminPage()).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });
});
