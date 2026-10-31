import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";
import { logoutAction } from "@/app/[lang]/logout-actions";
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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">{dictionary.admin.heading}</h1>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={lang} path="/admin" />
            <form action={logoutAction.bind(null, lang)}>
              <button
                type="submit"
                className="rounded border border-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {dictionary.common.logOut}
              </button>
            </form>
          </div>
        </header>
        <p className="text-sm text-slate-400">{dictionary.admin.subtitle}</p>
        <AdminResetForm locale={lang} labels={dictionary.admin} />
        {bankUnavailable ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              {dictionary.admin.bank.sectionHeading}
            </h2>
            <p className="rounded-lg border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300">
              {dictionary.admin.bank.unavailable}
            </p>
          </section>
        ) : (
          <AdminBankForm
            locale={lang}
            labels={dictionary.admin.bank}
            initialValues={bankAccount}
          />
        )}
      </div>
    </main>
  );
}
