import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import LocaleSwitcher from "./locale-switcher";
import { logoutAction } from "./logout-actions";

type PortalShellProps = {
  locale: Locale;
  path: string;
  brandHref?: string;
  context?: ReactNode;
  showLogout?: boolean;
  centerContent?: boolean;
  children: ReactNode;
};

export default function PortalShell({
  locale,
  path,
  brandHref,
  context,
  showLogout = false,
  centerContent = false,
  children,
}: PortalShellProps) {
  const dictionary = getDictionary(locale);
  const homePath = brandHref ?? localePath(locale, "/");

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={homePath}
              className="rounded text-lg font-semibold text-slate-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {dictionary.meta.siteName}
            </Link>
            {context ? (
              <span className="text-sm font-medium text-slate-300">{context}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher locale={locale} path={path} />
            {showLogout ? (
              <form action={logoutAction.bind(null, locale)}>
                <button
                  type="submit"
                  className="rounded border border-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {dictionary.common.logOut}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <main
        className={
          centerContent
            ? "flex flex-1 items-center justify-center px-4 py-10 sm:px-6"
            : "flex-1"
        }
      >
        {centerContent ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        )}
      </main>
    </div>
  );
}
