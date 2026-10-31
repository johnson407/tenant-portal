import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { getTenantRoom } from "@/lib/session-cookies";
import LoginForm from "./login-form";

export const instant = false;

type LoginPageProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: getDictionary(lang).meta.loginTitle };
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);

  if (await getTenantRoom()) redirect(localePath(lang, "/"));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 p-8 text-slate-100 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{dictionary.login.heading}</h1>
          <LocaleSwitcher locale={lang} path="/login" />
        </div>
        <p className="mt-2 text-sm text-slate-400">{dictionary.login.subtitle}</p>
        <LoginForm locale={lang} labels={dictionary.login} />
        <p className="mt-6 text-xs text-slate-300">
          {dictionary.login.landlordPrompt}{" "}
          <Link
            href={localePath(lang, "/admin/login")}
            className="underline hover:text-white"
          >
            {dictionary.login.adminArea}
          </Link>
        </p>
      </div>
    </main>
  );
}
