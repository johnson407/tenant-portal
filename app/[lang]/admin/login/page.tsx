import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AuthShell from "@/app/[lang]/auth-shell";
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
    <AuthShell
      locale={lang}
      path="/admin/login"
      heading={dictionary.adminLogin.heading}
      subtitle={dictionary.adminLogin.subtitle}
    >
      <AdminLoginForm locale={lang} labels={dictionary.adminLogin} />
    </AuthShell>
  );
}
