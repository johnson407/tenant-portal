import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RenewalBanner } from "@/app/[lang]/renewal-banner";
import en from "@/lib/i18n/dictionaries/en";
import zhTW from "@/lib/i18n/dictionaries/zh-TW";
import { formatDate } from "@/lib/i18n/format";

const renewals = [
  { room: "a" as const, end: "2027-01-15" },
  { room: "d" as const, end: "2027-02-20" },
];

function render(props: Parameters<typeof RenewalBanner>[0]): string {
  return renderToStaticMarkup(createElement(RenewalBanner, props));
}

describe("RenewalBanner", () => {
  it("renders the tenant reminder with the localized date and no room list", () => {
    const html = render({
      locale: "zh-TW",
      dictionary: zhTW,
      renewals: [renewals[0]],
      variant: "tenant",
    });

    expect(html).toContain(zhTW.renewal.tenantHeading);
    expect(html).toContain(formatDate(renewals[0].end, "zh-TW"));
    expect(html).toContain(
      zhTW.renewal.tenantMessageTemplate.replace(
        "{date}",
        formatDate(renewals[0].end, "zh-TW"),
      ),
    );
    expect(html).not.toContain(zhTW.common.room);
    expect(html).toContain('aria-labelledby="renewal-reminder-heading"');
  });

  it("renders the admin list with room and lease-end labels in both locales", () => {
    for (const [locale, dictionary] of [
      ["en", en],
      ["zh-TW", zhTW],
    ] as const) {
      const html = render({
        locale,
        dictionary,
        renewals,
        variant: "admin",
      });

      expect(html).toContain(dictionary.renewal.adminHeading);
      expect(html).toContain(dictionary.renewal.adminCaption);
      expect(html).toContain(`${dictionary.common.room} A`);
      expect(html).toContain(`${dictionary.common.room} D`);
      expect(html).toContain(dictionary.room.leaseEnd);
      expect(html).toContain(formatDate(renewals[0].end, locale));
      expect(html).toContain(formatDate(renewals[1].end, locale));
    }
  });

  it("wraps the admin rows and has no dismiss control or storage call", () => {
    const html = render({
      locale: "en",
      dictionary: en,
      renewals,
      variant: "admin",
    });

    expect(html).toContain("flex flex-wrap");
    expect(html).toContain("min-w-0 break-words");
    expect(html).not.toContain("whitespace-nowrap");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html.toLowerCase()).not.toContain("dismiss");

    const source = readFileSync(
      new URL("../app/[lang]/renewal-banner.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("document.cookie");
  });

  it("renders nothing for an empty list", () => {
    expect(
      render({
        locale: "en",
        dictionary: en,
        renewals: [],
        variant: "admin",
      }),
    ).toBe("");
  });
});
