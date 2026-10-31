# Proposal

## Why

The portal is English-only, but its tenants are in Taiwan and Traditional Chinese (`zh-TW`) should be the language they see by default. The UI also hard-codes US-style amounts and ISO dates, so even translated copy would still read as a foreign portal. Adding a real locale layer now keeps every screen, error message, redirect, and formatted value consistent before more tenant-facing pages are built.

## What Changes

- Add two supported locales, `zh-TW` (default) and `en`, selected by a URL prefix: `/{locale}/login`, `/{locale}/rooms/[room]`, `/{locale}/admin`, and `/{locale}/admin/login`.
- Redirect bare paths to the default locale (`/login` → `/zh-TW/login`) and preserve the path and query string. There is no `Accept-Language` negotiation: `zh-TW` is the default unless the URL explicitly selects `en`.
- Move the App Router tree under `app/[lang]/` so the root layout can set `<html lang>` correctly, localize metadata, and provide the dictionary to every page. Reject unsupported locale segments with a 404.
- Add a small link-based language switcher (`English` / `繁體中文`) on every page that points at the equivalent screen in the other locale. The URL remains the single source of truth; no locale cookie is added.
- Add typed dictionaries under `lib/i18n/` covering all portal copy: tenant sign-in, room dashboard, denial view, admin sign-in, admin reset (including success panel), logout, placeholder-data labels, bill statuses, validation errors, and page titles.
- Localize formatting for `zh-TW`: amounts in TWD via `Intl.NumberFormat` (`NT$` / locale-appropriate form) and placeholder dates via `Intl.DateTimeFormat` in UTC, so a date stored as `2026-11-01` does not shift by timezone.
- Keep rate limiting, bcrypt verification, session cookies, Redis usage, and access control unchanged. Only presentation, routing, and redirect targets change.
- Keep auth redirects inside the current locale: `/en/rooms/a` redirects to `/en/login`, `/zh-TW/admin` to `/zh-TW/admin/login`. Locale values that reach Server Actions are validated against the supported list so they cannot become an open redirect.
- Make Server Actions return stable error codes instead of English message strings; client forms map the code to the active dictionary.
- Update unit tests, the Playwright logout checks, and the HTTP logout script for locale-prefixed routes. Add coverage for dictionary completeness, locale routing, locale-preserving redirects, and localized formatting.

**Out of scope:** additional locales beyond `zh-TW` and `en`, browser-language negotiation, automatic geo-IP locale selection, a locale cookie or user preference storage, translating room letters/codes (they stay `A`–`E` and 10-character alphanumeric), Simplified Chinese, changes to currency data (the placeholder amounts stay the same numbers, now labelled as TWD), and changes to auth, rate limiting, Redis, or session semantics.

## Capabilities

### New Capabilities

- `localization`: locale-prefixed routing with `zh-TW` as the default, `en` as the alternate, translated interface copy, a language switcher, locale-preserving auth redirects, and locale-aware amount/date formatting.

### Modified Capabilities

- `session-logout`: logout destinations become locale-prefixed (`/{locale}/login` and `/{locale}/admin/login`) and must preserve the active locale instead of using the literal `/login` and `/admin/login` paths.

## Impact

- `app/layout.tsx` moves to `app/[lang]/layout.tsx`; `app/page.tsx`, `app/login/*`, `app/admin/*`, and `app/rooms/[room]/*` move under `app/[lang]/`. Tests importing those modules are updated.
- `app/login/actions.ts`, `app/admin/login/actions.ts`, `app/admin/actions.ts`, and `app/logout-actions.ts` become locale-aware for redirects and error codes.
- `app/login/login-state.ts`, `app/admin/login-state.ts`, `app/login/login-form.tsx`, `app/admin/login/admin-login-form.tsx`, and `app/admin/reset-form.tsx` switch from English literals to dictionary props and error-code mapping.
- `middleware.ts` gains locale normalization and locale-aware auth redirects; its matcher must cover locale-prefixed protected paths as well as bare paths.
- New `lib/i18n/` (locale list, default locale, typed dictionaries, `getDictionary`, `isLocale`, redirect helper) and formatting helpers used by `lib/placeholder-data.ts`.
- `lib/placeholder-data.ts` stores stable label keys and status values; the page dictionary supplies localized labels.
- `tests/*.test.ts` and `e2e/logout.spec.ts` change paths and assertions; `scripts/logout-e2e.mjs` follows the locale-prefixed forms.
- No new runtime dependencies: dictionaries are plain TypeScript modules and formatting uses the built-in `Intl` APIs. No environment-variable, Redis, or Vercel configuration changes.
- **Coordination:** this change touches every page file, so later page-level changes should be rebased after it. The existing `middleware` → `proxy.ts` deprecation warning is unchanged and not addressed here.
