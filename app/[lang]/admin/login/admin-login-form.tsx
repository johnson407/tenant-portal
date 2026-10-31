"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { adminLoginAction } from "./actions";
import { type AdminLoginState } from "../login-state";

const initialState: AdminLoginState = {};

type AdminLoginFormProps = {
  locale: Locale;
  labels: Dictionary["adminLogin"];
};

export default function AdminLoginForm({ locale, labels }: AdminLoginFormProps) {
  const [state, formAction, pending] = useActionState(
    adminLoginAction.bind(null, locale),
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">{labels.passwordLabel}</span>
        <input
          name="password"
          type="password"
          autoComplete="off"
          required
          className="w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
        />
      </label>
      {state.error ? <p className="text-sm text-red-400">{labels.errors.accessDenied}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 hover:bg-slate-300 disabled:opacity-50"
      >
        {pending ? labels.checking : labels.signIn}
      </button>
    </form>
  );
}
