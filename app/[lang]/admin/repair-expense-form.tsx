"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { updateRepairExpenseAction } from "./repair-actions";
import type { RepairExpenseState } from "./repair-expense-state";

const initialState: RepairExpenseState = { status: "idle" };

type Props = {
  locale: Locale;
  requestId: string;
  expenseAmount: number | null;
  labels: Dictionary["admin"]["repairs"];
};

export default function RepairExpenseForm({
  locale,
  requestId,
  expenseAmount,
  labels,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateRepairExpenseAction.bind(null, locale),
    initialState,
  );
  const errorText =
    state.status !== "error"
      ? null
      : state.message === "invalid-amount"
        ? labels.errors.invalidAmount
        : state.message === "not-done"
          ? labels.errors.notDone
          : state.message === "not-found"
            ? labels.errors.notFound
            : state.message === "rate"
              ? labels.errors.rate
              : state.message === "unavailable"
                ? labels.errors.unavailable
                : labels.errors.generic;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="text-xs text-slate-300">
        {labels.expenseLabel}
        <input
          type="number"
          name="expenseAmount"
          min="0"
          step="1"
          defaultValue={expenseAmount ?? ""}
          className="mt-1 block w-40 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-300 disabled:opacity-60"
      >
        {pending ? labels.savingExpense : labels.saveExpense}
      </button>
      {state.status === "success" ? (
        <span className="text-xs text-emerald-300">{labels.expenseSaved}</span>
      ) : null}
      {errorText === null ? null : (
        <p role="alert" className="w-full text-xs text-red-300">
          {errorText}
        </p>
      )}
    </form>
  );
}
