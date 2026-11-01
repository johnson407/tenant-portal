"use client";

import { useActionState } from "react";
import type { RepairCategory } from "@/lib/appfeed/types";
import type { Dictionary, Locale } from "@/lib/i18n";

import { submitRepairAction } from "./repair-actions";
import type { RepairState } from "./repair-state";

const initialState: RepairState = { status: "idle" };

const CATEGORY_OPTIONS = [
  "plumbing",
  "electrical",
  "appliance",
  "other",
] as const satisfies readonly RepairCategory[];

const INPUT_CLASS =
  "mt-1 w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:ring-2 focus:ring-slate-300";

type RepairFormProps = {
  locale: Locale;
  room: string;
  labels: Dictionary["room"]["repairs"];
};

export default function RepairForm({ locale, room, labels }: RepairFormProps) {
  const [state, formAction, pending] = useActionState(
    submitRepairAction.bind(null, locale, room),
    initialState,
  );

  const errorText =
    state.status === "error" ? labels.errors[state.message] : null;

  return (
    <form action={formAction} className="border-t border-slate-800 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">
          {labels.form.categoryLabel}
          <select
            name="category"
            required
            defaultValue=""
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              {labels.form.categoryPlaceholder}
            </option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {labels.categories[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-300">
          {labels.form.noteLabel}
          <input
            type="text"
            name="note"
            required
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">{labels.form.notePlaceholder}</p>
      <p className="mt-1 text-xs text-slate-400">{labels.form.noteHint}</p>
      <p className="mt-1 text-xs text-slate-400">{labels.form.warning}</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60"
      >
        {pending ? labels.form.submitting : labels.form.submit}
      </button>
      {errorText === null ? null : (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {errorText}
        </p>
      )}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-sm text-emerald-300">
          {labels.form.success}
        </p>
      ) : null}
    </form>
  );
}
