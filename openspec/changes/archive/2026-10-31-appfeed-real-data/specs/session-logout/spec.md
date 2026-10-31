# Spec Delta

## MODIFIED Requirements

### Requirement: Logout control on protected pages

The system SHALL present a visible logout submit control, labelled by the active locale dictionary, on the authorized `/{locale}/rooms/[room]` header, on the `/{locale}/rooms/[room]` denial view when a valid tenant session exists, and at the top of `/{locale}/admin` for an admin session. It SHALL use a plain text label, be keyboard focusable with a visible focus indicator, and work as a normal form submission without client-side JavaScript.

#### Scenario: Authorized tenant sees Log out

- **WHEN** a tenant with a current session opens their own `/zh-TW/rooms/<letter>` or `/en/rooms/<letter>` dashboard
- **THEN** the dashboard header shows the logout button, labelled 「登出」 in `zh-TW` and "Log out" in `en`

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
