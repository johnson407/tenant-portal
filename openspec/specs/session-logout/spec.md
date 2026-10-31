# session-logout Specification

## Purpose

Lets a tenant or the admin end the current browser session by clearing the shared session cookie and returning to the appropriate sign-in page, without server-side revocation.

## Requirements

### Requirement: Logout control on protected pages

The system SHALL present a visible "Log out" submit control on the authorized `/rooms/[room]` header, on the `/rooms/[room]` denial view when a valid tenant session exists, and at the top of `/admin` for an admin session. It SHALL use a plain text label, be keyboard focusable with a visible focus indicator, and work as a normal form submission without client-side JavaScript.

#### Scenario: Authorized tenant sees Log out

- **WHEN** a tenant with a current session opens their own `/rooms/<letter>` dashboard
- **THEN** the header shows a "Log out" button beside the placeholder-data badge

#### Scenario: Tenant on another room's denial view sees Log out

- **WHEN** the tenant of room A opens `/rooms/b`
- **THEN** the "Not authorized" view shows a "Log out" button so the tenant can switch rooms

#### Scenario: Anonymous denial view has no Log out

- **WHEN** a visitor with no valid session opens `/rooms/<letter>`
- **THEN** the "Not authorized" view is shown without a "Log out" button

#### Scenario: Admin sees Log out

- **WHEN** an admin with a current session opens `/admin`
- **THEN** the page shows a "Log out" button at the top, right-aligned next to the "Room access codes" heading

#### Scenario: Keyboard and no-JavaScript operation

- **WHEN** the Log out button is reached by keyboard, or client-side JavaScript is unavailable
- **THEN** it shows a visible focus indicator and submits the logout form as a normal request

### Requirement: Tenant logout clears the cookie and returns to tenant sign-in

The system SHALL clear the shared `tp_session` cookie and redirect an authenticated tenant to `/login` when the tenant submits the Log out control.

#### Scenario: Tenant logs out from the room page

- **WHEN** an authenticated tenant submits the Log out control on `/rooms/<their room>`
- **THEN** the response expires `tp_session` and redirects the browser to `/login`

### Requirement: Admin logout clears the cookie and returns to admin sign-in

The system SHALL clear the shared `tp_session` cookie and redirect an authenticated admin to `/admin/login` when the admin submits the Log out control.

#### Scenario: Admin logs out from the admin page

- **WHEN** an authenticated admin submits the Log out control on `/admin`
- **THEN** the response expires `tp_session` and redirects the browser to `/admin/login`

### Requirement: Logout without a valid session is harmless

The system SHALL treat a logout request with no cookie, an expired cookie, or an invalid cookie as a successful no-op, clear any `tp_session` cookie present, and redirect to `/login`.

#### Scenario: Logout with no session

- **WHEN** a visitor with no valid session submits the logout action
- **THEN** the system expires any `tp_session` cookie, reports no error, and redirects to `/login`

#### Scenario: Logout with an expired or tampered cookie

- **WHEN** the browser holds an expired or tampered `tp_session` cookie and submits logout
- **THEN** the system treats the visitor as unauthenticated, clears the cookie, and redirects to `/login`

### Requirement: Logout removes the browser session cookie

On every logout, the system SHALL set `tp_session` to an empty value with `Max-Age=0`, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production, matching the options used when the cookie was set, so no valid token remains in the browser.

#### Scenario: Response expires the cookie

- **WHEN** any logout request completes
- **THEN** the response contains a `Set-Cookie` for `tp_session` that clears the value, expires the cookie immediately, and retains the original `Path`, `HttpOnly`, `SameSite`, and production `Secure` attributes

### Requirement: Protected pages require authentication after logout

After logout, the system SHALL deny access to protected pages, redirecting `/rooms/*` to `/login` and `/admin` to `/admin/login`, and SHALL NOT serve protected content from a cache.

#### Scenario: Room page redirects after logout

- **WHEN** the browser requests `/rooms/<letter>` after logout
- **THEN** the middleware redirects to `/login` and no room data is returned

#### Scenario: Admin page redirects after logout

- **WHEN** the browser requests `/admin` after logout
- **THEN** the middleware redirects to `/admin/login` and no admin controls are returned

#### Scenario: Back or reload does not show protected data

- **WHEN** the user presses Back or reloads a protected page after logout
- **THEN** the request is re-checked against the (now absent) session and the user is redirected to the matching sign-in page instead of seeing protected data

### Requirement: Room B can sign in after room A logs out

The system SHALL allow a different room to sign in from the same browser immediately after logout, issuing a fresh cookie scoped to the new room only.

#### Scenario: Cross-room sign-in after logout

- **WHEN** the tenant of room A logs out and the tenant of room B signs in with room B's current code on the same browser
- **THEN** a fresh session for room B is issued, the room B dashboard is shown, and `/rooms/a` is denied

### Requirement: Logout is a POST-only Server Action

The system MUST expose logout only as a POST Server Action. It MUST NOT expose a GET endpoint at `/logout` or any route that clears the session on GET, and Server Action requests MUST be subject to the framework's Origin/Host validation.

#### Scenario: No GET logout endpoint

- **WHEN** a client sends `GET /logout`
- **THEN** the response is 404 and no session cookie is cleared

#### Scenario: POST-only submission

- **WHEN** the logout form is submitted
- **THEN** it uses a POST Server Action request and is rejected by the framework's Origin/Host check if the request did not originate from the portal

### Requirement: Logout destination cannot be influenced by client input

The system SHALL derive the post-logout destination only from the validated server-side session role, ignore client-supplied form fields or query parameters, and redirect only to the literal `/login` or `/admin/login` paths.

#### Scenario: Crafted destination is ignored

- **WHEN** a logout request includes fields or parameters such as `next=/admin` or `role=admin`
- **THEN** the system ignores them and redirects according to the actual session role, or to `/login` when there is no valid session

### Requirement: Logout does not change server-side room state

Logout SHALL NOT modify rate-limit keys, stored room access-code hashes, or per-room session versions, and SHALL NOT revoke sessions held by other devices.

#### Scenario: Other devices and room state are unchanged

- **WHEN** a room A tenant logs out on one browser
- **THEN** room A's code hash, rate-limit state, and session version are unchanged, and a copied token or another device's room A session remains valid until its expiry
