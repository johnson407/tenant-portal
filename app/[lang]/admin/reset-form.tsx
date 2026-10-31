"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n/config";
import { ROOM_LETTERS, ROOM_UPPER } from "@/lib/rooms";
import { resetRoomCodeAction } from "./actions";
import type { AdminResetState } from "./login-state";

const initialState: AdminResetState = { status: "idle" };

type AdminResetFormProps = {
  locale: Locale;
  labels: Dictionary["admin"];
};

export default function AdminResetForm({ locale, labels }: AdminResetFormProps) {
  const [state, formAction, pending] = useActionState(
    resetRoomCodeAction.bind(null, locale),
    initialState,
  );
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

  const errorText =
    state.status === "error"
      ? state.message === "invalid-room"
        ? labels.errors.invalidRoom
        : labels.errors.accessDenied
      : null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{labels.resetSectionHeading}</h2>
      <div className="space-y-6">
        <form action={formAction} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        {state.status === "idle" || state.status === "error" ? (
          <>
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
              <span className="mb-1 block text-sm text-slate-300">{labels.newCodeLabel}</span>
              <input
                name="code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={10}
                placeholder={labels.codePlaceholder}
                className="w-full rounded border border-slate-500 bg-slate-950 px-3 py-2 font-mono tracking-widest text-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
              />
            </label>
            {errorText ? <p className="text-sm text-red-400">{errorText}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 hover:bg-slate-300 disabled:opacity-50"
            >
              {pending ? labels.resetting : labels.resetCode}
            </button>
          </>
        ) : null}
      </form>

      {state.status === "success" ? (
        <div ref={resultRef} className="rounded-lg border border-amber-500 bg-amber-50 p-6 text-slate-900">
          <p className="text-sm font-medium">
            {labels.successTemplate.replace(
              "{room}",
              ROOM_UPPER[state.room as keyof typeof ROOM_UPPER] ?? state.room,
            )}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="block rounded bg-white px-3 py-2 font-mono text-lg tracking-widest select-all">
              {state.code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              {copied ? labels.copied : labels.copy}
            </button>
          </div>
          <p className="mt-3 text-sm font-medium text-red-700">{labels.warning}</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = localePath(locale, "/admin");
            }}
            className="mt-4 text-sm text-slate-600 underline hover:text-slate-900"
          >
            {labels.resetAnother}
          </button>
        </div>
      ) : null}
      </div>
    </section>
  );
}
