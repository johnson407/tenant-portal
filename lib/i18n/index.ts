import { type Locale } from "./config";
import en from "./dictionaries/en";
import zhTW from "./dictionaries/zh-TW";
import type { Dictionary } from "./types";

const dictionaries: Record<Locale, Dictionary> = {
  "zh-TW": zhTW,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary } from "./types";
export { DEFAULT_LOCALE, LOCALES, isLocale, localePath, otherLocale, type Locale } from "./config";
