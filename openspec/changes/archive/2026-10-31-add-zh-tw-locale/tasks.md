# Tasks

## 1. Locale foundation

- [x] 1.1 Create `lib/i18n/config.ts` with `LOCALES` (`zh-TW`, `en`), `DEFAULT_LOCALE = "zh-TW"`, the `Locale` type, `isLocale()`, and `localePath()`. Verify with `tests/i18n-config.test.ts` covering both valid locales, invalid/empty values, and path joining with and without a leading slash.
- [x] 1.2 Define the shared `Dictionary` type in `lib/i18n/types.ts`, add `lib/i18n/dictionaries/en.ts` and `lib/i18n/dictionaries/zh-TW.ts`, and expose `getDictionary()` from a static map. Verify with a dictionary parity test that recursively compares key paths in both locales and with `npx tsc --noEmit`.
- [x] 1.3 Add `formatTwd(cents, locale)` and `formatDate(iso, locale)` (UTC-parsed, `dateStyle: "medium"`) in `lib/i18n/format.ts`. Verify with tests asserting `NT$750.00` and `Nov 1, 2026` in `en`, `2026年11月1日` in `zh-TW`, and that `2026-11-01` never renders as October 31.

## 2. Locale-prefixed App Router tree

- [x] 2.1 Move `app/layout.tsx`, `app/page.tsx`, `app/login/*`, `app/admin/*`, `app/rooms/[room]/*`, and `app/logout-actions.ts` under `app/[lang]/`, remove the old root layout, and update every relative import. Verify with `npx tsc --noEmit` and `npm run build`, confirming the route table contains `/[lang]`, `/[lang]/login`, `/[lang]/rooms/[room]`, `/[lang]/admin`, and `/[lang]/admin/login`.
- [x] 2.2 Make `app/[lang]/layout.tsx` the root layout: read and validate `lang`, set `<html lang={locale}>`, localize default metadata/title template with `generateMetadata`, add `generateStaticParams` for both locales, and add the system CJK font fallback stack in `app/globals.css`. Verify with a layout/metadata test that both locales produce the correct `lang` and title, plus `npm run build`.
- [x] 2.3 In every page, resolve `lang` from params and call `notFound()` for unsupported values before reading the dictionary or session. Verify with page tests for an unsupported locale and with middleware/app checks that `/zh-CN/login` ends in a 404.
- [x] 2.4 Update `AGENTS.md` (Architecture/Testing route references) and `README.md` to describe locale-prefixed routes, the `zh-TW` default, and the dictionary location. Verify the documented paths match the tree produced in 2.1.

## 3. Middleware locale routing and guards

- [x] 3.1 Extend `middleware.ts` to redirect bare paths to the default locale while preserving path and query, keep `zh-TW`/`en` prefixes intact, and broaden `config.matcher` to app routes while excluding `_next`, `favicon.ico`, and dotted asset paths. Verify with `tests/middleware.test.ts` cases for `/login`, `/rooms/a?from=email`, `/`, explicit `/en/login`, and an untouched static asset path.
- [x] 3.2 Apply the existing tenant/admin guards to the locale-relative path and redirect to `/{locale}/login` or `/{locale}/admin/login`, retaining `Cache-Control: no-store` on protected responses. Verify with middleware tests for `/en/rooms/a`, `/zh-TW/admin`, `/en/admin/login`, valid sessions in both locales, and tampered cookies.

## 4. Localized pages, switcher, and dashboard formatting

- [x] 4.1 Add `app/[lang]/locale-switcher.tsx`, a server-rendered link to the equivalent path in the other locale, and render it on tenant sign-in, room dashboard, denial view, admin sign-in, and admin page. Verify with page tests asserting `/zh-TW/login` links to `/en/login` and `/en/rooms/b` links to `/zh-TW/rooms/b`, and that the link has no client-JavaScript dependency.
- [x] 4.2 Localize `app/[lang]/login/page.tsx` and `login-form.tsx` from the dictionary, including heading, room options, access-code label/placeholder, pending label, submit button, admin link, and localized page title. Verify with tests rendering both locales and asserting no English copy remains in the `zh-TW` output.
- [x] 4.3 Refactor `lib/placeholder-data.ts` to stable label keys and statuses, then localize `app/[lang]/rooms/[room]/page.tsx` headings, badges, rows, lease labels, and logout label; use `formatTwd` and `formatDate`. Verify with room-page tests in both locales, including `NT$750.00` / `2026年11月1日`, and confirm no tenant personal data is introduced.
- [x] 4.4 Localize the denial view, `app/[lang]/admin/page.tsx`, `admin/login/page.tsx`, `admin-login-form.tsx`, and `reset-form.tsx` (idle, error, success, copy, and reset-another states). Verify with updated admin/login page tests in both locales and a success-panel test asserting localized confirmation and warning text.

## 5. Locale-aware Server Actions

- [x] 5.1 Bind the server-rendered locale to `loginAction`, validate it with `isLocale` and fall back to `DEFAULT_LOCALE`, return the `invalid-credentials` code instead of prose, and redirect success to `/{locale}/rooms/{room}`. Verify with `tests/login-action.test.ts` cases for both locales, a tampered locale, the error code, and the redirect target.
- [x] 5.2 Do the same for `adminLoginAction` and `resetRoomCodeAction`: bound/validated locale, code-based errors (`access-denied`, `invalid-room`), and locale-preserving success/failure paths. Verify with updated action tests for both locales and crafted locale values.
- [x] 5.3 Update `logoutAction` to accept a validated locale, redirect tenants to `/{locale}/login` and admins to `/{locale}/admin/login`, and fall back to `zh-TW` for invalid locale input. Verify with `tests/logout-action.test.ts` for both roles, no-session requests, and values such as `https://evil.example` or `//evil.example` staying on local paths.

## 6. End-to-end integration

- [x] 6.1 Update `e2e/logout.spec.ts` and `scripts/logout-e2e.mjs` to use `/{locale}/...` routes, keep the English assertions on `/en/...`, and add one `zh-TW` default-locale smoke path. Verify with `npx playwright test --list` and, when the required env/server is available, `npm run test:e2e` and `node scripts/logout-e2e.mjs`.
- [x] 6.2 Run the full local gate: `npx tsc --noEmit`, `npm test`, `npm run build`, and `openspec validate add-zh-tw-locale --strict`. Manually confirm `/` → `/zh-TW`, `/login` → `/zh-TW/login`, `/en/rooms/a` denies to `/en/login`, and both locale switchers round-trip on a protected page.

## Workflow follow-up

- Archive the change after review and after the verification tasks above pass.
- Run `openspec validate add-zh-tw-locale --strict` again before archiving.
