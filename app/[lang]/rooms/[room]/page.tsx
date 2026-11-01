import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PortalShell from "@/app/[lang]/portal-shell";
import SectionCard from "@/app/[lang]/section-card";
import { getRoomFeed } from "@/lib/appfeed/feed";
import { getRoomRepairs } from "@/lib/appfeed/repairs";
import type { FeedResult, RoomRepairsResult } from "@/lib/appfeed/types";
import { type BankAccount, getBankAccount } from "@/lib/bank-account";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatRate,
  formatTwd,
} from "@/lib/i18n/format";
import { getSessionClaims } from "@/lib/session-cookies";
import { getRoomSessionVersion } from "@/lib/session-version";
import { ROOM_UPPER, parseRoomLetter } from "@/lib/rooms";
import { maskBankLast5 } from "@/lib/mask";
import ClaimForm from "./claim-form";
import RepairForm from "./repair-form";

export const instant = false;

type RoomPageProps = { params: Promise<{ lang: string; room: string }> };

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { lang, room: roomParam } = await params;
  if (!isLocale(lang)) notFound();
  const room = parseRoomLetter(roomParam);
  if (!room) return { title: getDictionary(lang).meta.siteName };

  const dictionary = getDictionary(lang);
  return {
    title: dictionary.room.headingTemplate.replace("{room}", ROOM_UPPER[room]),
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { lang, room: roomParam } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = getDictionary(lang);
  const room = parseRoomLetter(roomParam);

  const claims = await getSessionClaims();
  let authorized = false;
  if (room && claims?.role === "tenant" && claims.room === room) {
    try {
      authorized = claims.v === (await getRoomSessionVersion(room));
    } catch {
      authorized = false;
    }
  }

  if (!room || !authorized) {
    return (
      <PortalShell
        locale={lang}
        path={room ? `/rooms/${room}` : "/"}
        showLogout={claims?.role === "tenant"}
        centerContent
      >
        <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 text-center text-slate-100">
          <h1 className="text-2xl font-semibold">{dictionary.denied.heading}</h1>
          <p className="mt-2 text-sm text-slate-400">{dictionary.denied.message}</p>
          <Link
            href={localePath(lang, "/")}
            className="mt-6 inline-block rounded text-sm text-slate-300 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            {dictionary.denied.backToDashboard}
          </Link>
        </div>
      </PortalShell>
    );
  }

  if (claims?.role !== "tenant") notFound();

  let result: FeedResult;
  try {
    result = await getRoomFeed(claims.room);
  } catch {
    result = { kind: "unavailable" };
  }

  const feed = result.kind === "ok" ? result.feed : null;

  let bankAccount: BankAccount | null = null;
  try {
    bankAccount = await getBankAccount();
  } catch {
    bankAccount = null;
  }

  let repairsResult: RoomRepairsResult = { kind: "unavailable" };
  try {
    repairsResult = await getRoomRepairs(claims.room);
  } catch {
    repairsResult = { kind: "unavailable" };
  }

  const roomHeading = dictionary.room.headingTemplate.replace("{room}", ROOM_UPPER[room]);

  const bankCard =
    bankAccount === null ? null : (
      <SectionCard title={dictionary.room.bankAccount.heading}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-300">{dictionary.room.bankAccount.bankName}</dt>
            <dd className="mt-1 text-sm text-slate-100">{bankAccount.bankName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">
              {dictionary.room.bankAccount.recipientName}
            </dt>
            <dd className="mt-1 text-sm text-slate-100">{bankAccount.recipientName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">{dictionary.room.bankAccount.bankCode}</dt>
            <dd className="mt-1 font-mono text-sm text-slate-100">{bankAccount.bankCode}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-300">{dictionary.room.bankAccount.accountNo}</dt>
            <dd className="mt-1 font-mono text-sm break-all text-slate-100">
              {bankAccount.accountNo}
            </dd>
          </div>
        </dl>
      </SectionCard>
    );

  return (
    <PortalShell
      locale={lang}
      path={`/rooms/${room}`}
      brandHref={localePath(lang, `/rooms/${room}`)}
      context={roomHeading}
      showLogout
    >
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h1 className="text-3xl font-semibold text-slate-100">{roomHeading}</h1>
          {feed === null ? null : (
            <p className="text-sm text-slate-300 sm:text-right">
              {dictionary.room.lastUpdatedTemplate.replace(
                "{date}",
                formatDateTime(feed.fetchedAt, lang),
              )}
            </p>
          )}
        </div>
        {feed === null ? null : feed.lease === null ? (
          <p className="text-sm text-slate-300">{dictionary.room.emptyLease}</p>
        ) : (
          <dl className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-slate-800">
            <div className="sm:pr-4">
              <dt className="text-xs text-slate-300">{dictionary.room.leaseStart}</dt>
              <dd className="mt-1 font-mono text-base text-slate-100">
                {formatDate(feed.lease.start, lang)}
              </dd>
            </div>
            <div className="sm:px-4">
              <dt className="text-xs text-slate-300">{dictionary.room.leaseEnd}</dt>
              <dd className="mt-1 font-mono text-base text-slate-100">
                {formatDate(feed.lease.end, lang)}
              </dd>
            </div>
            <div className="sm:pl-4">
              <dt className="text-xs text-slate-300">{dictionary.room.renewalDue}</dt>
              <dd className="mt-1 font-mono text-base text-slate-100">
                {feed.lease.renewalDue === null
                  ? dictionary.room.notAvailable
                  : formatDate(feed.lease.renewalDue, lang)}
              </dd>
            </div>
          </dl>
        )}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
        {feed === null ? (
          <SectionCard title={dictionary.room.unavailableHeading}>
            <p className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
              {dictionary.room.unavailableMessage}
            </p>
          </SectionCard>
        ) : (
          <SectionCard title={dictionary.room.bills}>
            {feed.openBills.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
                {dictionary.room.emptyBills}
              </p>
            ) : (
              <ul className="space-y-3">
                {feed.openBills.map((bill) => (
                  <li
                    key={bill.period}
                    className="rounded-md border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-medium text-slate-100">
                        {dictionary.room.period} {bill.period}
                      </span>
                      <span className="rounded-full bg-amber-950 px-2.5 py-1 text-xs font-medium text-amber-200">
                        {dictionary.room.status.open}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xl text-slate-100">
                        {dictionary.room.total} {formatTwd(bill.total, lang)}
                      </span>
                      <span className="text-xs text-slate-300">
                        {dictionary.room.due} {formatDate(bill.dueDate, lang)}
                      </span>
                    </div>
                    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-3">
                      {[
                        {
                          key: "rent",
                          label: dictionary.room.rent,
                          value: bill.rent,
                          breakdown: null,
                        },
                        {
                          key: "water",
                          label: dictionary.room.water,
                          value: bill.water,
                          breakdown: bill.waterBreakdown,
                        },
                        {
                          key: "electricity",
                          label: dictionary.room.electricity,
                          value: bill.electricity,
                          breakdown: bill.electricityBreakdown,
                        },
                      ].map(({ key, label, value, breakdown }) =>
                        value === null ? null : (
                          <div key={key} className="flex flex-wrap items-baseline gap-1">
                            <dt className="text-xs text-slate-300">{label}</dt>
                            <dd className="font-mono text-xs text-slate-100">
                              {formatTwd(value, lang)}
                            </dd>
                            {breakdown == null ? null : (
                              <dd className="w-full text-xs text-slate-300">
                                {dictionary.room.billBreakdownTemplate
                                  .replace("{start}", formatCount(breakdown.start, lang))
                                  .replace("{end}", formatCount(breakdown.end, lang))
                                  .replace("{units}", formatCount(breakdown.units, lang))
                                  .replace("{rate}", formatRate(breakdown.rate, lang))}
                              </dd>
                            )}
                          </div>
                        ),
                      )}
                    </dl>
                    {bill.claim === null ? null : (
                      <div className="mt-3 border-t border-slate-800 pt-3">
                        <p className="rounded-md border border-dashed border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
                          {dictionary.room.claim.reportedTemplate.replace(
                            "{date}",
                            formatDate(bill.claim.claimedOn, lang),
                          )}
                        </p>
                        <p className="mt-2 font-mono text-xs text-slate-300">
                          {dictionary.room.claim.maskedTemplate.replace(
                            "{masked}",
                            maskBankLast5(bill.claim.bankLast5),
                          )}
                        </p>
                      </div>
                    )}
                    <ClaimForm
                      locale={lang}
                      room={room}
                      period={bill.period}
                      labels={dictionary.room.claim}
                      defaultDate={bill.claim?.claimedOn}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <aside className="space-y-6">
          {bankCard}
          {feed === null ? null : (
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100">
              <details>
                <summary className="cursor-pointer rounded text-xl font-semibold text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
                  <h2 className="inline">{dictionary.room.payments}</h2>
                </summary>
                {feed.payments.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
                    {dictionary.room.emptyPayments}
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-800 border-t border-slate-800">
                    {feed.payments.map((payment) => (
                      <li
                        key={payment.period}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <span className="font-medium text-slate-100">
                          {dictionary.room.period} {payment.period}
                        </span>
                        <span className="font-mono text-sm text-slate-300">
                          {formatTwd(payment.amount, lang)} -{" "}
                          {dictionary.room.received}{" "}
                          {formatDate(payment.receivedOn, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </section>
          )}
        </aside>
      </div>

      <div className="mt-6">
        <SectionCard
          title={dictionary.room.repairs.sectionHeading}
          caption={dictionary.room.repairs.sectionCaption}
        >
          {repairsResult.kind !== "ok" ? (
            <p className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
              {dictionary.room.repairs.unavailable}
            </p>
          ) : (
            <>
              <RepairForm
                locale={lang}
                room={room}
                labels={dictionary.room.repairs}
              />
              <div className="mt-4 border-t border-slate-800 pt-4">
                {repairsResult.repairs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
                    {dictionary.room.repairs.empty}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {repairsResult.repairs.map((repair) => (
                      <li
                        key={repair.requestId}
                        className="rounded-md border border-slate-800 bg-slate-950/50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="font-medium text-slate-100">
                            {
                              dictionary.room.repairs.categories[
                                repair.category
                              ]
                            }
                          </span>
                          <span
                            className={
                              repair.status === "pending"
                                ? "rounded-full bg-amber-950 px-2.5 py-1 text-xs font-medium text-amber-200"
                                : "rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-200"
                            }
                          >
                            {
                              dictionary.room.repairs.history.status[
                                repair.status
                              ]
                            }
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm text-slate-200">
                          {repair.note}
                        </p>
                        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-xs">
                          <div className="flex gap-1">
                            <dt className="text-slate-300">
                              {dictionary.room.repairs.history.submittedOn}
                            </dt>
                            <dd className="font-mono text-slate-100">
                              {formatDate(repair.submittedOn, lang)}
                            </dd>
                          </div>
                          {repair.doneOn === null ? null : (
                            <div className="flex gap-1">
                              <dt className="text-slate-300">
                                {dictionary.room.repairs.history.doneOn}
                              </dt>
                              <dd className="font-mono text-slate-100">
                                {formatDate(repair.doneOn, lang)}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </PortalShell>
  );
}
