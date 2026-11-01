import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PortalShell from "@/app/[lang]/portal-shell";
import { RenewalBanner } from "@/app/[lang]/renewal-banner";
import SectionCard from "@/app/[lang]/section-card";
import { type BankAccount, getBankAccount } from "@/lib/bank-account";
import { listPendingClaims, type PendingClaimsResult } from "@/lib/appfeed/claims";
import { listPendingRepairs } from "@/lib/appfeed/repairs";
import { listLeaseRenewals } from "@/lib/appfeed/renewal";
import type {
  AdminLeaseRenewalsResult,
  AdminRepairsResult,
} from "@/lib/appfeed/types";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { isAdminSession } from "@/lib/session-cookies";
import AdminBankForm from "./bank-form";
import ClaimConfirmForm from "./claim-confirm-form";
import AdminResetForm from "./reset-form";
import RepairDoneForm from "./repair-done-form";

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

  let repairsResult: AdminRepairsResult = { kind: "unavailable" };
  try {
    repairsResult = await listPendingRepairs();
  } catch {
    repairsResult = { kind: "unavailable" };
  }
  if (repairsResult.kind === "denied") {
    redirect(localePath(lang, "/admin/login"));
  }

  let renewalsResult: AdminLeaseRenewalsResult = { kind: "unavailable" };
  try {
    renewalsResult = await listLeaseRenewals();
  } catch {
    renewalsResult = { kind: "unavailable" };
  }
  if (renewalsResult.kind === "denied") {
    redirect(localePath(lang, "/admin/login"));
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
      {renewalsResult.kind === "unavailable" ? (
        <p className="mt-6 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
          {dictionary.renewal.unavailable}
        </p>
      ) : renewalsResult.renewals.length === 0 ? null : (
        <RenewalBanner
          locale={lang}
          dictionary={dictionary}
          renewals={renewalsResult.renewals}
          variant="admin"
        />
      )}
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
              <div className="overflow-x-auto">
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
                      <th scope="col" className="py-2 font-medium">
                        {dictionary.admin.claims.confirm}
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
                        <td className="py-2 pl-2">
                          <ClaimConfirmForm
                            locale={lang}
                            room={claim.room}
                            period={claim.period}
                            claimedOn={claim.claimedOn}
                            labels={dictionary.admin.claims}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
        <div className="lg:col-span-2">
          <SectionCard title={dictionary.admin.repairs.sectionHeading}>
            {repairsResult.kind !== "ok" ? (
              <p className="text-sm text-slate-300">
                {dictionary.admin.repairs.unavailable}
              </p>
            ) : repairsResult.repairs.length === 0 ? (
              <p className="text-sm text-slate-300">
                {dictionary.admin.repairs.empty}
              </p>
            ) : (
              <ul className="space-y-3">
                {repairsResult.repairs.map((repair) => (
                  <li
                    key={repair.requestId}
                    className="rounded-md border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-sm uppercase text-slate-100">
                          {dictionary.admin.repairs.room} {repair.room}
                        </span>
                        <span className="text-sm font-medium text-slate-100">
                          {
                            dictionary.room.repairs.categories[
                              repair.category
                            ]
                          }
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-950 px-2.5 py-1 text-xs font-medium text-amber-200">
                        {dictionary.admin.repairs.pending}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm text-slate-200">
                      {repair.note}
                    </p>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-800 pt-3">
                      <div className="text-xs">
                        <span className="text-slate-300">
                          {dictionary.admin.repairs.submittedOn}
                        </span>{" "}
                        <span className="font-mono text-slate-100">
                          {formatDate(repair.submittedOn, lang)}
                        </span>
                      </div>
                      <RepairDoneForm
                        locale={lang}
                        requestId={repair.requestId}
                        labels={dictionary.admin.repairs}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PortalShell>
  );
}
