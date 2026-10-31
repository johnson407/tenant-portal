import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";

function render(locale: "zh-TW" | "en", path: string): string {
  return renderToStaticMarkup(createElement(LocaleSwitcher, { locale, path }));
}

describe("locale switcher", () => {
  it("links from Traditional Chinese to English on the same path", () => {
    const html = render("zh-TW", "/login");

    expect(html).toContain('href="/en/login"');
    expect(html).toContain("English");
    expect(html).toContain('lang="en"');
    expect(html).toContain("<a ");
  });

  it("links from English back to Traditional Chinese on a room path", () => {
    const html = render("en", "/rooms/b");

    expect(html).toContain('href="/zh-TW/rooms/b"');
    expect(html).toContain("繁體中文");
    expect(html).toContain('lang="zh-TW"');
  });

  it("renders an accessible label and a visible focus ring", () => {
    const html = render("zh-TW", "/login");

    expect(html).toContain("以 English 檢視此頁面");
    expect(html).toContain("focus-visible:ring");
  });
});
