import type { Locale } from "./config";

const twdFormatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en", { style: "currency", currency: "TWD" }),
  "zh-TW": new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD" }),
};

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }),
  "zh-TW": new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "UTC" }),
};

/** Formats integer cents as New Taiwan dollars for the active locale. */
export function formatTwd(amountCents: number, locale: Locale): string {
  return twdFormatters[locale].format(amountCents / 100);
}

/**
 * Formats a date stored as YYYY-MM-DD. Parsing and formatting both use UTC so
 * the displayed calendar day never shifts with the server's timezone.
 */
export function formatDate(isoDate: string, locale: Locale): string {
  return dateFormatters[locale].format(new Date(`${isoDate}T00:00:00Z`));
}
