"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

import { submitClaimAction } from "./actions";
import type { ClaimState } from "./claim-state";

const initialState: ClaimState = { status: "idle" };

const INPUT_CLASS =
  "mt-1 w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:ring-2 focus:ring-slate-300";

type ClaimFormProps = {
  locale: Locale;
  room: string;
  period: string;
  labels: Dictionary["room"]["claim"];
  defaultDate?: string;
};

export default function ClaimForm({
  locale,
  room,
  period,
  labels,
  defaultDate,
}: ClaimFormProps) {
  const [state, formAction, pending] = useActionState(
    submitClaimAction.bind(null, locale, room),
    initialState,
  );

  const errorText =
    state.status === "error"
      ? state.message === "date"
        ? labels.errors.date
        : state.message === "suffix"
          ? labels.errors.suffix
          : labels.errors.generic
      : null;

  return (
    <form action={formAction} className="mt-3 border-t border-slate-800 pt-3">
      <input type="hidden" name="period" value={period} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">
          {labels.dateLabel}
          <input
            type="date"
            name="claimedOn"
            required
            defaultValue={defaultDate}
            className={INPUT_CLASS}
          />
        </label>
        <label className="text-xs text-slate-300">
          {labels.suffixLabel}
          <input
            type="text"
            name="bankLast5"
            required
            inputMode="numeric"
            maxLength={5}
            pattern="[0-9]{5}"
            autoComplete="off"
            spellCheck={false}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">{labels.suffixHint}</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60"
      >
        {pending ? labels.submitting : labels.submit}
      </button>
      {errorText === null ? null : (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {errorText}
        </p>
      )}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-sm text-emerald-300">
          {labels.success}
        </p>
      ) : null}
    </form>
  );
}
