import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PortalShell from "@/app/[lang]/portal-shell";
import SectionCard from "@/app/[lang]/section-card";
import { type BankAccount, getBankAccount } from "@/lib/bank-account";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { isAdminSession } from "@/lib/session-cookies";
import AdminBankForm from "./bank-form";
import AdminResetForm from "./reset-form";

export const instant = false;

type AdminPageProps = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: getDictionary(lang).meta.adminTitle };
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);

  if (!(await isAdminSession())) redirect(localePath(lang, "/admin/login"));

  let bankAccount: BankAccount | null = null;
  let bankUnavailable = false;
  try {
    bankAccount = await getBankAccount();
  } catch {
    bankUnavailable = true;
  }

  return (
    <PortalShell
      locale={lang}
      path="/admin"
      brandHref={localePath(lang, "/admin")}
      context={dictionary.admin.heading}
      showLogout
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">
          {dictionary.admin.heading}
        </h1>
        <p className="text-sm text-slate-400">{dictionary.admin.subtitle}</p>
      </header>
      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <AdminResetForm locale={lang} labels={dictionary.admin} />
        {bankUnavailable ? (
          <SectionCard title={dictionary.admin.bank.sectionHeading}>
            <p className="text-sm text-slate-300">
              {dictionary.admin.bank.unavailable}
            </p>
          </SectionCard>
        ) : (
          <AdminBankForm
            locale={lang}
            labels={dictionary.admin.bank}
            initialValues={bankAccount}
          />
        )}
      </div>
    </PortalShell>
  );
}
