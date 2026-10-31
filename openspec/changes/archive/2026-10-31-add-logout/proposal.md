# Proposal

## Why

The portal has no way to sign out. A tenant who shares a device, or Johnson (admin) on a shared computer, cannot end the session, and a tenant of room A must wait for the 7-day cookie to expire or clear cookies by hand before a tenant of room B can sign in on the same browser.

## What Changes

- Add a POST-only Server Action `logoutAction()` in `app/logout-actions.ts`. It reads the current session claims server-side, calls the existing `clearSessionCookie()` in `lib/session-cookies.ts`, then redirects: tenant → `/login`, admin → `/admin/login`, no valid session → `/login`. The destination is derived from the validated session only and never from form data, so a crafted form cannot turn logout into an open redirect.
- Add a visible, keyboard-focusable **Log out** control (plain text label, no icon-only button) as `<form action={logoutAction}>` with a `<button type="submit">`. No client component is required; the form posts the Server Action and works without client-side JavaScript for the submit itself.
- Render the control in three places:
  - `/rooms/[room]` authorized header, beside the amber "Placeholder data" badge, without breaking the existing layout.
  - `/rooms/[room]` "Not authorized" view when a valid tenant session exists (for example, a room A tenant opening `/rooms/b`), so that tenant can switch rooms. It is not rendered when there is no session.
  - `/admin` at the top, right-aligned next to the "Room access codes" heading.
- Style the control with the existing slate palette and WCAG 2.1 AA contrast: 4.5:1 text, 3:1 boundary and focus indicator, plus a visible focus ring. On the light room view use slate-900 text on white with a slate-500 border and slate-700 focus ring; on the dark views use slate-100 text with a slate-500 border and the same slate-300 focus ring introduced by `improve-text-contrast`.
- Set `Cache-Control: no-store` on both allowed and redirect responses from the existing `/rooms/:path*` and `/admin/:path*` middleware matcher, so protected HTML is not served from cache after logout, including the browser Back path.
- Introduce a new `session-logout` capability covering cookie removal, both role-specific destinations, no-session behavior, cross-room switching, post-logout protection, and POST-only/no-GET behavior.
- Add a vitest unit test for the action, extend the existing room-page and middleware tests, and add an admin-page test so all three render sites and the post-logout redirects are covered.

**Out of scope:** server-side token revocation, "log out all devices", idle/sliding timeouts, changing the cookie lifetime or claims, any colour-palette change, and any new route besides the Server Action (specifically no `GET /logout`). Logout is intentionally local to the browser cookie: since sessions are stateless JWTs, a copied token or another device's token stays valid until `exp`. Bumping the Redis room session version would sign out every device of that room, so this change does not do it; server-side revocation is a possible future change.

## Capabilities

### New Capabilities

- `session-logout`: clears the browser session cookie through a POST-only Server Action and returns the user to the correct login page, with no server-side revocation.

### Modified Capabilities

(none — this change adds a new capability only. `tenant-auth` and `admin-reset` are related but unchanged: they still define how the `tp_session` cookie is issued and how room/admin access is guarded. `room-dashboard` is unchanged.)

## Impact

- `app/logout-actions.ts` (new): `"use server"` module exporting `logoutAction()`.
- `app/rooms/[room]/page.tsx`: Log out form in the authorized header and in the "Not authorized" view when a tenant session exists.
- `app/admin/page.tsx`: Log out form in a top header next to the heading.
- `middleware.ts`: add `Cache-Control: no-store` to the allowed and redirect responses for the two protected matchers; the redirect rules themselves do not change.
- `tests/logout-action.test.ts` (new), `tests/admin-page.test.ts` (new), and `tests/room-page.test.ts` / `tests/middleware.test.ts` (extend assertions).
- `scripts/logout-e2e.mjs` (new): repeatable curl-style end-to-end check against a running local server.
- `e2e/logout.spec.ts` and `playwright.config.ts` (new): dev-only Playwright browser checks for Back/reload, keyboard focus, and no-JavaScript submission.
- Reused unchanged: `lib/session-cookies.ts` (`clearSessionCookie()`), `lib/session.ts`, and the existing login actions.
- **Related but unchanged:** `tenant-auth` (session cookie issuance and tenant access) and `admin-reset` (admin authentication and room-code reset) keep their current behaviour and specs.
- **Coordination:** the pending `improve-text-contrast` change edits the same page files, `app/rooms/[room]/page.tsx` and `app/admin/page.tsx`. Apply contrast first (or resolve the small class-only differences); this change uses the same slate tokens so the merge is mechanical.
- No new runtime dependencies. `@playwright/test` is a dev-only dependency used to drive the local browser checks.
