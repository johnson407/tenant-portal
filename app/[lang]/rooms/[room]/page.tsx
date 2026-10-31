import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LocaleSwitcher from "@/app/[lang]/locale-switcher";
import { logoutAction } from "@/app/[lang]/logout-actions";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";
import { formatDate, formatTwd } from "@/lib/i18n/format";
import {
  PLACEHOLDER_ROOM_DATA,
  type RoomPlaceholderData,
} from "@/lib/placeholder-data";
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

  const data: RoomPlaceholderData = PLACEHOLDER_ROOM_DATA[room];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-slate-900">
            {dictionary.room.headingTemplate.replace("{room}", ROOM_UPPER[room])}
          </h1>
          <div className="flex items-center gap-3">
            <p className="rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
              {dictionary.room.placeholderBadge}
            </p>
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

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            {dictionary.room.bills}{" "}
            <span className="text-sm font-normal text-slate-700">
              {dictionary.room.sampleDataCaption}
            </span>
          </h2>
          <ul className="mt-2 divide-y divide-slate-300 rounded border border-slate-300 bg-white text-slate-900">
            {data.bills.map((bill) => (
              <li key={bill.labelKey} className="flex items-center justify-between px-4 py-3">
                <span>{dictionary.room.labels[bill.labelKey]}</span>
                <span className="font-mono text-sm">
                  {formatTwd(bill.amountCents, lang)} - {dictionary.room.due}{" "}
                  {formatDate(bill.due, lang)} - {dictionary.room.status[bill.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            {dictionary.room.payments}{" "}
            <span className="text-sm font-normal text-slate-700">
              {dictionary.room.sampleDataCaption}
            </span>
          </h2>
          <ul className="mt-2 divide-y divide-slate-300 rounded border border-slate-300 bg-white text-slate-900">
            {data.payments.map((payment) => (
              <li
                key={payment.labelKey}
                className="flex items-center justify-between px-4 py-3"
              >
                <span>{dictionary.room.labels[payment.labelKey]}</span>
                <span className="font-mono text-sm">
                  {formatTwd(payment.amountCents, lang)} - {dictionary.room.received}{" "}
                  {formatDate(payment.received, lang)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            {dictionary.room.leaseDates}{" "}
            <span className="text-sm font-normal text-slate-700">
              {dictionary.room.sampleDataCaption}
            </span>
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 rounded border border-slate-300 bg-white p-4 text-slate-900 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-700">{dictionary.room.leaseStart}</dt>
              <dd className="font-mono text-sm">{formatDate(data.lease.start, lang)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-700">{dictionary.room.leaseEnd}</dt>
              <dd className="font-mono text-sm">{formatDate(data.lease.end, lang)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-700">{dictionary.room.renewalDue}</dt>
              <dd className="font-mono text-sm">
                {formatDate(data.lease.renewalDue, lang)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
