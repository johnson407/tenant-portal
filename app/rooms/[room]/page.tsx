import Link from "next/link";
import {
  PLACEHOLDER_ROOM_DATA,
  formatAmount,
  type RoomPlaceholderData,
} from "@/lib/placeholder-data";
import { getSessionClaims } from "@/lib/session-cookies";
import { getRoomSessionVersion } from "@/lib/session-version";
import { ROOM_UPPER, parseRoomLetter } from "@/lib/rooms";
import { logoutAction } from "@/app/logout-actions";

export const instant = false;

export default async function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomParam } = await params;
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
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="text-sm text-slate-400">
          You are not authorized to view this room&apos;s dashboard.
        </p>
        <Link href="/" className="underline text-slate-300 hover:text-white">
          Back to your dashboard
        </Link>
        {claims?.role === "tenant" ? (
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-slate-500 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Log out
            </button>
          </form>
        ) : null}
      </main>
    );
  }

  const data: RoomPlaceholderData = PLACEHOLDER_ROOM_DATA[room];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-slate-900">Room {ROOM_UPPER[room]}</h1>
          <div className="flex items-center gap-3">
            <p className="rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
              Placeholder data - for demonstration only
            </p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded border border-slate-500 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            Bills <span className="text-sm font-normal text-slate-500">(sample data)</span>
          </h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {data.bills.map((bill) => (
              <li key={bill.label} className="flex items-center justify-between px-4 py-3">
                <span>{bill.label}</span>
                <span className="font-mono text-sm">
                  {formatAmount(bill.amountCents)} - due {bill.due} - {bill.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            Payments <span className="text-sm font-normal text-slate-500">(sample data)</span>
          </h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {data.payments.map((payment) => (
              <li key={payment.label} className="flex items-center justify-between px-4 py-3">
                <span>{payment.label}</span>
                <span className="font-mono text-sm">
                  {formatAmount(payment.amountCents)} - received {payment.received}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium text-slate-800">
            Lease dates <span className="text-sm font-normal text-slate-500">(sample data)</span>
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Lease start</dt>
              <dd className="font-mono text-sm">{data.lease.start}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lease end</dt>
              <dd className="font-mono text-sm">{data.lease.end}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Renewal decision due</dt>
              <dd className="font-mono text-sm">{data.lease.renewalDue}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
