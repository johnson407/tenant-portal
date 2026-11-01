# Spec Delta

## MODIFIED Requirements

### Requirement: AppFeed is the only dashboard data source

The system SHALL read dashboard bills, payments, lease dates, and repair requests only from a Google Sheet titled `AppFeed`. It MUST NOT read or reference the landlord's main rent file, any copy of it, or placeholder data in production.

#### Scenario: Dashboard data comes from AppFeed
- **WHEN** an authenticated tenant opens their room dashboard
- **THEN** every displayed bill, payment, lease value, and repair request originates from the AppFeed sheet for that room

#### Scenario: No placeholder fallback
- **WHEN** AppFeed is missing, unshared, unreachable, or invalid
- **THEN** the dashboard shows the generic unavailable state and does not render placeholder or main-file data

#### Scenario: Main file is never referenced
- **WHEN** the deployed app, its environment, and its logs are inspected
- **THEN** no code path, environment variable, request URL, or log entry references the main rent file's ID, name, or link

### Requirement: Wrong-file guard

Before reading any cell, the system SHALL request spreadsheet metadata limited to the spreadsheet title and tab titles. It SHALL refuse to continue unless the title is exactly `AppFeed` and the tab titles are exactly `Bills` and `Leases`, with an optional `Repairs`. It MUST reject any other tab, including a duplicate or hidden tab.

#### Scenario: Wrong spreadsheet title
- **WHEN** the configured spreadsheet ID resolves to a file whose title is not exactly `AppFeed`
- **THEN** the system stops before requesting cell values and the feed is unavailable

#### Scenario: Extra tab
- **WHEN** the title is `AppFeed` but the file has a tab other than `Bills`, `Leases`, or `Repairs`, such as `現住戶資料`
- **THEN** the system stops and the feed is unavailable

#### Scenario: Missing tab
- **WHEN** the title is `AppFeed` but either `Bills` or `Leases` is absent
- **THEN** the system stops and the feed is unavailable

#### Scenario: Optional Repairs tab is absent
- **WHEN** the title is `AppFeed` and the tabs are exactly `Bills` and `Leases`
- **THEN** bills, payments, and lease proceed, and the repair section shows its unavailable state

#### Scenario: Valid file proceeds
- **WHEN** the title is exactly `AppFeed` and the tab set is `Bills` and `Leases` with or without `Repairs`
- **THEN** the system proceeds to read the fixed ranges for the tabs that exist

### Requirement: Fixed ranges and header allow-list

The system SHALL read cell data only from the fixed A1 ranges `Bills!A:I`, `Leases!A:D`, and, when present, `Repairs!A:G`, and SHALL validate each first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range. A claim write SHALL target only `Bills!H:I` on a row inside that range. A repair status write SHALL target only `Repairs!F:G` on a row inside that range.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:I`, `Leases!A:D`, and, when the tab exists, `Repairs!A:G`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the affected tab is unavailable and no rows from it are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data in a column beyond I on Bills, beyond D on Leases, or beyond G on Repairs
- **THEN** that column is outside the requested range and never reaches the app

#### Scenario: Write stays inside the claim columns
- **WHEN** a claim is written
- **THEN** the update range is inside `Bills!H:I` and no other column changes

#### Scenario: Repair write stays inside the status columns
- **WHEN** a repair request is marked done
- **THEN** the update range is inside `Repairs!F:G` and no other column changes

#### Scenario: No Repairs range when the tab is absent
- **WHEN** the `Repairs` tab is absent
- **THEN** the read request contains only the `Bills` and `Leases` ranges

### Requirement: Claim write boundaries

The system SHALL write only the `claimed_on` and `bank_last5` cells of an existing Bills row. A claim write MUST NOT create, delete, or reorder rows, tabs, or columns.

#### Scenario: Write scope is limited to claim cells
- **WHEN** the app writes a claim
- **THEN** the request updates only the two claim cells of the matching Bills row

#### Scenario: No structural write
- **WHEN** a claim write request is inspected
- **THEN** it does not create a tab, add a row, or change a header

### Requirement: Fail closed per room

If any Bills or Leases row attributed to room X is invalid, the system SHALL make room X's dashboard unavailable and MUST NOT show a partial result for that room. Other rooms SHALL be unaffected. A row whose room cell is not A-E SHALL be dropped and counted without affecting any room. Completely empty rows SHALL be ignored. A row with a partial claim pair SHALL count as invalid for its room.

#### Scenario: One bad row makes only that room unavailable
- **WHEN** room A has an invalid row and room B has only valid rows
- **THEN** room A's dashboard is unavailable and room B's dashboard renders normally

#### Scenario: Invalid room cell is unattributable
- **WHEN** a Bills or Leases row's room cell is `X`, a name, or a phone number
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

### Requirement: Generic failure state and safe logging

The system SHALL map missing configuration, 401, 403, 429, 5xx, network errors, an 8-second timeout, a wrong title or tab set, a header mismatch, and a claim or repair write failure to one generic unavailable state. It MUST NOT render raw error text, stack traces, cell values, note text, tokens, spreadsheet IDs, or service-account details.

#### Scenario: Any failure is generic
- **WHEN** any listed failure occurs
- **THEN** the user sees the localized data-temporarily-unavailable copy and no raw error, stack trace, cell value, repair note, token, spreadsheet ID, or service-account detail

#### Scenario: Logs contain no cell values
- **WHEN** a failure, invalid row, claim write, or repair write is logged
- **THEN** the log contains only counts, tab names, row numbers, and a fixed reason code, never cell contents, a bank suffix, a claimed date, a repair note, or credentials

### Requirement: No tenant personal information

The system MUST NOT read, cache, log, or display tenant personal information. AppFeed SHALL exclude names, phone numbers, emails, ID numbers, addresses, LINE IDs, full account numbers, and deposit, except for the short repair note, which SHALL be limited and checked for detectable personal data. The last five digits of a sending account SHALL be the only account data stored. The app MUST NOT reference the main rent file's ID, name, or URL in code, environment configuration, or request URLs.

#### Scenario: PII-like value is rejected
- **WHEN** a name, phone number, email address, ID number, or address is entered in a Bills, Leases, or structured Repairs column
- **THEN** validation rejects it and the value is not displayed

#### Scenario: Detectable personal data in a note is rejected
- **WHEN** a repair note contains an email address, a URL, or a run of seven or more digits
- **THEN** the request is rejected and the note is not written or logged

#### Scenario: Only schema columns are read
- **WHEN** the app reads AppFeed
- **THEN** it reads only the fixed ranges and schema columns and never a notes, name, phone, or address column outside the repair note field

#### Scenario: Full account number is never stored
- **WHEN** a tenant tries to report a full bank account number in a claim or repair note
- **THEN** the claim or repair is rejected and the value is not written or logged

#### Scenario: Repair note length is limited
- **WHEN** a repair note is blank, longer than 200 characters, or contains a control character
- **THEN** the request is rejected and no row is appended

#### Scenario: Fixtures and logs are clean
- **WHEN** the test fixtures and runtime logs are inspected
- **THEN** fixtures are synthetic and logs contain no tenant personal information

## ADDED Requirements

### Requirement: Repairs tab schema

The `Repairs` tab SHALL expose exactly the header row `room, request_id, category, note, submitted_on, status, done_on` in that order. It SHALL hold one row per repair request, with room A-E, a unique 16-character lowercase hex request ID, category `plumbing`, `electrical`, `appliance`, or `other`, a short note, an ISO submitted date, status `pending` or `done`, and a blank or ISO done date. Deposit and free-text personal data are excluded.

#### Scenario: Exact Repairs header
- **WHEN** the first row of the Repairs tab is read
- **THEN** it equals the seven header names above, in that order, after trimming surrounding whitespace

#### Scenario: Valid repair row
- **WHEN** a Repairs row has room A, a 16-character hex ID, an allowed category, a valid note, an ISO submitted date, and status `pending`
- **THEN** the row is valid and appears in room A's repair history

#### Scenario: Unique request ID
- **WHEN** two Repairs rows have the same request_id
- **THEN** both rows are invalid

#### Scenario: Status and done date pair
- **WHEN** a Repairs row has status `pending` and a done date, or status `done` and a blank done date
- **THEN** the row is invalid

#### Scenario: Header-only tab
- **WHEN** the Repairs tab has only its header row
- **THEN** the tab is valid and every room's repair history is empty

### Requirement: Strict Repairs row validation

Each Repairs value SHALL be validated: room A-E after trim and uppercase; request_id `^[0-9a-f]{16}$`; category one of the four allowed values; submitted_on a real ISO date; status `pending` or `done`; done_on blank for `pending` and a real ISO date not earlier than submitted_on for `done`; no duplicate request_id. Rows failing any check are invalid. The note SHALL follow the separate note rule.

#### Scenario: Invalid request ID rejected
- **WHEN** a request_id is short, long, uppercase, or contains a non-hex character
- **THEN** the row is invalid

#### Scenario: Invalid category rejected
- **WHEN** a category is not `plumbing`, `electrical`, `appliance`, or `other`
- **THEN** the row is invalid

#### Scenario: Impossible submitted date rejected
- **WHEN** submitted_on contains `2026-02-30` or another non-existent date
- **THEN** the row is invalid

#### Scenario: Done without a date rejected
- **WHEN** a row has status `done` and a blank done_on
- **THEN** the row is invalid

#### Scenario: Pending with a date rejected
- **WHEN** a row has status `pending` and a done_on value
- **THEN** the row is invalid

#### Scenario: Done date before submitted date rejected
- **WHEN** done_on is earlier than submitted_on
- **THEN** the row is invalid

#### Scenario: Valid leap day accepted
- **WHEN** submitted_on or done_on contains `2024-02-29`
- **THEN** the date is accepted as a real calendar date

### Requirement: Repair note content rules

A repair note SHALL contain 1 to 200 printable characters after trimming and MUST NOT contain a control character. The system SHALL reject a note that contains an email address, a URL, or a run of seven or more digits. The form SHALL warn the tenant not to enter names, phone numbers, emails, ID numbers, addresses, or account numbers. The system MUST NOT log the note.

#### Scenario: Blank note rejected
- **WHEN** a note is empty or only whitespace
- **THEN** the request is rejected with a localized message

#### Scenario: Long note rejected
- **WHEN** a note is longer than 200 characters
- **THEN** the request is rejected with a localized message

#### Scenario: Control character rejected
- **WHEN** a note contains a line break, tab, or other control character
- **THEN** the request is rejected with a localized message

#### Scenario: Email address rejected
- **WHEN** a note contains an email address
- **THEN** the request is rejected with a localized message

#### Scenario: URL rejected
- **WHEN** a note contains a URL
- **THEN** the request is rejected with a localized message

#### Scenario: Long digit run rejected
- **WHEN** a note contains seven or more digits in a row
- **THEN** the request is rejected with a localized message

#### Scenario: Valid note accepted
- **WHEN** a note is a short description with no control character, email, URL, or long digit run
- **THEN** the request is accepted

#### Scenario: Warning is shown
- **WHEN** the repair form renders
- **THEN** it shows the localized warning not to enter personal or account data

### Requirement: Repair write boundaries

The system SHALL append one complete row to `Repairs` when a tenant submits a request. It SHALL update only `status` and `done_on` of an existing Repairs row when an admin marks it done. A repair write MUST NOT change `room`, `request_id`, `category`, `note`, or `submitted_on`, and MUST NOT create, delete, reorder, or rename tabs or columns.

#### Scenario: Submit appends one row
- **WHEN** a valid repair request is accepted
- **THEN** the `Repairs` tab gains one row with all seven cells and status `pending`

#### Scenario: Status write changes two cells
- **WHEN** an admin marks a request done
- **THEN** only `status` and `done_on` change on that row

#### Scenario: No other cell changes
- **WHEN** a repair submission or completion is written
- **THEN** `room`, `request_id`, `category`, `note`, and `submitted_on` keep their values

#### Scenario: No structural write
- **WHEN** a repair write request is inspected
- **THEN** it does not create or delete a tab, delete a row, or change a header

#### Scenario: Append failure leaves no partial row
- **WHEN** the append call fails with a timeout, 401, 403, 429, or 5xx
- **THEN** no partial row is written and the tenant sees the generic failure

#### Scenario: Status write failure leaves both cells unchanged
- **WHEN** the status update call fails
- **THEN** both `status` and `done_on` keep their previous values

### Requirement: Repair fail-closed behavior

An invalid Repairs row attributed to room X SHALL make only room X's repair history and submit form unavailable. It MUST NOT make that room's bills, payments, or lease unavailable. Other rooms SHALL be unaffected. A Repairs row whose room cell is not A-E SHALL be dropped and counted. Completely empty rows SHALL be ignored.

#### Scenario: Invalid repair row affects only repairs
- **WHEN** room A has an invalid Repairs row and valid Bills and Leases rows
- **THEN** room A's repair section is unavailable and its bills, payments, and lease still render

#### Scenario: Other rooms are unaffected
- **WHEN** room A has an invalid Repairs row and room B has only valid Repairs rows
- **THEN** room B's repair history renders normally

#### Scenario: Invalid room cell is unattributable
- **WHEN** a Repairs row's room cell is `X`, a name, or a phone number
- **THEN** the row is dropped and counted and no room is made unavailable because of it

#### Scenario: Empty rows are ignored
- **WHEN** a Repairs row has no values in any cell
- **THEN** it is ignored and does not count as invalid

#### Scenario: No partial repair list
- **WHEN** a room has three valid Repairs rows and one invalid row
- **THEN** the repair section does not show the three valid rows; it shows unavailable

### Requirement: Repair projection is narrow and server-only

The system SHALL expose repair data only through server-only accessors. A tenant accessor SHALL accept a validated room letter and return only that room's `request_id`, `category`, `note`, `submitted_on`, `status`, and `done_on`. The admin accessor SHALL accept only an admin session and return only room, `request_id`, `category`, `note`, and `submitted_on` for pending requests. No route, route handler, or Server Action SHALL return full Repair rows.

#### Scenario: Room A receives no other room's repairs
- **WHEN** a fixture feed contains distinct repair values for rooms A-E and room A's repairs are requested
- **THEN** the serialized result contains only room A's repair values and none of room B-E's values

#### Scenario: Admin repair projection is narrow
- **WHEN** an admin loads the pending repair list
- **THEN** each entry holds only room, request ID, category, note, and submitted date, and no done date or other sheet value

#### Scenario: Tenant cannot call the admin accessor
- **WHEN** a tenant session or anonymous request asks for the pending repair list
- **THEN** the system denies access before reading the sheet

#### Scenario: No endpoint returns full repair rows
- **WHEN** the app's routes, route handlers, and Server Actions are inspected
- **THEN** none returns full `Repairs` rows or a full-sheet snapshot to the client

### Requirement: Repair cache is room-scoped

The repair accessor SHALL be cached with `use cache` and keyed by the room letter, with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` and tag `appfeed:repairs:room:<letter>`. Each entry SHALL contain only that room's repair projection. A successful repair submit or completion SHALL invalidate the tag for the affected room.

#### Scenario: Cache key is the room
- **WHEN** room A and room B request their repair histories
- **THEN** they produce separate cache entries and neither entry contains the other room's data

#### Scenario: No all-rooms repair entry
- **WHEN** the cache is inspected after any room request
- **THEN** no entry contains the full `Repairs` tab or another room's rows

#### Scenario: Submit invalidates only its room
- **WHEN** a repair submit succeeds for room A
- **THEN** the room A repair tag is invalidated and room B's entry is unchanged

#### Scenario: Completion invalidates only its room
- **WHEN** an admin marks a room A request done
- **THEN** the room A repair tag is invalidated and room B's entry is unchanged

#### Scenario: Missing tab is not cached as empty
- **WHEN** the `Repairs` tab is absent
- **THEN** the repair section shows unavailable on every load and does not show an empty history
