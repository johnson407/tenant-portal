import type { ReactNode } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import LocaleSwitcher from "./locale-switcher";

type AuthShellProps = {
  locale: Locale;
  path: string;
  heading: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

export default function AuthShell({
  locale,
  path,
  heading,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-8">
            <p className="text-3xl font-semibold text-slate-100">
              {dictionary.meta.siteName}
            </p>
            <p className="mt-3 max-w-md text-base text-slate-300">
              {dictionary.meta.description}
            </p>
          </section>
          <div className="w-full max-w-sm justify-self-center rounded-lg bg-slate-900 p-8 text-slate-100 shadow-xl lg:justify-self-end">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold">{heading}</h1>
              <LocaleSwitcher locale={locale} path={path} />
            </div>
            <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
            {children}
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
