import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import RootLayout, { generateMetadata, generateStaticParams } from "@/app/[lang]/layout";

describe("localized root layout", () => {
  it("declares the Traditional Chinese document language and title", async () => {
    const html = renderToStaticMarkup(
      await RootLayout({
        children: createElement("main", null, "content"),
        params: Promise.resolve({ lang: "zh-TW" }),
      }),
    );

    expect(html).toContain('lang="zh-TW"');
  });

  it("declares the English document language and title", async () => {
    const html = renderToStaticMarkup(
      await RootLayout({
        children: createElement("main", null, "content"),
        params: Promise.resolve({ lang: "en" }),
      }),
    );

    expect(html).toContain('lang="en"');
  });

  it("generates localized metadata in both locales", async () => {
    const zh = await generateMetadata({ params: Promise.resolve({ lang: "zh-TW" }) });
    const en = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });

    expect(JSON.stringify(zh)).toContain("租客入口");
    expect(JSON.stringify(en)).toContain("Tenant Portal");
  });

  it("generates both supported locales", async () => {
    expect(await generateStaticParams()).toEqual([{ lang: "zh-TW" }, { lang: "en" }]);
  });
});
