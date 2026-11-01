"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

import { markRepairDoneAction } from "./repair-actions";
import type { RepairDoneState } from "./repair-state";

const initialState: RepairDoneState = { status: "idle" };

type RepairDoneFormProps = {
  locale: Locale;
  requestId: string;
  labels: Dictionary["admin"]["repairs"];
};

export default function RepairDoneForm({
  locale,
  requestId,
  labels,
}: RepairDoneFormProps) {
  const [state, formAction, pending] = useActionState(
    markRepairDoneAction.bind(null, locale),
    initialState,
  );

  const errorText =
    state.status === "error"
      ? state.message === "already-done"
        ? labels.errors.alreadyDone
        : state.message === "not-found"
          ? labels.errors.notFound
          : state.message === "invalid-note"
            ? labels.errors.invalidNote
            : state.message === "unavailable"
            ? labels.errors.unavailable
            : state.message === "rate"
              ? labels.errors.rate
              : labels.errors.generic
      : null;

  return (
    <form action={formAction}>
      <input type="hidden" name="requestId" value={requestId} />
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
        {pending ? labels.marking : labels.markDone}
      </button>
      {errorText === null ? null : (
        <p role="alert" className="mt-1 text-xs text-red-300">
          {errorText}
        </p>
      )}
    </form>
  );
}
