# Spec Delta

## ADDED Requirements

### Requirement: Scoped Google service-account access

The system SHALL authenticate to Google Sheets with a service account using the `https://www.googleapis.com/auth/spreadsheets` scope. Credentials SHALL come only from server-side environment variables and MUST NOT be exposed to the browser, logged, or committed. The service account MUST be shared only with AppFeed as Editor, never with the main rent file.

#### Scenario: Missing or invalid credentials
- **WHEN** a credential environment variable is absent or rejected by Google
- **THEN** the feed is unavailable and no key, token, or credential detail appears in the response or logs

#### Scenario: Service account is not shared the main file
- **WHEN** the Google Drive sharing state is inspected
- **THEN** the service account email appears on AppFeed as Editor and does not appear on the main rent file or any copy of it

### Requirement: Claim write boundaries

The system SHALL write only the `claimed_on` and `bank_last5` cells of an existing Bills row. It MUST NOT create, delete, or reorder rows, tabs, or columns.

#### Scenario: Write scope is limited to claim cells
- **WHEN** the app writes a claim
- **THEN** the request updates only the two claim cells of the matching Bills row

#### Scenario: No structural write
- **WHEN** the app's Sheets requests are inspected
- **THEN** none creates a tab, adds a row, or changes a header

## MODIFIED Requirements

### Requirement: Bills tab schema

The `Bills` tab SHALL expose exactly the header row `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5` in that order. It SHALL hold one row per room per billing period, with room A-E, period `YYYY-MM`, whole-NT$ rent, optional whole-NT$ water and electricity, an ISO due date, an optional ISO paid date, and optional claim fields. A row SHALL have both claim cells empty or both filled. Deposit is excluded.

#### Scenario: Exact Bills header
- **WHEN** the first row of the Bills tab is read
- **THEN** it equals the nine header names above, in that order, after trimming surrounding whitespace

#### Scenario: Blank versus zero utility charges
- **WHEN** a Bills row has a blank water or electricity cell
- **THEN** that utility is treated as no charge, while a cell containing `0` is treated as a real zero charge

#### Scenario: Duplicate billing period
- **WHEN** two Bills rows have the same room and the same period
- **THEN** both rows are invalid and that room's data is unavailable

#### Scenario: Claim pair is complete
- **WHEN** a Bills row has a claimed date but a blank suffix, or a suffix but a blank claimed date
- **THEN** the row is invalid and that room's data is unavailable

### Requirement: Fixed ranges and header allow-list

The system SHALL read cell data only from the fixed A1 ranges `Bills!A:I` and `Leases!A:D`, and SHALL validate the first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range. A claim write SHALL target only `Bills!H:I` on a row inside that range.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:I` and `Leases!A:D`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the whole feed is unavailable and no rows are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data in a column beyond I on Bills or beyond D on Leases
- **THEN** that column is outside the requested range and never reaches the app

#### Scenario: Write stays inside the claim columns
- **WHEN** a claim is written
- **THEN** the update range is inside `Bills!H:I` and no other column changes

### Requirement: Strict Bills validation

Each Bills value SHALL be validated: room A-E after trim and uppercase; period `^\d{4}-(0[1-9]|1[0-2])$`; rent, water, and electricity `^\d{1,7}$` after trim, with blank allowed only for water and electricity; due_date and paid_on `^\d{4}-\d{2}-\d{2}$` real calendar dates; claimed_on blank or a real ISO date; bank_last5 blank or `^\d{5}$`; no duplicate `(room, period)`. Rows failing any check are invalid.

#### Scenario: Formatted amount rejected
- **WHEN** a rent or utility cell contains `$1,000`, `1,000`, a negative number, or a currency word
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Spreadsheet error rejected
- **WHEN** a cell contains `#DIV/0!`, `#N/A`, or another spreadsheet error
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Impossible calendar date rejected
- **WHEN** a due_date, paid_on, or claimed_on cell contains `2026-02-30` or another non-existent date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Valid leap day accepted
- **WHEN** a date cell contains `2024-02-29`
- **THEN** the date is accepted as a real calendar date

#### Scenario: Lowercase or padded room accepted
- **WHEN** a room cell contains ` b ` or `c`
- **THEN** it is normalized to room B or C and attributed to that room

#### Scenario: Malformed account suffix rejected
- **WHEN** a bank_last5 cell contains four digits, six digits, letters, a space, or a hyphen
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Full account number is rejected
- **WHEN** a bank_last5 cell holds more than five digits
- **THEN** the row is invalid and the value is never displayed

### Requirement: Fail closed per room

If any row attributed to room X is invalid, the system SHALL make room X's dashboard unavailable and MUST NOT show a partial result for that room. Other rooms SHALL be unaffected. A row whose room cell is not A-E SHALL be dropped and counted without affecting any room. Completely empty rows SHALL be ignored. A row with a partial claim pair SHALL count as invalid for its room.

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

#### Scenario: Partial claim pair fails the room
- **WHEN** a room has one row with a claimed date and a blank suffix
- **THEN** that room is unavailable and other rooms are unaffected

### Requirement: Room-scoped server-side projection

The system SHALL expose feed data only through server-only accessors. The tenant accessor SHALL accept a validated room letter, filter rows by exact room on the server before caching or returning, and return a narrow typed projection. The admin claim accessor SHALL accept only an admin session and SHALL return only room, period, claimed_on, and bank_last5 for rows with a claim and no paid_on. No API route, route handler, or Server Action SHALL return full Bill or Lease rows.

#### Scenario: Room A receives no other room's values
- **WHEN** a fixture feed contains distinct sentinel values for rooms A-E and room A's feed is requested
- **THEN** the serialized result contains only room A's sentinels and none of room B-E's sentinels

#### Scenario: Cross-room request is denied before data access
- **WHEN** the tenant of room A requests the room B dashboard
- **THEN** the page denies access and does not call the feed accessor for room B

#### Scenario: Admin claim projection is narrow
- **WHEN** an admin loads the claim list
- **THEN** each entry holds only room, period, claimed date, and suffix, and no rent, utility, lease, or paid value

#### Scenario: No endpoint returns the full feed
- **WHEN** the app's routes, route handlers, and Server Actions are inspected
- **THEN** none returns AppFeed rows or a full-sheet snapshot to the client

### Requirement: Per-room server caching

The accessor SHALL be cached with `use cache` and keyed by the room letter, with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` and tag `appfeed:room:<letter>`. Each cache entry SHALL contain only that room's already-filtered projection; no cache entry may contain another room's rows. A successful claim write SHALL invalidate the tag for that room.

#### Scenario: Cache key is the room
- **WHEN** room A and room B request their feeds
- **THEN** they produce separate cache entries and neither entry contains the other room's data

#### Scenario: No all-rooms cache entry
- **WHEN** the cache is inspected after any room request
- **THEN** no entry contains the full Bills or Leases sheet or another room's rows

#### Scenario: Fifteen-minute revalidate
- **WHEN** a cached room entry is younger than 15 minutes
- **THEN** the app serves it without a new Sheets read and the entry revalidates in the background after 15 minutes

#### Scenario: Claim write invalidates only its room
- **WHEN** a claim write succeeds for room A
- **THEN** the room A tag is invalidated and room B's entry is unchanged

### Requirement: Generic failure state and safe logging

The system SHALL map missing configuration, 401, 403, 429, 5xx, network errors, an 8-second timeout, a wrong title or tab set, a header mismatch, and a claim write failure to one generic unavailable state. It MUST NOT render raw error text, stack traces, cell values, tokens, spreadsheet IDs, or service-account details.

#### Scenario: Any failure is generic
- **WHEN** any listed failure occurs
- **THEN** the user sees the localized data-temporarily-unavailable copy and no raw error, stack trace, cell value, token, spreadsheet ID, or service-account detail

#### Scenario: Logs contain no cell values
- **WHEN** a failure, invalid row, or claim write is logged
- **THEN** the log contains only counts, tab names, row numbers, and a fixed reason code, never cell contents, a bank suffix, a claimed date, or credentials

### Requirement: No tenant personal information

The system MUST NOT read, cache, log, or display tenant personal information. AppFeed SHALL contain no free-text fields and SHALL exclude names, phone numbers, emails, ID numbers, addresses, LINE IDs, full account numbers, and deposit. The last five digits of a sending account SHALL be the only account data stored. The app MUST NOT reference the main rent file's ID, name, or URL in code, environment configuration, or request URLs.

#### Scenario: PII-like value is rejected
- **WHEN** a name, phone number, email address, ID number, or address is entered in any schema column
- **THEN** validation rejects it and the value is not displayed

#### Scenario: Only schema columns are read
- **WHEN** the app reads AppFeed
- **THEN** it reads only the fixed ranges and schema columns and never a notes, name, phone, or address column

#### Scenario: Full account number is never stored
- **WHEN** a tenant tries to report a full bank account number
- **THEN** the claim is rejected and the value is not written or logged

#### Scenario: Fixtures and logs are clean
- **WHEN** the test fixtures and runtime logs are inspected
- **THEN** fixtures are synthetic and logs contain no tenant personal information

## REMOVED Requirements

### Requirement: Read-only Google service-account access

**Reason**: Tenants now report payments, so the app writes the two claim cells. A read-only scope cannot do this.

**Migration**: Share AppFeed with the service account as Editor instead of Viewer. Replace the `spreadsheets.readonly` scope with `spreadsheets`. Keep all other read limits. Use "Scoped Google service-account access" instead.
