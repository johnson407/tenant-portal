export const LOCALES = ["zh-TW", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Returns the other supported locale, for the language switcher. */
export function otherLocale(locale: Locale): Locale {
  return locale === "zh-TW" ? "en" : "zh-TW";
}

/**
 * Prefixes a locale-relative path such as "/login" with the locale.
 * "/" and "" both resolve to the locale root without a trailing slash.
 */
export function localePath(locale: Locale, path: string): string {
  if (path === "" || path === "/") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}
