import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/[lang]/logout-actions", () => ({
  logoutAction: vi.fn(),
}));

import PortalShell from "@/app/[lang]/portal-shell";
import SectionCard from "@/app/[lang]/section-card";

describe("portal shell", () => {
  it("renders the brand, locale link, context, and logout control", () => {
    const html = renderToStaticMarkup(
      createElement(
        PortalShell,
        {
          locale: "zh-TW",
          path: "/rooms/a",
          brandHref: "/zh-TW/rooms/a",
          context: "房間 A",
          showLogout: true,
          children: createElement("p", null, "content"),
        },
      ),
    );

    expect(html).toContain("租客入口");
    expect(html).toContain('href="/zh-TW/rooms/a"');
    expect(html).toContain("房間 A");
    expect(html).toContain('href="/en/rooms/a"');
    expect(html).toContain("登出");
    expect(html).toContain("content");
  });

  it("omits the logout control on unauthenticated views", () => {
    const html = renderToStaticMarkup(
      createElement(
        PortalShell,
        {
          locale: "en",
          path: "/login",
          children: createElement("p", null, "form"),
        },
      ),
    );

    expect(html).toContain("Tenant Portal");
    expect(html).toContain('href="/zh-TW/login"');
    expect(html).not.toContain("Log out");
  });
});

describe("section card", () => {
  it("renders a dark raised card with a heading, caption, and content", () => {
    const html = renderToStaticMarkup(
      createElement(
        SectionCard,
        {
          title: "Bills",
          caption: "October 2026",
          children: createElement("p", null, "row"),
        },
      ),
    );

    expect(html).toContain("Bills");
    expect(html).toContain("October 2026");
    expect(html).toContain("row");
    expect(html).toContain(
      'class="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100"',
    );
    expect(html).toContain('<h2 class="text-xl font-semibold">Bills</h2>');
  });
});
