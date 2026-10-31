"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import type { BankAccount } from "@/lib/bank-account";
import type { Dictionary, Locale } from "@/lib/i18n";

import { saveBankAccountAction } from "./bank-actions";
import type { BankAccountState } from "./bank-state";

const initialState: BankAccountState = { status: "idle" };

const EMPTY_VALUES: BankAccount = {
  bankName: "",
  recipientName: "",
  bankCode: "",
  accountNo: "",
};

const INPUT_CLASS =
  "w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300";

type AdminBankFormProps = {
  locale: Locale;
  labels: Dictionary["admin"]["bank"];
  initialValues: BankAccount | null;
};

export default function AdminBankForm({ locale, labels, initialValues }: AdminBankFormProps) {
  const [state, formAction, pending] = useActionState(
    saveBankAccountAction.bind(null, locale),
    initialState,
  );
  const [values, setValues] = useState<BankAccount>(initialValues ?? EMPTY_VALUES);
  const [editedSinceSave, setEditedSinceSave] = useState(false);

  useEffect(() => {
    if (state.status === "success") setEditedSinceSave(false);
  }, [state]);

  const errorText =
    state.status === "error"
      ? state.message === "invalid"
        ? labels.errors.invalid
        : labels.errors.generic
      : null;

  function fieldProps(field: keyof BankAccount) {
    return {
      name: field,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setValues((current) => ({ ...current, [field]: event.target.value }));
        setEditedSinceSave(true);
      },
      autoComplete: "off",
      spellCheck: false,
      className: INPUT_CLASS,
    };
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{labels.sectionHeading}</h2>
      <form
        action={formAction}
        className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6"
      >
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">{labels.bankName}</span>
          <input
            {...fieldProps("bankName")}
            type="text"
            maxLength={80}
            placeholder={labels.bankNamePlaceholder}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">{labels.recipientName}</span>
          <input
            {...fieldProps("recipientName")}
            type="text"
            maxLength={80}
            placeholder={labels.recipientNamePlaceholder}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">{labels.bankCode}</span>
          <input
            {...fieldProps("bankCode")}
            type="text"
            inputMode="numeric"
            maxLength={7}
            placeholder={labels.bankCodePlaceholder}
          />
          <span className="mt-1 block text-xs text-slate-400">{labels.bankCodeHint}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">{labels.accountNo}</span>
          <input
            {...fieldProps("accountNo")}
            type="text"
            inputMode="numeric"
            maxLength={20}
            placeholder={labels.accountNoPlaceholder}
          />
          <span className="mt-1 block text-xs text-slate-400">{labels.accountNoHint}</span>
        </label>
        {errorText ? (
          <p className="text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}
        {state.status === "success" && !editedSinceSave ? (
          <p className="text-sm text-emerald-400" role="status">
            {labels.saved}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 hover:bg-slate-300 disabled:opacity-50"
        >
          {pending ? labels.saving : labels.save}
        </button>
      </form>
    </section>
  );
}
