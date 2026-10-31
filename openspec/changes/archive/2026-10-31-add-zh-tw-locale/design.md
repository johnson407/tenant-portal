# Design

## Context

See `proposal.md` for motivation and `specs/localization/spec.md` for the behavior contract. The app is a Next.js 16 App Router project with every page at the repository root under `app/`, a single root layout in `app/layout.tsx`, Server Actions colocated with pages, and `middleware.ts` guarding `/rooms/*` and `/admin/*`. User-facing strings are inline English literals in server pages and client form components. Placeholder data stores English labels and ISO date strings; `formatAmount` renders `$<amount>` with no locale.

The relevant framework constraint is that the root layout must be the topmost layout and must render `<html lang>`. The Next.js internationalization guide places it at `app/[lang]/layout.tsx` and reserves the first path segment for the locale. Client Components cannot use `next/root-params`, so a locale resolved from root params is available to Server Components and server-side utilities but not to the client forms.

## Goals / Non-Goals

**Goals:**

- One predictable locale source: the first URL segment. No cookies, no `Accept-Language` negotiation, no hidden global state.
- Typed, compile-checked dictionaries so a missing translation is caught before runtime.
- Locale-correct redirects from middleware, pages, and Server Actions, including after login and logout.
- Correct `html lang`, metadata, currency, and dates in both locales.
- Old bare URLs continue to work through redirects.

**Non-Goals:**

- Adding an i18n library, locale negotiation, or a locale-preference cookie.
- Translating room letters, access codes, or stored data.
- Changing authentication, rates, Redis keys, or session semantics.
- Migrating `middleware.ts` to `proxy.ts`; that deprecation remains separate.

## Decisions

### Locale config and dictionaries

Create `lib/i18n/config.ts` with `LOCALES = ["zh-TW", "en"] as const`, `DEFAULT_LOCALE = "zh-TW"`, `isLocale(value): value is Locale`, and `localePath(locale, path)` that returns `/${locale}${path.startsWith("/") ? path : `/${path}`}`. Both dictionaries implement a shared `Dictionary` type from `lib/i18n/types.ts`, and `getDictionary(locale)` returns from a static map. Static imports keep dictionaries synchronous and usable in Server Components without an async boundary; they are small enough that lazy loading adds complexity without benefit.

The dictionary is grouped by screen (`common`, `login`, `room`, `denied`, `adminLogin`, `adminReset`, `logout`, `meta`, `format`) with nested plain objects. Both files are annotated with the same type, so a missing or extra key fails `tsc`. Client forms receive only the slices they need as serializable props.

Alternative considered: `next-intl` or a JSON dictionary loader. Rejected because the app has four screens and no pluralization or interpolation needs; a dependency would add configuration and client runtime for no observable benefit.

### Route structure

Move the tree to:

```
app/[lang]/layout.tsx
app/[lang]/page.tsx
app/[lang]/locale-switcher.tsx
app/[lang]/login/{page,actions,login-form,login-state}.tsx
app/[lang]/rooms/[room]/page.tsx
app/[lang]/admin/{page,actions,reset-form}.tsx
app/[lang]/admin/login/{page,actions,admin-login-form}.tsx
app/[lang]/logout-actions.ts
```

The old `app/layout.tsx` is removed rather than kept as a wrapper, because it would become the root layout and prevent `[lang]/layout.tsx` from owning `<html>`. Every page validates `isLocale(lang)` and calls `notFound()` otherwise. `generateStaticParams` in the layout returns both locales, although session reads still make protected pages dynamic; the existing `export const instant = false` stays on protected pages, and the localized layout may need it to avoid partial prefetch of session-dependent content.

The layout reads the locale, chooses the dictionary, sets `<html lang={locale}>`, and uses `generateMetadata` for a localized default title, description, and title template. Page-level `generateMetadata` functions return localized titles from the same dictionary.

Alternative considered: keeping pages at bare paths and storing the locale in a cookie. Rejected because it makes links unshareable, breaks `html lang` on first paint, and adds state that must be synchronized across tabs.

### Middleware normalization and guarding

Extend `middleware.ts` instead of introducing a second routing layer:

1. Parse the first path segment.
2. If it is a supported locale, continue with that locale and the remaining path.
3. If not, redirect to `/${DEFAULT_LOCALE}${pathname}${search}`. This makes `/login`, `/rooms/a`, and `/` work unchanged.
4. Apply the existing room/admin guards to the remaining path and redirect to `/${locale}/login` or `/${locale}/admin/login`.
5. Set `Cache-Control: no-store` on allowed and redirect responses for protected routes, as today.

The matcher becomes broad enough to see bare and prefixed app routes while excluding framework assets, for example `["/((?!_next|favicon.ico|.*\\..*).*)"]`. Unsupported locale-like segments such as `/fr/login` are treated as bare paths and redirect to `/zh-TW/fr/login`, which has no route and returns 404; no special locale-detection heuristic is added.

Alternative considered: a separate `proxy.ts` for locale routing and middleware for auth. Rejected because two files would need to agree on locale parsing and redirect order, and the project already has one guard file with tests.

### Language switcher

`app/[lang]/locale-switcher.tsx` is a Server Component that receives `locale` and the page's locale-relative `path` (for example `/login` or `/rooms/a`) and renders a normal `next/link` to `localePath(otherLocale, path)`. Links are server-rendered, so they work without client JavaScript and are keyboard reachable. Each page passes its own path; no request-header plumbing or `usePathname` client boundary is needed. The switcher is rendered on the tenant sign-in page, the room dashboard, the denial view, the admin sign-in page, and the admin page. Switching locales does not change the session; the destination page re-runs its normal auth check.

### Server Actions and localized errors

Actions must not read the locale from `headers()` or trust arbitrary form data. Each form binds the server-rendered locale to the action (`loginAction.bind(null, locale)`, `logoutAction.bind(null, locale)`, and the equivalent for admin actions), and the action validates it with `isLocale`, falling back to `DEFAULT_LOCALE`. A locale is only ever used with `localePath`, so even a tampered value cannot produce an external redirect.

Actions return stable codes, not prose:

- `LoginState = { error?: "invalid-credentials" }`
- `AdminLoginState = { error?: "access-denied" }`
- `AdminResetState` error message becomes a code such as `"access-denied" | "invalid-room"`

The client form maps the code through the dictionary slice it received. This keeps the generic-error security property (no distinction between wrong room and wrong code) while localizing the single message.

### Formatting

Add locale-aware helpers used by the dashboard page and tests:

- `formatTwd(cents, locale)` → `new Intl.NumberFormat(locale, { style: "currency", currency: "TWD" }).format(cents / 100)`. In `en` this yields `NT$750.00`; in `zh-TW` the locale's conventional TWD form. No manual string concatenation of `$`.
- `formatDate(iso, locale)` → parse `YYYY-MM-DD` as `new Date(`${iso}T00:00:00Z`)` and format with `{ dateStyle: "medium", timeZone: "UTC" }`, producing `2026年11月1日` in `zh-TW` and `Nov 1, 2026` in `en`.

`lib/placeholder-data.ts` stops storing English labels. Bills use `labelKey: "rentCurrentMonth" | "utilities"` and a `status` of `"open" | "paid"`; payments use `labelKey: "rentPreviousMonth"`. The page maps keys through the dictionary. Amounts and ISO dates remain the data source so formatting is presentation-only.

Alternative considered: storing translated labels in the placeholder data per locale. Rejected because it duplicates data, couples data to locales, and makes future non-placeholder data harder to introduce.

### CJK typography

Keep the existing Geist Latin fonts and add a system CJK fallback stack (for example `"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif`) in the Tailwind theme/CSS. No CJK web font is downloaded, avoiding a multi-megabyte payload; rendering depends on the OS font, which is acceptable for this portal. The layout still declares the correct `lang` so browsers and assistive technology choose appropriate glyph forms and pronunciation.

### Tests

- Update imports and page calls for the `[lang]` tree; page tests pass `{ lang, room }` params.
- Add dictionary tests that assert both locales expose the same key structure and that key screens contain no untranslated fallback.
- Extend middleware tests: bare path redirect to `/zh-TW`, query preservation, `en` guard redirects, locale-prefixed protected responses still `no-store`, static assets untouched.
- Add formatting tests for TWD and UTC dates in both locales, including a `2026-11-01` non-shift assertion.
- Update action tests for bound locale arguments, validated fallback, error codes, and locale-prefixed redirect targets.
- Keep Playwright and the HTTP script focused on `/en/...` so their existing English-role assertions remain meaningful, and add one `zh-TW` smoke path to prove the default locale works end to end.

## Risks / Trade-offs

- **Old links and bookmarks break** if redirects are incomplete → bare-path normalization runs before auth, preserves path and query, and is covered by middleware tests plus a manual check of `/`, `/login`, `/rooms/a`, and `/admin`.
- **A broad middleware matcher can intercept assets or framework routes** → exclude `_next`, `favicon.ico`, and dotted paths, then verify with the build plus e2e asset loading.
- **Locale can be tampered with in a bound action** → validate with `isLocale`, fall back to `zh-TW`, and never use the submitted value as a full URL.
- **Client and server `Intl` output can differ with ICU versions** → use a fixed Node runtime in deployment, keep assertions on stable examples, and avoid asserting every separator/space.
- **CJK glyph quality varies by OS** → system font stack plus correct `lang`; a bundled Noto Sans TC can be added later without changing specs.
- **Moving every page creates a large diff and path churn in tests** → move files first, update imports, then localize copy screen by screen; run `npx tsc --noEmit` and `npm test` between steps.
- **`cacheComponents` and dynamic locale params can produce build-time warnings or prerender surprises** → keep protected pages `instant = false`, run `npm run build`, and inspect the route table for both locales.
- **Middleware deprecation warning persists** → explicitly out of scope; migrating to `proxy.ts` is a separate change so this one stays reviewable.

## Migration Plan

1. Add locale config, dictionaries, and formatting helpers with unit tests.
2. Move the App Router tree under `app/[lang]`, update imports and redirect targets, and keep behavior otherwise unchanged.
3. Add middleware locale normalization and locale-aware auth redirects.
4. Localize pages and client forms, and switch actions to error codes.
5. Update tests, e2e, and the logout script; run `npx tsc --noEmit`, `npm test`, and `npm run build`.
6. Deploy in one release. No data or environment migration is needed. Bare URLs redirect to `zh-TW`, so rollback is a normal code revert; any browser that bookmarked a `/{locale}/...` URL after deploy will see a 404 after rollback, which is acceptable for a short-lived rollback.

## Open Questions

None. The default locale, alternate locale, URL strategy, and formatting behavior were confirmed before planning.
