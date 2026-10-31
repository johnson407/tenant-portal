# Design

## Context

See `proposal.md` - Why. Relevant current state:

- Next.js 16 App Router, TypeScript, Tailwind v4, no new dependencies.
- One httpOnly cookie, `tp_session` (`SESSION_COOKIE_NAME` in `lib/session.ts`), containing an HS256 JWT signed with `jose`: `{ role: "tenant", room, v, exp }` or `{ role: "admin", exp }`. Lifetime is `TENANT_SESSION_MAX_AGE_SECONDS` (7 days), `sameSite: "lax"`, `secure` in production, `path: "/"`.
- `lib/session-cookies.ts` already exports `clearSessionCookie()`, which sets `tp_session` to `""` with `maxAge: 0` and the same options used by `setSessionCookie()` (`httpOnly`, `sameSite: "lax"`, production `secure`, `path: "/"`). Nothing calls it yet.
- Existing Server Actions (`app/login/actions.ts`, `app/admin/login/actions.ts`, `app/admin/actions.ts`) are `"use server"` modules next to their pages and end in `redirect()`.
- `middleware.ts` matches `/rooms/:path*` and `/admin/:path*`, verifies the cookie on every matched request, and redirects unauthenticated or wrong-role requests.
- `/rooms/[room]/page.tsx` re-checks room match and the Redis session version; its denial view is rendered for wrong-room, stale-version, and anonymous requests.
- `/admin/page.tsx` re-checks the admin session and redirects to `/admin/login`.
- Both protected pages read cookies (`getSessionClaims()` / `isAdminSession()`), so they are request-time pages. `next.config.ts` enables `cacheComponents` and `partialPrefetching`; both pages set `export const instant = false`.
- Tests use vitest with `vi.mock` for `next/headers`, `next/navigation`, and library modules (`tests/login-action.test.ts`, `tests/admin-login-action.test.ts`, `tests/admin-reset-action.test.ts`, `tests/room-page.test.ts`).
- `scripts/` contains only `scripts/hash-codes.mjs`: a dependency-free Node ESM script. The dev-only Playwright setup (`playwright.config.ts`, `e2e/logout.spec.ts`) drives the browser checks for Back/reload, keyboard focus, and no-JavaScript submission.

The pending `improve-text-contrast` change edits `app/rooms/[room]/page.tsx` and `app/admin/page.tsx` too. This design assumes it lands first and reuses the final slate tokens for the new controls.

## Goals / Non-Goals

**Goals:**

- One server-side logout path that works for tenant and admin, always derives its destination from the verified session, and cannot be triggered by GET.
- Reuse the existing cookie-clearing helper so cookie attributes cannot drift from login.
- Buttons that are obvious, keyboard accessible, AA-contrast, and consistent with the existing slate palette.
- Prove the post-logout behavior with unit tests and a repeatable local E2E check.

**Non-Goals:**

- Revoking tokens server-side or logging out other devices. Logout deletes the browser cookie only; a copied token remains valid until `exp`.
- Bumping `room:<letter>:session-version` on logout. That would sign out every device of the room, which is the opposite of a single-browser logout.
- Touching rate-limit keys, room code hashes, session versions, cookie lifetime, claims, middleware redirect rules, or login behavior. (The only middleware change is the scoped `Cache-Control: no-store` header; the allow/redirect decisions stay exactly as they are.)
- Adding a `/logout` route, a route handler, a client component, or a new runtime dependency. `@playwright/test` is a dev-only dependency for the local browser checks.
- Any colour-palette change or deployment.

## Decisions

### 1. One shared `logoutAction()` in `app/logout-actions.ts`, with no parameters

`app/logout-actions.ts` is a `"use server"` module exporting exactly one action:

```ts
"use server";

import { redirect } from "next/navigation";
import { getSessionClaims, clearSessionCookie } from "@/lib/session-cookies";

export async function logoutAction(): Promise<void> {
  const claims = await getSessionClaims(); // verify BEFORE clearing
  await clearSessionCookie();
  if (claims?.role === "admin") redirect("/admin/login");
  redirect("/login");
}
```

- **Why one action:** the destination is a pure function of the verified role, so there is no reason to expose two entry points. A single action avoids duplicating logic and avoids a caller choosing the "wrong" action.
- **Why no parameters:** a zero-argument signature makes it impossible for form data, query strings, or bound arguments to influence the destination. TypeScript also enforces this. A direct POST to the action still goes through the same code.
- **Why read before clear:** `getSessionClaims()` reads the cookie; clearing first would always produce `null` and send admins to `/login`.
- **Alternative considered:** two thin exports (`tenantLogoutAction`, `adminLogoutAction`). Rejected because the page would have to choose based on client-visible context and the two paths would drift; the role is already available on the server.
- **Alternative considered:** a `/logout` Route Handler. Rejected: a GET handler creates link/prefetch logout and CSRF-by-link risk, and a POST handler duplicates what Server Actions already provide (POST-only plus Origin/Host validation).

### 2. Reuse `clearSessionCookie()` and only redirect to literal paths

`clearSessionCookie()` already centralizes the attributes. The action calls it and then redirects to one of two constants (`/login`, `/admin/login`) selected by `claims?.role === "admin"`. There is no `next`, `redirectTo`, or `role` input to validate, so no open-redirect surface exists.

- Expired/tampered/missing cookie → `getSessionClaims()` returns `null` → clear (harmless) → `/login`.
- A tenant whose room code was reset still has a cryptographically valid tenant claim, so logout sends that tenant to `/login`; it does not touch the session version.
- Failure mode: if `clearSessionCookie()` throws (for example, outside a mutable cookie context), the action fails instead of redirecting. That is correct - silently redirecting while leaving the cookie would falsely claim logout succeeded.

### 3. Plain server-rendered forms, no client component

Each placement uses `<form action={logoutAction}><button type="submit">Log out</button></form>`. The pages are Server Components, so the action is passed directly without `useActionState`. A submit button with a plain text label is the accessible name; no icon, no `aria-label` workaround.

Next.js Server Actions are invoked with POST only and compare `Origin` with `Host`/`X-Forwarded-Host`, per the bundled Next 16 data-security guide; combined with `sameSite: "lax"` cookies this covers CSRF for the logout form. React's progressive enhancement means the form submits and follows the redirect even before hydration, so no client component is required.

Placement and markup:

- **Authorized `/rooms/[room]` header:** keep the existing h1 and amber badge; wrap the badge and form in a right-hand `div` and allow the header to wrap on narrow screens (`flex flex-wrap items-center justify-between gap-3`). Do not change the badge text or the page content.
- **`/rooms/[room]` denial view:** render the form only when `claims?.role === "tenant"`. This covers the "tenant of room A opened `/rooms/b`" case and also a tenant whose version is stale. Anonymous visitors get no button. The button can sit under the existing "Back to your dashboard" link in the centered column.
- **`/admin`:** wrap the h1 and form in a `header` with `flex items-center justify-between gap-4`; the paragraph and reset form stay below.

Styling (Tailwind utilities, no new tokens):

- **Light room header:** `text-slate-900` on `bg-white`, `border-slate-500` (4.76:1 on white, 4.34:1 on slate-100), hover `bg-slate-200`, `focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100` (slate-700 on slate-100 is 9.45:1). Text is 17.85:1. This deliberately differs from the dark shell's slate-300 ring, which would only be 1.48:1 on the light page.
- **Dark room denial view and `/admin`:** `text-slate-100` on slate-950 (18.41:1), `border-slate-500` (4.24:1 on slate-950), hover `bg-slate-800`, `focus-visible:ring-2 focus-visible:ring-slate-300` (13.59:1 on slate-950), matching `improve-text-contrast`'s dark-shell focus treatment.
- Buttons are `type="submit"`, use the default browser button semantics, and are reachable in normal tab order. No layout dimensions are hard-coded; padding matches the existing small controls.

### 4. Add an explicit `Cache-Control: no-store` header in middleware

Both protected pages already read the session cookie and therefore render at request time; with Cache Components they cannot be baked into a cacheable static response for a signed-in user. Next.js documents that dynamically rendered pages are sent with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (bundled `self-hosting.md`). However, the requirement also covers the browser Back button and the middleware redirects themselves, so the guarantee is made explicit at the one place every `/rooms/*` and `/admin/*` request passes through: `middleware.ts` sets `Cache-Control: no-store` on both `NextResponse.next()` (allowed) and `NextResponse.redirect()` (denied) responses.

The header is scoped by the existing matcher (`/rooms/:path*`, `/admin/:path*`), so login pages outside those paths and static assets are unaffected. This is a small, testable defense in depth: Next would ordinarily send no-store for a dynamic page, but a redirect or a future refactor that removes the cookie read must not silently become cacheable. Middleware still re-verifies the cookie on every request, so a post-logout navigation or reload is redirected before the page renders.

- **Alternative considered:** rely only on Next's dynamic page header. Rejected because the requirement explicitly includes Back/reload and because middleware redirects are outside the page response; an explicit scoped header makes both paths verifiable in `tests/middleware.test.ts`.
- **Alternative considered:** set the header in each page or in `next.config.ts`. Rejected because it would duplicate the rule for two pages and could affect unrelated routes; middleware already owns the protected-path boundary.

Verification pins this: `tests/middleware.test.ts` must see `cache-control: no-store` on an allowed tenant request, an anonymous redirect, a tampered-cookie redirect, and an allowed admin request; `curl -i` must confirm the same on a running build; and a browser Back/reload after logout must land on the sign-in page.

### 5. Unit test through the real cookie/verification layer

`tests/logout-action.test.ts` will mock only `next/headers` and `next/navigation` (the existing style), then use real `lib/session-cookies.ts` and `lib/session.ts` with `SESSION_SECRET` stubbed:

- tenant token → `Set-Cookie` clears `tp_session` and `redirect("/login")`;
- admin token → `redirect("/admin/login")`;
- no cookie → still clears and `redirect("/login")`;
- tampered/expired token → `redirect("/login")`;
- the cookie clear happens before the redirect is thrown;
- `logoutAction.length === 0` and a source assertion that the module contains no `formData`, `searchParams`, or `next=` handling and no imports of rate-limit, code-store, or session-version modules.

`tests/room-page.test.ts` already mocks `@/lib/session-cookies`; it will also mock `@/app/logout-actions` so the Server Action does not need Next's compiler during `renderToStaticMarkup`. New assertions: authorized view shows "Log out"; a tenant opening another room's denial view shows "Log out"; an anonymous denial view does not.

`tests/middleware.test.ts` already proves missing/invalid cookies redirect; no middleware change is planned. A post-logout redirect is the same missing-cookie path.

### 6. Local E2E via progressive-enhancement form posts

`scripts/logout-e2e.mjs` follows the `hash-codes.mjs` style: plain Node ESM, no new dependencies, environment-driven. It starts from `BASE_URL` (default `http://localhost:3000`), `ROOM_CODE_A`, `ROOM_CODE_B`, optionally `ADMIN_PASSWORD`, and assumes the server has its normal `SESSION_SECRET`/Redis configuration. It keeps a cookie jar, fetches `/login` and `/admin/login`, extracts the rendered `$ACTION_ID_*` hidden field and posts `multipart/form-data` to the page URL with the room/code or password, follows redirects manually, then:

1. verifies room A reaches `/rooms/a` and sees "Log out";
2. posts the logout form from `/rooms/a`, checks the clearing `Set-Cookie` and `/login` redirect;
3. confirms `/rooms/a` and `/admin` now redirect to `/login` and `/admin/login`;
4. signs in room B, sees room B data only, and confirms `/rooms/a` shows the denial view (not room A data);
5. signs in as admin, logs out, confirms `/admin` redirects;
6. confirms `GET /logout` is 404 and does not clear the cookie.

If the progressive-enhancement form encoding changes, the script fails loudly with the URL and status instead of silently passing. This is a local check, not a committed CI requirement.

### 7. Dev-only Playwright browser checks

`playwright.config.ts` and `e2e/logout.spec.ts` add browser coverage at the user's request; the action and UI do not depend on them. The suite logs in through the real forms and covers:

- logout, then Back and reload land on the sign-in page with no protected data, and protected responses carry `no-store`;
- Tab reaches each Log out button with a visible focus ring, and Enter submits from the room, denial, and admin views;
- with JavaScript disabled, the room, denial, and admin forms submit and clear the session.

`@playwright/test` is a dev-only dependency. The tests target a running server via `BASE_URL` and reuse `ROOM_CODE_A` / `ADMIN_PASSWORD`, consistent with `scripts/logout-e2e.mjs`. They are not part of `npm test` and do not ship in the production bundle.

## Risks / Trade-offs

- **Stateless JWT limitation (accepted):** logout removes only the browser's copy. A token copied before logout, or a session on another device, remains valid until `exp` (up to 7 days). Server-side revocation would require a token denylist or per-session identifier; that is a future change. Bumping the room session version is explicitly rejected because it would log out every device of the room.
- **Back/forward cache:** the explicit `Cache-Control: no-store` on both allowed and redirect responses prevents HTTP caching of protected HTML. A browser may still restore a bfcache snapshot in some versions; the verification task includes a real Back check, and the middleware header is the strongest server-side control available for this requirement.
- **Two changes touch the same pages:** `improve-text-contrast` also edits `app/rooms/[room]/page.tsx` and `app/admin/page.tsx`. Apply contrast first, then this change; the only overlaps are class strings, and the new buttons use the final slate tokens.
- **Button in the room header may crowd the badge on small screens:** the header is allowed to wrap and the badge keeps its text; no content is hidden.
- **E2E script depends on Next's rendered action ID:** it is intentionally a local diagnostic, not part of `npm test`; unit tests cover the behavior deterministically.
- **Playwright needs OS browser libraries:** install once with `npx playwright install --with-deps chromium` on a machine with package-manager permissions; the browser suite is also a local diagnostic, not part of `npm test`.
- **No visible "signed out" confirmation:** the redirect to the login page is the confirmation, consistent with the rest of the app. No toast or extra route is added.

## Migration Plan

No data, schema, cookie, or environment migration. Deploy only when Johnson approves; rollback is reverting this change (the existing login and middleware behavior is untouched). Because logout is opt-in UI plus one action, there is no period where existing sessions become invalid.

## Open Questions

None.
