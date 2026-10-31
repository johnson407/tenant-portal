import Link from "next/link";
import { getDictionary, localePath, otherLocale, type Locale } from "@/lib/i18n";

type LocaleSwitcherProps = {
  locale: Locale;
  path: string;
  tone?: "dark" | "light";
};

export default function LocaleSwitcher({ locale, path, tone = "dark" }: LocaleSwitcherProps) {
  const dictionary = getDictionary(locale);
  const target = otherLocale(locale);
  const color =
    tone === "light"
      ? "text-slate-700 hover:text-slate-950 focus-visible:ring-slate-700"
      : "text-slate-300 hover:text-white focus-visible:ring-slate-300";

  return (
    <Link
      href={localePath(target, path)}
      lang={target}
      aria-label={dictionary.common.switchLocaleLabel}
      className={`rounded text-xs font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 ${color}`}
    >
      {dictionary.common.switchLocale}
    </Link>
  );
}
