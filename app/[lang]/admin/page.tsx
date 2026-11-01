import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PortalShell from "@/app/[lang]/portal-shell";
import SectionCard from "@/app/[lang]/section-card";
import { type BankAccount, getBankAccount } from "@/lib/bank-account";
import { listPendingClaims, type PendingClaimsResult } from "@/lib/appfeed/claims";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
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

  let claimsResult: PendingClaimsResult = { kind: "unavailable" };
  try {
    claimsResult = await listPendingClaims();
  } catch {
    claimsResult = { kind: "unavailable" };
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
        <div className="lg:col-span-2">
          <SectionCard title={dictionary.admin.claims.sectionHeading}>
            {claimsResult.kind !== "ok" ? (
              <p className="text-sm text-slate-300">
                {dictionary.admin.claims.unavailable}
              </p>
            ) : claimsResult.claims.length === 0 ? (
              <p className="text-sm text-slate-300">
                {dictionary.admin.claims.empty}
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {dictionary.admin.claims.room}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {dictionary.admin.claims.period}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {dictionary.admin.claims.claimedOn}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      {dictionary.admin.claims.bankLast5}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {claimsResult.claims.map((claim) => (
                    <tr
                      key={`${claim.room}:${claim.period}`}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="py-2 pr-4 uppercase">{claim.room}</td>
                      <td className="py-2 pr-4">{claim.period}</td>
                      <td className="py-2 pr-4">
                        {formatDate(claim.claimedOn, lang)}
                      </td>
                      <td className="py-2 font-mono">{claim.bankLast5}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </div>
      </div>
    </PortalShell>
  );
}
