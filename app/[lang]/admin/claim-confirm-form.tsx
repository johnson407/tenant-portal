"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

import { confirmClaimAction } from "./claim-actions";
import type { ClaimConfirmState } from "./claim-state";

const initialState: ClaimConfirmState = { status: "idle" };

type ClaimConfirmFormProps = {
  locale: Locale;
  room: string;
  period: string;
  claimedOn: string;
  labels: Dictionary["admin"]["claims"];
};

export default function ClaimConfirmForm({
  locale,
  room,
  period,
  claimedOn,
  labels,
}: ClaimConfirmFormProps) {
  const [state, formAction, pending] = useActionState(
    confirmClaimAction.bind(null, locale),
    initialState,
  );

  const errorText =
    state.status === "error"
      ? state.message === "date"
        ? labels.errors.date
        : state.message === "note"
          ? labels.errors.note
          : state.message === "not-found"
            ? labels.errors.notFound
            : state.message === "paid"
              ? labels.errors.paid
              : state.message === "unavailable"
                ? labels.errors.unavailable
                : state.message === "rate"
                  ? labels.errors.rate
                  : labels.errors.generic
      : null;

  return (
    <form action={formAction} className="min-w-56">
      <input type="hidden" name="room" value={room} />
      <input type="hidden" name="period" value={period} />
      <label className="block text-xs text-slate-300">
        {labels.paidOnLabel}
        <input
          type="date"
          name="paidOn"
          required
          defaultValue={claimedOn}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        />
      </label>
      <label className="mt-2 block text-xs text-slate-300">
        {labels.noteLabel}
        <input
          type="text"
          name="note"
          maxLength={200}
          placeholder={labels.notePlaceholder}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded border border-slate-500 px-3 py-1 text-xs font-medium text-slate-100 hover:border-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60"
      >
        {pending ? labels.confirming : labels.confirm}
      </button>
      {errorText === null ? null : (
        <p role="alert" className="mt-1 text-xs text-red-300">
          {errorText}
        </p>
      )}
    </form>
  );
}
