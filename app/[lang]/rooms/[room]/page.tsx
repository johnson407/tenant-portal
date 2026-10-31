import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";
import { logoutAction } from "@/app/[lang]/logout-actions";
import { getRoomFeed } from "@/lib/appfeed/feed";
import type { FeedResult } from "@/lib/appfeed/types";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { formatDate, formatDateTime, formatTwd } from "@/lib/i18n/format";
import { getSessionClaims } from "@/lib/session-cookies";
import { getRoomSessionVersion } from "@/lib/session-version";
import { ROOM_UPPER, parseRoomLetter } from "@/lib/rooms";

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
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-slate-100">
        <div className="flex w-full max-w-md items-center justify-end">
          <LocaleSwitcher locale={lang} path={room ? `/rooms/${room}` : "/"} />
        </div>
        <h1 className="text-2xl font-semibold">{dictionary.denied.heading}</h1>
        <p className="text-sm text-slate-400">{dictionary.denied.message}</p>
        <Link
          href={localePath(lang, "/")}
          className="underline text-slate-300 hover:text-white"
        >
          {dictionary.denied.backToDashboard}
        </Link>
        {claims?.role === "tenant" ? (
          <form action={logoutAction.bind(null, lang)}>
            <button
              type="submit"
              className="rounded border border-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {dictionary.common.logOut}
            </button>
          </form>
        ) : null}
      </main>
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-slate-900">
            {dictionary.room.headingTemplate.replace("{room}", ROOM_UPPER[room])}
          </h1>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={lang} path={`/rooms/${room}`} tone="light" />
            <form action={logoutAction.bind(null, lang)}>
              <button
                type="submit"
                className="rounded border border-slate-500 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
              >
                {dictionary.common.logOut}
              </button>
            </form>
          </div>
        </header>

        {feed === null ? (
          <section className="rounded border border-slate-300 bg-white p-6 text-slate-900">
            <h2 className="text-xl font-medium text-slate-800">
              {dictionary.room.unavailableHeading}
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {dictionary.room.unavailableMessage}
            </p>
          </section>
        ) : (
          <>
            <p className="text-xs text-slate-700">
              {dictionary.room.lastUpdatedTemplate.replace(
                "{date}",
                formatDateTime(feed.fetchedAt, lang),
              )}
            </p>

            <section>
              <h2 className="text-xl font-medium text-slate-800">
                {dictionary.room.bills}
              </h2>
              {feed.openBills.length === 0 ? (
                <p className="mt-2 text-sm text-slate-700">
                  {dictionary.room.emptyBills}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-300 rounded border border-slate-300 bg-white text-slate-900">
                  {feed.openBills.map((bill) => (
                    <li key={bill.period} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {dictionary.room.period} {bill.period}
                        </span>
                        <span className="font-mono text-sm">
                          {dictionary.room.total} {formatTwd(bill.total, lang)} -{" "}
                          {dictionary.room.due} {formatDate(bill.dueDate, lang)} -{" "}
                          {dictionary.room.status.open}
                        </span>
                      </div>
                      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {[
                          {
                            key: "rent",
                            label: dictionary.room.rent,
                            value: bill.rent,
                          },
                          {
                            key: "water",
                            label: dictionary.room.water,
                            value: bill.water,
                          },
                          {
                            key: "electricity",
                            label: dictionary.room.electricity,
                            value: bill.electricity,
                          },
                        ].map(({ key, label, value }) =>
                          value === null ? null : (
                            <div key={key} className="flex gap-1">
                              <dt className="text-xs text-slate-700">{label}</dt>
                              <dd className="font-mono text-xs text-slate-900">
                                {formatTwd(value, lang)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-medium text-slate-800">
                {dictionary.room.payments}
              </h2>
              {feed.payments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-700">
                  {dictionary.room.emptyPayments}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-300 rounded border border-slate-300 bg-white text-slate-900">
                  {feed.payments.map((payment) => (
                    <li
                      key={payment.period}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <span className="font-medium">
                        {dictionary.room.period} {payment.period}
                      </span>
                      <span className="font-mono text-sm">
                        {formatTwd(payment.amount, lang)} -{" "}
                        {dictionary.room.received}{" "}
                        {formatDate(payment.receivedOn, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-medium text-slate-800">
                {dictionary.room.leaseDates}
              </h2>
              {feed.lease === null ? (
                <p className="mt-2 text-sm text-slate-700">
                  {dictionary.room.emptyLease}
                </p>
              ) : (
                <dl className="mt-2 grid grid-cols-1 gap-2 rounded border border-slate-300 bg-white p-4 text-slate-900 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-700">
                      {dictionary.room.leaseStart}
                    </dt>
                    <dd className="font-mono text-sm">
                      {formatDate(feed.lease.start, lang)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-700">
                      {dictionary.room.leaseEnd}
                    </dt>
                    <dd className="font-mono text-sm">
                      {formatDate(feed.lease.end, lang)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-700">
                      {dictionary.room.renewalDue}
                    </dt>
                    <dd className="font-mono text-sm">
                      {feed.lease.renewalDue === null
                        ? dictionary.room.notAvailable
                        : formatDate(feed.lease.renewalDue, lang)}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
