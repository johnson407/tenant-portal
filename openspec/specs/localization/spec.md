# localization Specification

## Purpose

Lets tenants and the landlord use the portal in Traditional Chinese by default or in English, with every route, redirect, label, error message, amount, and date respecting the locale selected in the URL.

## Requirements

### Requirement: Supported locales and default locale

The system SHALL support exactly two locales, `zh-TW` (Traditional Chinese, the default) and `en` (English). When no locale is present in the URL, the system SHALL use `zh-TW` regardless of the browser's `Accept-Language` header.

#### Scenario: Bare path uses Traditional Chinese
- **WHEN** a visitor requests `/login` without a locale prefix
- **THEN** the system redirects to `/zh-TW/login` and renders the sign-in page in Traditional Chinese

#### Scenario: Explicit English is respected
- **WHEN** a visitor requests `/en/login`
- **THEN** the system renders the sign-in page in English and does not redirect to `zh-TW`

#### Scenario: Browser language does not override the default
- **WHEN** a browser sends `Accept-Language: en-US` and requests `/`
- **THEN** the system still selects `zh-TW`, not `en`

### Requirement: Locale-prefixed routes

Every page SHALL be served under a `/{locale}/...` path. A request without a supported locale prefix SHALL redirect to the same path and query string under the default locale.

#### Scenario: Existing paths keep working
- **WHEN** a visitor requests `/rooms/a?from=email`
- **THEN** the system redirects to `/zh-TW/rooms/a?from=email` before applying the room access check

#### Scenario: Unsupported locale is not treated as valid
- **WHEN** a visitor requests `/fr/login` or `/zh-CN/login`
- **THEN** the system does not render a page for that locale and the request ends in a 404 response

#### Scenario: Root path resolves through the default locale
- **WHEN** a visitor requests `/`
- **THEN** the system redirects to `/zh-TW` and then to the tenant's dashboard or the tenant sign-in page as that page requires

### Requirement: Language switcher

Every portal page SHALL show a visible, keyboard-focusable link to the equivalent page in the other locale. The switcher MUST work without client-side JavaScript and MUST keep the user on the same screen, including the same room dashboard.

#### Scenario: Switching locale on the sign-in page
- **WHEN** a visitor on `/zh-TW/login` activates the English switcher link
- **THEN** the browser navigates to `/en/login` and the page renders in English

#### Scenario: Switching locale on a room dashboard
- **WHEN** a tenant on `/zh-TW/rooms/b` activates the English switcher link
- **THEN** the browser navigates to `/en/rooms/b` and the room B dashboard renders in English

#### Scenario: Switcher is keyboard reachable
- **WHEN** a keyboard user tabs through a page
- **THEN** the language switcher receives visible focus and can be activated with Enter

### Requirement: Localized interface copy

All user-facing copy SHALL come from the dictionary for the active locale. This includes sign-in pages, the room dashboard, the not-authorized view, admin sign-in, admin reset and its success panel, logout controls, form labels and placeholders, pending states, page titles, dashboard unavailable/empty/last-updated states, bill, payment, and lease labels and statuses, and the repair form, repair history, admin repair queue, repair categories, and repair statuses.

#### Scenario: Traditional Chinese is the default copy
- **WHEN** a visitor opens `/zh-TW/login`
- **THEN** the heading, room selector label, access-code label, submit button, admin link, and error text are Traditional Chinese, while room letters and access codes remain unchanged

#### Scenario: English copy is complete
- **WHEN** a visitor opens `/en/login`
- **THEN** the same controls render in English with no Chinese text left from the dictionary

#### Scenario: Dashboard labels are localized
- **WHEN** a tenant opens `/zh-TW/rooms/a`
- **THEN** the dashboard headings, bill and payment labels, repair labels, rent/water/electricity labels, statuses, lease labels, last-updated caption, and logout control are Traditional Chinese

#### Scenario: Dashboard empty and unavailable states are localized
- **WHEN** a tenant opens `/zh-TW/rooms/a` or `/en/rooms/a` while AppFeed is unavailable or a section is empty
- **THEN** the unavailable, no-bills-yet, no-payments-yet, no-repairs-yet, missing-lease, and not-available copy all come from the active locale's dictionary

#### Scenario: Admin success panel is localized
- **WHEN** the admin completes a code reset on `/zh-TW/admin`
- **THEN** the confirmation, copy control, one-time-code warning, and "reset another room" control are Traditional Chinese

#### Scenario: Admin repair queue is localized
- **WHEN** the admin opens `/zh-TW/admin` with pending repairs
- **THEN** the room, category, note, submitted date, status, mark-done control, and error text are Traditional Chinese

#### Scenario: Repair history is localized
- **WHEN** a tenant opens `/zh-TW/rooms/a` with repair requests
- **THEN** the repair form labels, warning, category names, status badges, and empty or unavailable copy are Traditional Chinese

### Requirement: Localized validation and status messages

Validation and error messages SHALL be shown in the active locale. A Server Action MUST return a locale-independent error code, and the form for the active locale SHALL map that code to its dictionary entry, so identical failures produce the correctly localized message. This includes repair category, note, generic, and completion errors.

#### Scenario: Wrong code on the Traditional Chinese login
- **WHEN** a tenant submits an incorrect access code on `/zh-TW/login`
- **THEN** the page shows the Traditional Chinese invalid-credentials message and creates no session

#### Scenario: Wrong code on the English login
- **WHEN** a tenant submits an incorrect access code on `/en/login`
- **THEN** the page shows the English invalid-credentials message and creates no session

#### Scenario: Admin errors follow the locale
- **WHEN** an admin submits a wrong password on `/en/admin/login` or an invalid room on `/zh-TW/admin`
- **THEN** the error is rendered in the corresponding locale

#### Scenario: Repair errors follow the locale
- **WHEN** a tenant submits an invalid category or note on `/en/rooms/a`
- **THEN** the page shows the English repair error for that failure

#### Scenario: Repair completion errors follow the locale
- **WHEN** an admin marks an already done request on `/zh-TW/admin`
- **THEN** the page shows the Traditional Chinese completion error

### Requirement: Locale-aware currency and date formatting

Amounts SHALL be presented as whole New Taiwan dollars using the active locale's number conventions with zero fraction digits. Dates and last-updated timestamps SHALL use the active locale's conventions and MUST NOT shift to another calendar day because of timezone conversion.

#### Scenario: Traditional Chinese amount and date
- **WHEN** a tenant opens `/zh-TW/rooms/a` and AppFeed has a rent of `750` due on `2026-11-01`
- **THEN** the rent reads `$750` and the due date reads `2026年11月1日`

#### Scenario: English amount and date
- **WHEN** a tenant opens `/en/rooms/a` and AppFeed has a rent of `750` due on `2026-11-01`
- **THEN** the rent reads `NT$750` and the due date reads `Nov 1, 2026`

#### Scenario: Whole-dollar amounts have no cents
- **WHEN** AppFeed stores any whole-NT$ amount
- **THEN** the dashboard never adds `.00` or fractional digits to the displayed amount

#### Scenario: Date does not shift by timezone
- **WHEN** the server runs in any timezone and renders an AppFeed date stored as `2026-11-01`
- **THEN** the displayed date is still November 1, 2026, not October 31, 2026

#### Scenario: Last-updated time is stable
- **WHEN** the dashboard displays the last-updated timestamp
- **THEN** it is formatted in `Asia/Taipei` for the active locale and does not shift to a different day or time zone

### Requirement: Locale-preserving redirects

Authentication and navigation redirects SHALL stay within the locale of the request. Tenant room access failures SHALL redirect to `/{locale}/login`; admin access failures SHALL redirect to `/{locale}/admin/login`; successful tenant sign-in SHALL redirect to `/{locale}/rooms/{room}`.

#### Scenario: Anonymous room request in English
- **WHEN** a visitor without a session requests `/en/rooms/a`
- **THEN** the system redirects to `/en/login`

#### Scenario: Anonymous admin request in Traditional Chinese
- **WHEN** a visitor without an admin session requests `/zh-TW/admin`
- **THEN** the system redirects to `/zh-TW/admin/login`

#### Scenario: Successful tenant sign-in keeps the locale
- **WHEN** a tenant submits valid room A credentials on `/en/login`
- **THEN** the system redirects to `/en/rooms/a`

#### Scenario: Signed-in tenant home keeps the locale
- **WHEN** a tenant with a current room B session requests `/zh-TW`
- **THEN** the system redirects to `/zh-TW/rooms/b`

### Requirement: Locale input cannot cause an off-site redirect

When a Server Action receives a locale value from the browser, it SHALL validate that value against the supported locales and fall back to `zh-TW` otherwise. The validated locale MUST only be used as a path prefix, never as a full redirect destination.

#### Scenario: Crafted locale value
- **WHEN** a login or logout request submits a locale such as `https://evil.example` or `//evil.example`
- **THEN** the system ignores it, uses `zh-TW`, and redirects only to a local `/zh-TW/...` path

### Requirement: Document language and metadata

The rendered document SHALL declare the active locale in the `html` element, and page titles and descriptions SHALL be localized.

#### Scenario: Traditional Chinese document
- **WHEN** any page renders under `/zh-TW`
- **THEN** the document contains `<html lang="zh-TW">` and a Traditional Chinese page title

#### Scenario: English document
- **WHEN** any page renders under `/en`
- **THEN** the document contains `<html lang="en">` and an English page title
