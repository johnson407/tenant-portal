import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AuthShell from "@/app/[lang]/auth-shell";
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
    <AuthShell
      locale={lang}
      path="/login"
      heading={dictionary.login.heading}
      subtitle={dictionary.login.subtitle}
      footer={
        <p className="mt-6 text-xs text-slate-300">
          {dictionary.login.landlordPrompt}{" "}
          <Link
            href={localePath(lang, "/admin/login")}
            className="underline hover:text-white"
          >
            {dictionary.login.adminArea}
          </Link>
        </p>
      }
    >
      <LoginForm locale={lang} labels={dictionary.login} />
    </AuthShell>
  );
}
