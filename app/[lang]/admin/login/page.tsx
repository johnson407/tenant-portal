import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { getSessionClaims } from "@/lib/session-cookies";
import AdminLoginForm from "./admin-login-form";

export const instant = false;

type AdminLoginPageProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({
  params,
}: AdminLoginPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: getDictionary(lang).meta.adminLoginTitle };
}

export default async function AdminLoginPage({ params }: AdminLoginPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);

  const claims = await getSessionClaims();
  if (claims?.role === "admin") redirect(localePath(lang, "/admin"));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 p-8 text-slate-100 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{dictionary.adminLogin.heading}</h1>
          <LocaleSwitcher locale={lang} path="/admin/login" />
        </div>
        <p className="mt-2 text-sm text-slate-400">{dictionary.adminLogin.subtitle}</p>
        <AdminLoginForm locale={lang} labels={dictionary.adminLogin} />
      </div>
    </main>
  );
}
