<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tenant Portal

Next.js 16 App Router app: rooms A–E sign in with a 10-character code and see placeholder bills, payments, and lease dates; an admin resets room codes. The UI is locale-prefixed (`zh-TW` by default, `en` optional). No database and no tenant PII.

## Commands

- `npm run dev` — Turbopack dev server. `next dev` re-adds the managed block above; keep it.
- `npm run dev:kv` — in-memory Upstash-compatible KV for local previews (`127.0.0.1:8081`, override with `LOCAL_KV_PORT`). Dev only: no auth, no persistence. Point `KV_REST_API_URL` at it and set any non-empty `KV_REST_API_TOKEN`.
- `npm test` — Vitest. Only `tests/**/*.test.ts` runs; Playwright is excluded.
- Single test: `npx vitest run tests/login-action.test.ts`, optionally with `-t "name"`.
- Typecheck: `npx tsc --noEmit`. There is no lint script; `npm run build` also runs TypeScript.
- `npm run build` — production build; `npm start` serves it.
- `npm run test:e2e` — Playwright checks in `e2e/`. Requires a running server plus `BASE_URL`, `ROOM_CODE_A`, and `ADMIN_PASSWORD`. Install browsers with `npx playwright install --with-deps chromium`. Not part of `npm test`.
- `node scripts/logout-e2e.mjs` — HTTP logout check; requires a running server, Redis, room codes, and `ADMIN_PASSWORD`.
- No CI workflows exist; verify locally with `npm test` and `npm run build`.

## Environment

- Copy `.env.example` to `.env.local`. Required: `SESSION_SECRET`, `ADMIN_PASSWORD`, `ROOM_CODE_HASH_A`…`E`, and `KV_REST_API_URL`/`KV_REST_API_TOKEN`.
- Escape `$` as `\$` in `.env` values: Next.js expands `$NAME`, which otherwise mangles bcrypt hashes like `$2b$12$…`.
- Upstash Redis is required at runtime. Room login, bcrypt code storage, per-room session versions, and rate limits all fail closed without it; unit tests mock it. For local previews without an Upstash account, run `npm run dev:kv` and set `KV_REST_API_URL=http://127.0.0.1:8081` plus any non-empty `KV_REST_API_TOKEN`.
- Plaintext room codes must never be committed. Generate hashes with `node scripts/hash-codes.mjs --code-into=a`.
- Vercel injects `KV_REST_*` in production; do not assume a local Redis there.

## Architecture

- Every page lives under `app/[lang]/`, with `zh-TW` (default) and `en` selected by the first URL segment. Typed dictionaries, locale helpers, and `Intl` formatting are in `lib/i18n/`; set page copy from the dictionary rather than hard-coding English.
- Bare paths redirect to the default locale (for example `/login` → `/zh-TW/login`). Auth redirects stay in the active locale (`/{locale}/login`, `/{locale}/admin/login`), and locale values received by Server Actions are validated with `isLocale()` before being used as a path prefix.
- Auth is a stateless HS256 JWT in the `tp_session` cookie (`lib/session.ts`), valid for 7 days with `httpOnly`/`SameSite=Lax`. Cookie helpers live in `lib/session-cookies.ts`.
- `proxy.ts` normalizes the locale and guards `/{locale}/rooms/*` and `/{locale}/admin/*`, and pages re-check: room match plus Redis session version for tenants, `isAdminSession()` for admin. Admin auth compares the shared `ADMIN_PASSWORD` env value; there are no user accounts.
- An admin code reset bumps `room:<letter>:session-version`, invalidating that room's existing sessions. Logout deliberately does not bump it; logout is browser-local.
- Redis also holds rate-limit counters with escalating lockouts. If Redis is unavailable, fail with a generic error rather than bypassing the check.
- Server Actions live in `app/**/actions.ts` and are POST-only. Forms needing pending/error state use client components with `useActionState`; logout uses plain server-rendered forms.
- Placeholder dashboard data is in `lib/placeholder-data.ts`. Never add tenant names, phone numbers, emails, or plaintext codes anywhere.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`; protected pages set `export const instant = false`.

## Testing

- Vitest runs in a node environment with the `@` alias mapped to the repo root, and includes only `tests/**/*.test.ts`.
- Follow the existing pattern: `vi.hoisted` plus `vi.mock` for `next/headers`, `next/navigation`, and lib modules; see `tests/login-action.test.ts`. Page tests pass `params` with the locale, for example `Promise.resolve({ lang: "zh-TW", room: "a" })`.
- Browser/HTTP checks are local-only and separate: `e2e/logout.spec.ts` and `scripts/logout-e2e.mjs`. They need real Redis and env values and are not part of `npm test`.
- If Playwright cannot install system libraries without sudo, extract `libnspr4`, `libnss3`, and `libasound2t64` locally and run with `LD_LIBRARY_PATH` set.

## OpenSpec

- This repo uses OpenSpec. Active changes live in `openspec/changes/<name>/` (`proposal.md`, `specs/`, `design.md`, `tasks.md`); current specs in `openspec/specs/<capability>/spec.md`; archives in `openspec/changes/archive/YYYY-MM-DD-<name>/`.
- Before implementing, run `openspec list --json` and `openspec instructions apply --change <name> --json`. Tasks are tracked by `- [ ]` checkboxes; mark `- [x]` only when verified.
- Do not hand-edit main specs. Use the sync/archive workflows; a change's proposal/design/tasks are the source of truth. Run `openspec validate <name> --strict` before archiving.
- OpenCode commands and skills are in `.opencode/commands/opsx-*.md` and `.opencode/skills/openspec-*`.
