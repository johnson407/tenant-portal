"use client";

import { useActionState } from "react";
import { adminLoginAction } from "./actions";
import { GENERIC_ADMIN_LOGIN_ERROR, type AdminLoginState } from "../login-state";

const initialState: AdminLoginState = {};

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">Admin password</span>
        <input
          name="password"
          type="password"
          autoComplete="off"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:outline-none"
        />
      </label>
      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 hover:bg-slate-300 disabled:opacity-50"
      >
        {pending ? "Checking..." : "Sign in"}
      </button>
    </form>
  );
}
