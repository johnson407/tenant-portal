# Spec Delta

## MODIFIED Requirements

### Requirement: Logout control on protected pages

The system SHALL present a visible logout submit control, labelled by the active locale dictionary, on the authorized `/{locale}/rooms/[room]` header, on the `/{locale}/rooms/[room]` denial view when a valid tenant session exists, and at the top of `/{locale}/admin` for an admin session. It SHALL use a plain text label, be keyboard focusable with a visible focus indicator, and work as a normal form submission without client-side JavaScript.

#### Scenario: Authorized tenant sees Log out

- **WHEN** a tenant with a current session opens their own `/zh-TW/rooms/<letter>` or `/en/rooms/<letter>` dashboard
- **THEN** the header shows the logout button beside the placeholder-data badge, labelled 「登出」 in `zh-TW` and "Log out" in `en`

#### Scenario: Tenant on another room's denial view sees Log out

- **WHEN** the tenant of room A opens `/zh-TW/rooms/b`
- **THEN** the "Not authorized" view shows the Traditional Chinese logout button so the tenant can switch rooms

#### Scenario: Anonymous denial view has no Log out

- **WHEN** a visitor with no valid session opens `/{locale}/rooms/<letter>`
- **THEN** the denial view is shown without a logout button

#### Scenario: Admin sees Log out

- **WHEN** an admin with a current session opens `/en/admin`
- **THEN** the page shows the English "Log out" button at the top, right-aligned next to the admin heading

#### Scenario: Keyboard and no-JavaScript operation

- **WHEN** the logout button is reached by keyboard, or client-side JavaScript is unavailable
- **THEN** it shows a visible focus indicator and submits the logout form as a normal request

### Requirement: Tenant logout clears the cookie and returns to tenant sign-in

The system SHALL clear the shared `tp_session` cookie and redirect an authenticated tenant to `/{locale}/login` when the tenant submits the logout control.

#### Scenario: Tenant logs out from the room page

- **WHEN** an authenticated tenant submits the logout control on `/en/rooms/<their room>`
- **THEN** the response expires `tp_session` and redirects the browser to `/en/login`

### Requirement: Admin logout clears the cookie and returns to admin sign-in

The system SHALL clear the shared `tp_session` cookie and redirect an authenticated admin to `/{locale}/admin/login` when the admin submits the logout control.

#### Scenario: Admin logs out from the admin page

- **WHEN** an authenticated admin submits the logout control on `/zh-TW/admin`
- **THEN** the response expires `tp_session` and redirects the browser to `/zh-TW/admin/login`

### Requirement: Logout without a valid session is harmless

The system SHALL treat a logout request with no cookie, an expired cookie, or an invalid cookie as a successful no-op, clear any `tp_session` cookie present, and redirect to `/{locale}/login` using the validated locale or `zh-TW` when no valid locale was supplied.

#### Scenario: Logout with no session

- **WHEN** a visitor with no valid session submits the logout action from `/en/rooms/a`
- **THEN** the system expires any `tp_session` cookie, reports no error, and redirects to `/en/login`

#### Scenario: Logout with an expired or tampered cookie

- **WHEN** the browser holds an expired or tampered `tp_session` cookie and submits logout from `/zh-TW/rooms/a`
- **THEN** the system treats the visitor as unauthenticated, clears the cookie, and redirects to `/zh-TW/login`

### Requirement: Protected pages require authentication after logout

After logout, the system SHALL deny access to protected pages, redirecting `/{locale}/rooms/*` to `/{locale}/login` and `/{locale}/admin` to `/{locale}/admin/login`, and SHALL NOT serve protected content from a cache.

#### Scenario: Room page redirects after logout

- **WHEN** the browser requests `/zh-TW/rooms/<letter>` after logout
- **THEN** the middleware redirects to `/zh-TW/login` and no room data is returned

#### Scenario: Admin page redirects after logout

- **WHEN** the browser requests `/en/admin` after logout
- **THEN** the middleware redirects to `/en/admin/login` and no admin controls are returned

#### Scenario: Back or reload does not show protected data

- **WHEN** the user presses Back or reloads a protected page after logout
- **THEN** the request is re-checked against the (now absent) session and the user is redirected to the matching localized sign-in page instead of seeing protected data

### Requirement: Room B can sign in after room A logs out

The system SHALL allow a different room to sign in from the same browser immediately after logout, issuing a fresh cookie scoped to the new room only, in the locale selected by the sign-in URL.

#### Scenario: Cross-room sign-in after logout

- **WHEN** the tenant of room A logs out and the tenant of room B signs in with room B's current code on `/en/login` in the same browser
- **THEN** a fresh session for room B is issued, `/en/rooms/b` is shown, and `/en/rooms/a` is denied

### Requirement: Logout destination cannot be influenced by client input

The system SHALL derive the post-logout destination from the validated server-side session role and the validated locale, ignore any other client-supplied fields or query parameters, and redirect only to the local `/{locale}/login` or `/{locale}/admin/login` paths.

#### Scenario: Crafted destination is ignored

- **WHEN** a logout request includes fields or parameters such as `next=/admin`, `role=admin`, or `lang=https://evil.example`
- **THEN** the system ignores them, validates the locale or falls back to `zh-TW`, and redirects according to the actual session role to a local path
