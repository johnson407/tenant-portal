import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  getTenantRoom: vi.fn(),
  getSessionClaims: vi.fn(),
  isAdminSession: vi.fn(),
  getRoomSessionVersion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/lib/session-cookies", () => ({
  getTenantRoom: mocks.getTenantRoom,
  getSessionClaims: mocks.getSessionClaims,
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/app/[lang]/admin/reset-form", () => ({
  default: () => null,
}));

import Home from "@/app/[lang]/page";
import LoginPage from "@/app/[lang]/login/page";
import AdminPage from "@/app/[lang]/admin/page";
import AdminLoginPage from "@/app/[lang]/admin/login/page";
import RoomPage from "@/app/[lang]/rooms/[room]/page";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.notFound.mockImplementation(() => {
    throw NOT_FOUND;
  });
  mocks.getTenantRoom.mockResolvedValue(null);
  mocks.getSessionClaims.mockResolvedValue(null);
  mocks.isAdminSession.mockResolvedValue(false);
});

describe("page locale validation", () => {
  it("returns not found for an unsupported locale on the home page", async () => {
    await expect(Home({ params: Promise.resolve({ lang: "zh-CN" }) })).rejects.toBe(NOT_FOUND);
    expect(mocks.notFound).toHaveBeenCalled();
    expect(mocks.getTenantRoom).not.toHaveBeenCalled();
  });

  it("returns not found for an unsupported locale on the login page", async () => {
    await expect(LoginPage({ params: Promise.resolve({ lang: "fr" }) })).rejects.toBe(NOT_FOUND);
    expect(mocks.getTenantRoom).not.toHaveBeenCalled();
  });

  it("returns not found for an unsupported locale on the admin pages", async () => {
    await expect(AdminPage({ params: Promise.resolve({ lang: "fr" }) })).rejects.toBe(NOT_FOUND);
    await expect(
      AdminLoginPage({ params: Promise.resolve({ lang: "fr" }) }),
    ).rejects.toBe(NOT_FOUND);
    expect(mocks.isAdminSession).not.toHaveBeenCalled();
  });

  it("returns not found for an unsupported locale on the room page", async () => {
    await expect(
      RoomPage({ params: Promise.resolve({ lang: "fr", room: "a" }) }),
    ).rejects.toBe(NOT_FOUND);
    expect(mocks.getSessionClaims).not.toHaveBeenCalled();
  });
});
