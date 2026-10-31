"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { GENERIC_LOGIN_ERROR, type LoginState } from "./login-state";
import { ROOM_LETTERS, ROOM_UPPER } from "@/lib/rooms";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">Room</span>
        <select
          name="room"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-400 focus:outline-none"
        >
          {ROOM_LETTERS.map((letter) => (
            <option key={letter} value={letter}>
              Room {ROOM_UPPER[letter]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">Access code</span>
        <input
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={10}
          minLength={10}
          placeholder="10-character code"
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono tracking-widest text-slate-100 focus:border-slate-400 focus:outline-none"
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
