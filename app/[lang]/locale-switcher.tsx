import Link from "next/link";
import { getDictionary, localePath, otherLocale, type Locale } from "@/lib/i18n";

type LocaleSwitcherProps = {
  locale: Locale;
  path: string;
};

export default function LocaleSwitcher({ locale, path }: LocaleSwitcherProps) {
  const dictionary = getDictionary(locale);
  const target = otherLocale(locale);

  return (
    <Link
      href={localePath(target, path)}
      lang={target}
      aria-label={dictionary.common.switchLocaleLabel}
      className="rounded text-xs font-medium text-slate-300 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      {dictionary.common.switchLocale}
    </Link>
  );
}
