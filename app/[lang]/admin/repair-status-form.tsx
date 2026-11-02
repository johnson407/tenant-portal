"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { updateRepairStatusAction } from "./repair-actions";
import type { RepairUpdateState } from "./repair-update-state";

const initialState: RepairUpdateState = { status: "idle" };

type Props = {
  locale: Locale;
  requestId: string;
  status: "pending" | "scheduled" | "in_progress";
  visitStart: string | null;
  visitEnd: string | null;
  labels: Dictionary["admin"]["repairs"];
};

export default function RepairStatusForm({
  locale,
  requestId,
  status,
  visitStart,
  visitEnd,
  labels,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateRepairStatusAction.bind(null, locale),
    initialState,
  );

  const errorText =
    state.status !== "error"
      ? null
      : state.message === "invalid-status"
        ? labels.errors.invalidStatus
        : state.message === "invalid-window"
          ? labels.errors.invalidWindow
          : state.message === "rate"
            ? labels.errors.rate
            : state.message === "unavailable"
              ? labels.errors.unavailable
              : labels.errors.generic;

  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="text-xs text-slate-300">
        {labels.status}
        <select
          name="status"
          defaultValue={status}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <option value="pending">{labels.pending}</option>
          <option value="scheduled">{labels.scheduled}</option>
          <option value="in_progress">{labels.inProgress}</option>
        </select>
      </label>
      <label className="text-xs text-slate-300">
        {labels.visitStart}
        <input
          type="datetime-local"
          name="visitStart"
          defaultValue={visitStart?.slice(0, 16) ?? ""}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        />
      </label>
      <label className="text-xs text-slate-300">
        {labels.visitEnd}
        <input
          type="datetime-local"
          name="visitEnd"
          defaultValue={visitEnd?.slice(0, 16) ?? ""}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-300 disabled:opacity-60"
        >
          {pending ? labels.savingStatus : labels.saveStatus}
        </button>
        {state.status === "success" ? (
          <span className="ml-2 text-xs text-emerald-300">{labels.statusSaved}</span>
        ) : null}
        {errorText === null ? null : (
          <p role="alert" className="mt-1 text-xs text-red-300">
            {errorText}
          </p>
        )}
      </div>
    </form>
  );
}
