# appfeed-data-source Specification

## Purpose

Makes a clean, PII-free Google Sheet named AppFeed the only source of tenant bills, payments, and lease dates, with read-only access, strict validation, room-scoped caching, and explicit unavailable and empty states.

## Requirements

### Requirement: AppFeed is the only dashboard data source

The system SHALL read dashboard bills, payments, and lease dates only from a Google Sheet titled `AppFeed`. It MUST NOT read or reference the landlord's main rent file, any copy of it, or placeholder data in production.

#### Scenario: Dashboard data comes from AppFeed
- **WHEN** an authenticated tenant opens their room dashboard
- **THEN** every displayed bill, payment, and lease value originates from the AppFeed sheet for that room

#### Scenario: No placeholder fallback
- **WHEN** AppFeed is missing, unshared, unreachable, or invalid
- **THEN** the dashboard shows the generic unavailable state and does not render placeholder or main-file data

#### Scenario: Main file is never referenced
- **WHEN** the deployed app, its environment, and its logs are inspected
- **THEN** no code path, environment variable, request URL, or log entry references the main rent file's ID, name, or link

### Requirement: Bills tab schema

The `Bills` tab SHALL expose exactly the header row `room, period, rent, water, electricity, due_date, paid_on` in that order. It SHALL hold one row per room per billing period, with room A-E, period `YYYY-MM`, whole-NT$ rent, optional whole-NT$ water and electricity, an ISO due date, and an optional ISO paid date. Deposit is excluded.

#### Scenario: Exact Bills header
- **WHEN** the first row of the Bills tab is read
- **THEN** it equals the seven header names above, in that order, after trimming surrounding whitespace

#### Scenario: Blank versus zero utility charges
- **WHEN** a Bills row has a blank water or electricity cell
- **THEN** that utility is treated as no charge, while a cell containing `0` is treated as a real zero charge

#### Scenario: Duplicate billing period
- **WHEN** two Bills rows have the same room and the same period
- **THEN** both rows are invalid and that room's data is unavailable

### Requirement: Leases tab schema

The `Leases` tab SHALL expose exactly the header row `room, lease_start, lease_end, renewal_due` in that order. It SHALL hold one row per room with room A-E, ISO lease dates, `lease_end` on or after `lease_start`, and an optional ISO renewal date. Deposit and free-text notes are excluded.

#### Scenario: Exact Leases header
- **WHEN** the first row of the Leases tab is read
- **THEN** it equals the four header names above, in that order, after trimming surrounding whitespace

#### Scenario: Optional renewal date
- **WHEN** a Leases row has a blank renewal_due
- **THEN** the lease is valid and the dashboard shows renewal as not set

#### Scenario: Missing lease row
- **WHEN** a room has bills but no Leases row
- **THEN** the dashboard header shows lease dates not available while the room's bills and payments still render

### Requirement: Read-only Google service-account access

The system SHALL authenticate to Google Sheets with a service account using the `https://www.googleapis.com/auth/spreadsheets.readonly` scope and SHALL obtain credentials only from server-side environment variables. Credentials MUST NOT be exposed to the browser, logged, or committed. The service account MUST be shared only with AppFeed as Viewer, never with the main rent file.

#### Scenario: Read-only access
- **WHEN** the app obtains a Google access token
- **THEN** the token request asserts the spreadsheets.readonly scope and the Sheets calls are reads only

#### Scenario: Missing or invalid credentials
- **WHEN** a credential environment variable is absent or rejected by Google
- **THEN** the feed is unavailable and no key, token, or credential detail appears in the response or logs

#### Scenario: Service account is not shared the main file
- **WHEN** the Google Drive sharing state is inspected
- **THEN** the service account email appears on AppFeed as Viewer and does not appear on the main rent file or any copy of it

### Requirement: Wrong-file guard

Before reading any cell, the system SHALL request spreadsheet metadata limited to the spreadsheet title and tab titles. It SHALL refuse to continue unless the title is exactly `AppFeed` and the tab titles are exactly `Bills` and `Leases`.

#### Scenario: Wrong spreadsheet title
- **WHEN** the configured spreadsheet ID resolves to a file whose title is not exactly `AppFeed`
- **THEN** the system stops before requesting cell values and the feed is unavailable

#### Scenario: Extra tab
- **WHEN** the title is `AppFeed` but the file has a third tab such as `現住戶資料`
- **THEN** the system stops and the feed is unavailable

#### Scenario: Missing tab
- **WHEN** the title is `AppFeed` but either `Bills` or `Leases` is absent
- **THEN** the system stops and the feed is unavailable

#### Scenario: Valid file proceeds
- **WHEN** the title is exactly `AppFeed` and the tab set is exactly `Bills` and `Leases`
- **THEN** the system proceeds to read the two fixed ranges

### Requirement: Fixed ranges and header allow-list

The system SHALL read cell data only from the fixed A1 ranges `Bills!A:G` and `Leases!A:D`, and SHALL validate the first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:G` and `Leases!A:D`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the whole feed is unavailable and no rows are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data in a column beyond G on Bills or beyond D on Leases
- **THEN** that column is outside the requested range and never reaches the app

### Requirement: Strict Bills validation

Each Bills value SHALL be validated: room A-E after trim and uppercase; period `^\d{4}-(0[1-9]|1[0-2])$`; rent, water, and electricity `^\d{1,7}$` after trim, with blank allowed only for water and electricity; due_date and paid_on `^\d{4}-\d{2}-\d{2}$` real calendar dates; no duplicate `(room, period)`. Rows failing any check are invalid.

#### Scenario: Formatted amount rejected
- **WHEN** a rent or utility cell contains `$1,000`, `1,000`, a negative number, or a currency word
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Spreadsheet error rejected
- **WHEN** a cell contains `#DIV/0!`, `#N/A`, or another spreadsheet error
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Impossible calendar date rejected
- **WHEN** a due_date or paid_on cell contains `2026-02-30` or another non-existent date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Valid leap day accepted
- **WHEN** a date cell contains `2024-02-29`
- **THEN** the date is accepted as a real calendar date

#### Scenario: Lowercase or padded room accepted
- **WHEN** a room cell contains ` b ` or `c`
- **THEN** it is normalized to room B or C and attributed to that room

### Requirement: Strict Leases validation

Each Leases value SHALL be validated: room A-E after trim and uppercase; lease_start and lease_end `^\d{4}-\d{2}-\d{2}$` real calendar dates with `lease_end` on or after `lease_start`; renewal_due blank or a real ISO date; no duplicate room. Rows failing any check are invalid.

#### Scenario: Lease ends before it starts
- **WHEN** a Leases row has lease_end earlier than lease_start
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Impossible lease date rejected
- **WHEN** a lease date contains `2026-13-01` or `2026-04-31`
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Duplicate lease row
- **WHEN** two Leases rows have the same room
- **THEN** both rows are invalid and that room's data is unavailable

#### Scenario: Valid lease with no renewal date
- **WHEN** a Leases row has valid start and end dates and a blank renewal_due
- **THEN** the lease is accepted and renewal is shown as not set

### Requirement: Fail closed per room

If any row attributed to room X is invalid, the system SHALL make room X's dashboard unavailable and MUST NOT show a partial result for that room. Other rooms SHALL be unaffected. A row whose room cell is not A-E SHALL be dropped and counted without affecting any room. Completely empty rows SHALL be ignored.

#### Scenario: One bad row makes only that room unavailable
- **WHEN** room A has an invalid row and room B has only valid rows
- **THEN** room A's dashboard is unavailable and room B's dashboard renders normally

#### Scenario: Invalid room cell is unattributable
- **WHEN** a Bills row's room cell is `X`, a name, or a phone number
- **THEN** the row is dropped and counted and no room is made unavailable because of it

#### Scenario: Empty rows are ignored
- **WHEN** a row has no values in any cell
- **THEN** it is ignored and does not count as invalid

#### Scenario: No partial bill list
- **WHEN** a room has three valid rows and one invalid row
- **THEN** the dashboard does not show the three valid rows; the whole room is unavailable

### Requirement: Room-scoped server-side projection

The system SHALL expose feed data only through a server-only accessor that accepts a validated room letter, filters rows by exact room on the server before caching or returning, and returns a narrow typed projection. The room letter MUST come only from the verified session. No API route, route handler, or Server Action SHALL return feed data.

#### Scenario: Room A receives no other room's values
- **WHEN** a fixture feed contains distinct sentinel values for rooms A-E and room A's feed is requested
- **THEN** the serialized result contains only room A's sentinels and none of room B-E's sentinels

#### Scenario: Cross-room request is denied before data access
- **WHEN** the tenant of room A requests the room B dashboard
- **THEN** the page denies access and does not call the feed accessor for room B

#### Scenario: No endpoint returns the full feed
- **WHEN** the app's routes, route handlers, and Server Actions are inspected
- **THEN** none returns AppFeed rows or a full-sheet snapshot to the client

### Requirement: Per-room server caching

The accessor SHALL be cached with `use cache` and keyed by the room letter, with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` and tag `appfeed:room:<letter>`. Each cache entry SHALL contain only that room's already-filtered projection; no cache entry may contain another room's rows.

#### Scenario: Cache key is the room
- **WHEN** room A and room B request their feeds
- **THEN** they produce separate cache entries and neither entry contains the other room's data

#### Scenario: No all-rooms cache entry
- **WHEN** the cache is inspected after any room request
- **THEN** no entry contains the full Bills or Leases sheet or another room's rows

#### Scenario: Fifteen-minute revalidate
- **WHEN** a cached room entry is younger than 15 minutes
- **THEN** the app serves it without a new Sheets read and the entry revalidates in the background after 15 minutes

### Requirement: Freshness and stale data

While a cache entry is fresh, the system SHALL serve it without a new Sheets read. After 15 minutes it SHALL revalidate in the background. On a transient failure with a stale entry it SHALL serve that entry and display its last-updated time; after the 1-hour expiry or with no entry it SHALL show unavailable.

#### Scenario: Fresh entry is served
- **WHEN** a tenant opens a dashboard within 15 minutes of the last successful read
- **THEN** the tenant sees the cached values and the last-updated time from that read

#### Scenario: Transient failure with stale data
- **WHEN** a background refresh fails with a timeout, network error, 429, or 5xx and a previous entry exists
- **THEN** the tenant sees the previous values with their last-updated time, not a blank or placeholder dashboard

#### Scenario: No entry or expired entry
- **WHEN** the first read fails or the entry has passed its 1-hour expiry and the refresh still fails
- **THEN** the dashboard shows the generic unavailable state

### Requirement: Empty and missing-data states

A room with no valid Bills rows SHALL show a distinct no-bills-yet state, not the unavailable state. A room with no paid Bills rows SHALL show a distinct no-payments-yet state. A room with no Leases row SHALL show lease dates not available while still showing its bills and payments.

#### Scenario: Room has no bills
- **WHEN** AppFeed has no Bills rows for the room
- **THEN** the bills section shows the no-bills-yet copy and the dashboard is not treated as unavailable

#### Scenario: Room has no payments
- **WHEN** all of the room's Bills rows have a blank paid_on
- **THEN** the payments section shows the no-payments-yet copy while open bills still render

#### Scenario: Room has no lease
- **WHEN** AppFeed has no Leases row for the room
- **THEN** the dashboard header shows lease dates not available and the room's bills and payments still render

### Requirement: Generic failure state and safe logging

The system SHALL map missing configuration, 401, 403, 429, 5xx, network errors, an 8-second timeout, a wrong title or tab set, and a header mismatch to one generic unavailable state. It MUST NOT render raw error text, stack traces, cell values, tokens, spreadsheet IDs, or service-account details.

#### Scenario: Any failure is generic
- **WHEN** any listed failure occurs
- **THEN** the tenant sees the localized data-temporarily-unavailable copy and no raw error, stack trace, cell value, token, spreadsheet ID, or service-account detail

#### Scenario: Logs contain no cell values
- **WHEN** a failure or invalid row is logged
- **THEN** the log contains only counts, tab names, row numbers, and a fixed reason code, never cell contents or credentials

### Requirement: No tenant personal information

The system MUST NOT read, cache, log, or display tenant personal information. AppFeed SHALL contain no free-text fields and SHALL exclude names, phone numbers, emails, ID numbers, addresses, LINE IDs, and deposit. The app MUST NOT reference the main rent file's ID, name, or URL in code, environment configuration, or request URLs.

#### Scenario: PII-like value is rejected
- **WHEN** a name, phone number, email address, ID number, or address is entered in any schema column
- **THEN** validation rejects it and the value is not displayed

#### Scenario: Only schema columns are read
- **WHEN** the app reads AppFeed
- **THEN** it reads only the fixed ranges and schema columns and never a notes, name, phone, or address column

#### Scenario: Fixtures and logs are clean
- **WHEN** the test fixtures and runtime logs are inspected
- **THEN** fixtures are synthetic and logs contain no tenant personal information
