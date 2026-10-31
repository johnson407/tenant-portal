"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { resetRoomCodeAction } from "./actions";
import type { AdminResetState } from "./login-state";
import { ROOM_LETTERS, ROOM_UPPER } from "@/lib/rooms";

const initialState: AdminResetState = { status: "idle" };

export default function AdminResetForm() {
  const [state, formAction, pending] = useActionState(resetRoomCodeAction, initialState);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      setCopied(false);
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  async function copyCode() {
    if (state.status !== "success") return;
    await navigator.clipboard.writeText(state.code);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        {state.status === "idle" || state.status === "error" ? (
          <>
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
              <span className="mb-1 block text-sm text-slate-300">
                New 10-character code (leave blank to generate one)
              </span>
              <input
                name="code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={10}
                placeholder="e.g. R3turnK3y55"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono tracking-widest text-slate-100 focus:border-slate-400 focus:outline-none"
              />
            </label>
            {state.status === "error" ? <p className="text-sm text-red-400">{state.message}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 hover:bg-slate-300 disabled:opacity-50"
            >
              {pending ? "Resetting..." : "Reset code"}
            </button>
          </>
        ) : null}
      </form>

      {state.status === "success" ? (
        <div ref={resultRef} className="rounded-lg border border-amber-500 bg-amber-50 p-6 text-slate-900">
          <p className="text-sm font-medium">Room {ROOM_UPPER[state.room as keyof typeof ROOM_UPPER]} access code reset.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="block rounded bg-white px-3 py-2 font-mono text-lg tracking-widest select-all">
              {state.code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-sm font-medium text-red-700">
            This code is shown only once. It is stored only as a bcrypt hash from now on.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/admin";
            }}
            className="mt-4 text-sm text-slate-600 underline hover:text-slate-900"
          >
            Reset another room
          </button>
        </div>
      ) : null}
    </div>
  );
}
