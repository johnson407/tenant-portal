import type { Locale } from "./config";

const twdFormatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  "zh-TW": new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
};

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }),
  "zh-TW": new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "UTC" }),
};

const dateTimeFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }),
  "zh-TW": new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }),
};

/** Formats whole New Taiwan dollars for the active locale. */
export function formatTwd(amountDollars: number, locale: Locale): string {
  return twdFormatters[locale].format(amountDollars);
}

/**
 * Formats a date stored as YYYY-MM-DD. Parsing and formatting both use UTC so
 * the displayed calendar day never shifts with the server's timezone.
 */
export function formatDate(isoDate: string, locale: Locale): string {
  return dateFormatters[locale].format(new Date(`${isoDate}T00:00:00Z`));
}

/** Formats an ISO timestamp in Taiwan time for the last-updated caption. */
export function formatDateTime(isoTimestamp: string, locale: Locale): string {
  return dateTimeFormatters[locale].format(new Date(isoTimestamp));
}
