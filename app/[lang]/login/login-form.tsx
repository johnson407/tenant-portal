"use client";

import { useActionState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ROOM_LETTERS, ROOM_PASSWORD_MAX_LENGTH, ROOM_PASSWORD_MIN_LENGTH, ROOM_UPPER } from "@/lib/rooms";
import { loginAction } from "./actions";
import { type LoginState } from "./login-state";

const initialState: LoginState = {};

type LoginFormProps = {
  locale: Locale;
  labels: Dictionary["login"];
};

export default function LoginForm({ locale, labels }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    loginAction.bind(null, locale),
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">{labels.roomLabel}</span>
        <select
          name="room"
          required
          className="w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
        >
          {ROOM_LETTERS.map((letter) => (
            <option key={letter} value={letter}>
              {labels.roomLabel} {ROOM_UPPER[letter]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">{labels.codeLabel}</span>
        <input
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={ROOM_PASSWORD_MAX_LENGTH}
          minLength={ROOM_PASSWORD_MIN_LENGTH}
          placeholder={labels.codePlaceholder}
          className="w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 font-mono tracking-widest text-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
        />
      </label>
      {state.error ? <p className="text-sm text-red-400">{labels.errors.invalidCredentials}</p> : null}
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
