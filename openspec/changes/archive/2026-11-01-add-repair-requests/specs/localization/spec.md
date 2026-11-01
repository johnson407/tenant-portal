# Spec Delta

## MODIFIED Requirements

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
