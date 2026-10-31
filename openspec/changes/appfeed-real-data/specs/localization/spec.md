# Spec Delta

## MODIFIED Requirements

### Requirement: Localized interface copy

All user-facing copy SHALL come from the dictionary for the active locale. This includes sign-in pages, the room dashboard, the not-authorized view, admin sign-in, admin reset and its success panel, logout controls, form labels and placeholders, pending states, page titles, dashboard unavailable/empty/last-updated states, and bill, payment, and lease labels and statuses.

#### Scenario: Traditional Chinese is the default copy
- **WHEN** a visitor opens `/zh-TW/login`
- **THEN** the heading, room selector label, access-code label, submit button, admin link, and error text are Traditional Chinese, while room letters and access codes remain unchanged

#### Scenario: English copy is complete
- **WHEN** a visitor opens `/en/login`
- **THEN** the same controls render in English with no Chinese text left from the dictionary

#### Scenario: Dashboard labels are localized
- **WHEN** a tenant opens `/zh-TW/rooms/a`
- **THEN** the dashboard headings, bill and payment labels, rent/water/electricity labels, statuses, lease labels, last-updated caption, and logout control are Traditional Chinese

#### Scenario: Dashboard empty and unavailable states are localized
- **WHEN** a tenant opens `/zh-TW/rooms/a` or `/en/rooms/a` while AppFeed is unavailable or a section is empty
- **THEN** the unavailable, no-bills-yet, no-payments-yet, missing-lease, and not-available copy all come from the active locale's dictionary

#### Scenario: Admin success panel is localized
- **WHEN** the admin completes a code reset on `/zh-TW/admin`
- **THEN** the confirmation, copy control, one-time-code warning, and "reset another room" control are Traditional Chinese

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
