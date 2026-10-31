import type { RoomLetter } from "./rooms";

export type BillLine = { label: string; amountCents: number; due: string; status: "open" | "paid" };
export type PaymentLine = { label: string; amountCents: number; received: string };
export type LeaseDates = { start: string; end: string; renewalDue: string };

export type RoomPlaceholderData = {
  room: RoomLetter;
  bills: BillLine[];
  payments: PaymentLine[];
  lease: LeaseDates;
};

// PLACEHOLDER DATA ONLY: sample amounts/dates with no tenant names, phone
// numbers, or email addresses anywhere. A future change will swap the data
// source without touching the page shell.
export const PLACEHOLDER_ROOM_DATA: Record<RoomLetter, RoomPlaceholderData> = {
  a: {
    room: "a",
    bills: [
      { label: "Rent - current month", amountCents: 75000, due: "2026-11-01", status: "open" },
      { label: "Utilities", amountCents: 8200, due: "2026-11-15", status: "open" },
    ],
    payments: [
      { label: "Rent - previous month", amountCents: 75000, received: "2026-10-01" },
    ],
    lease: { start: "2026-01-01", end: "2026-12-31", renewalDue: "2026-11-30" },
  },
  b: {
    room: "b",
    bills: [
      { label: "Rent - current month", amountCents: 70000, due: "2026-11-01", status: "open" },
      { label: "Utilities", amountCents: 7900, due: "2026-11-15", status: "open" },
    ],
    payments: [
      { label: "Rent - previous month", amountCents: 70000, received: "2026-10-03" },
    ],
    lease: { start: "2026-02-01", end: "2027-01-31", renewalDue: "2026-12-31" },
  },
  c: {
    room: "c",
    bills: [
      { label: "Rent - current month", amountCents: 68000, due: "2026-11-01", status: "open" },
      { label: "Utilities", amountCents: 8400, due: "2026-11-15", status: "open" },
    ],
    payments: [
      { label: "Rent - previous month", amountCents: 68000, received: "2026-10-02" },
    ],
    lease: { start: "2026-03-01", end: "2027-02-28", renewalDue: "2027-01-31" },
  },
  d: {
    room: "d",
    bills: [
      { label: "Rent - current month", amountCents: 72000, due: "2026-11-01", status: "open" },
      { label: "Utilities", amountCents: 8100, due: "2026-11-15", status: "open" },
    ],
    payments: [
      { label: "Rent - previous month", amountCents: 72000, received: "2026-10-05" },
    ],
    lease: { start: "2026-04-01", end: "2027-03-31", renewalDue: "2027-02-28" },
  },
  e: {
    room: "e",
    bills: [
      { label: "Rent - current month", amountCents: 65000, due: "2026-11-01", status: "open" },
      { label: "Utilities", amountCents: 7700, due: "2026-11-15", status: "open" },
    ],
    payments: [
      { label: "Rent - previous month", amountCents: 65000, received: "2026-10-04" },
    ],
    lease: { start: "2026-05-01", end: "2027-04-30", renewalDue: "2027-03-31" },
  },
};

export function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}
