import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  getRoomSessionVersion: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

import RoomPage from "@/app/rooms/[room]/page";

async function renderRoom(room: string): Promise<string> {
  const ui = await RoomPage({ params: Promise.resolve({ room }) });
  return renderToStaticMarkup(ui);
}

beforeEach(() => {
  mocks.getSessionClaims.mockReset();
  mocks.getRoomSessionVersion.mockReset();
});

describe("room dashboard authorization", () => {
  it("renders the tenant's own room when the session version is current", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(4);

    const html = await renderRoom("a");

    expect(html).toContain("Room A");
    expect(html).toContain("Rent - current month");
    expect(html).not.toContain("Not authorized");
  });

  it("denies a tenant requesting another room and does not render that room's data", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(4);

    const html = await renderRoom("b");

    expect(html).toContain("Not authorized");
    expect(html).not.toContain("Room B");
    expect(html).not.toContain("70000");
  });

  it("denies a tenant whose code was reset after the session was issued", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 4, exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const html = await renderRoom("a");

    expect(html).toContain("Not authorized");
    expect(html).not.toContain("Rent - current month");
  });

  it("denies an admin session and an anonymous request", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });
    mocks.getRoomSessionVersion.mockResolvedValue(0);
    expect(await renderRoom("a")).toContain("Not authorized");

    mocks.getSessionClaims.mockResolvedValue(null);
    expect(await renderRoom("a")).toContain("Not authorized");
  });
});
