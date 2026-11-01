# appfeed-data-source Specification

## Purpose

Makes a clean, PII-free Google Sheet named AppFeed the only source of tenant bills, payments, and lease dates, with read-only access, strict validation, room-scoped caching, and explicit unavailable and empty states.

## Requirements

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

### Requirement: Bills tab schema

The `Bills` tab SHALL expose exactly the header row `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5, water_start, water_end, water_rate, electricity_start, electricity_end, electricity_rate, confirmed_on, confirm_note` in that order. It SHALL hold one row per room per billing period, with room A-E, period `YYYY-MM`, whole-NT$ rent, optional whole-NT$ water and electricity, an ISO due date, an optional ISO paid date, optional claim fields, an optional meter group per utility, and optional confirmation fields. A meter group SHALL hold whole-number readings and an NT$ rate with up to four decimal places. A row SHALL have both claim cells empty or both filled. A confirmation date SHALL be set only when both claim cells are filled, and a confirmation note SHALL be set only when a confirmation date is set. Deposit is excluded.

#### Scenario: Exact Bills header
- **WHEN** the first row of the Bills tab is read
- **THEN** it equals the seventeen header names above, in that order, after trimming surrounding whitespace

#### Scenario: Blank versus zero utility charges
- **WHEN** a Bills row has a blank water or electricity cell
- **THEN** that utility is treated as no charge, while a cell containing `0` is treated as a real zero charge

#### Scenario: Duplicate billing period
- **WHEN** two Bills rows have the same room and the same period
- **THEN** both rows are invalid and that room's data is unavailable

#### Scenario: Claim pair is complete
- **WHEN** a Bills row has a claimed date but a blank suffix, or a suffix but a blank claimed date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Meter group is optional
- **WHEN** a Bills row has all six meter cells blank
- **THEN** the row is valid and the bill shows no meter breakdown

#### Scenario: Confirmation needs a claim
- **WHEN** a Bills row has a confirmation date but a blank claimed date or a blank account suffix
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Note needs a confirmation date
- **WHEN** a Bills row has a confirmation note but a blank confirmation date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation date follows the claim
- **WHEN** a Bills row has a confirmation date earlier than its claimed date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation date follows payment
- **WHEN** a Bills row has a confirmation date earlier than its paid date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation fields are optional
- **WHEN** a Bills row has a paid date and blank confirmation fields
- **THEN** the row is valid and the payment appears in payment history

#### Scenario: Intermediate confirmation is valid
- **WHEN** a Bills row has both claim cells set, a confirmation date, and a blank paid date
- **THEN** the row is valid and the claim stays pending until the paid date is set

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

### Requirement: Scoped Google service-account access

The system SHALL authenticate to Google Sheets with a service account using the `https://www.googleapis.com/auth/spreadsheets` scope. Credentials SHALL come only from server-side environment variables and MUST NOT be exposed to the browser, logged, or committed. The service account MUST be shared only with AppFeed as Editor, never with the main rent file.

#### Scenario: Missing or invalid credentials
- **WHEN** a credential environment variable is absent or rejected by Google
- **THEN** the feed is unavailable and no key, token, or credential detail appears in the response or logs

#### Scenario: Service account is not shared the main file
- **WHEN** the Google Drive sharing state is inspected
- **THEN** the service account email appears on AppFeed as Editor and does not appear on the main rent file or any copy of it

### Requirement: Claim write boundaries

The system SHALL write only the `claimed_on` and `bank_last5` cells of an existing Bills row. A claim write MUST NOT create, delete, or reorder rows, tabs, or columns.

#### Scenario: Write scope is limited to claim cells
- **WHEN** the app writes a claim
- **THEN** the request updates only the two claim cells of the matching Bills row

#### Scenario: No structural write
- **WHEN** a claim write request is inspected
- **THEN** it does not create a tab, add a row, or change a header

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

The system SHALL read cell data only from the fixed A1 ranges `Bills!A:Q`, `Leases!A:D`, and, when present, `Repairs!A:H`, and SHALL validate each first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range. A tenant claim write SHALL target only `Bills!H:I`. A claim confirmation SHALL write only `Bills!P:Q` and then `Bills!G` on a row inside the Bills range. A repair status write SHALL target only `Repairs!F:H`. A repair append SHALL target `Repairs!A:H`.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:Q`, `Leases!A:D`, and, when the tab exists, `Repairs!A:H`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the affected tab is unavailable and no rows from it are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data in a column beyond Q on Bills, beyond D on Leases, or beyond H on Repairs
- **THEN** that column is outside the requested range and never reaches the app

#### Scenario: Write stays inside the claim columns
- **WHEN** a tenant writes a claim
- **THEN** the update range is inside `Bills!H:I` and no other column changes

#### Scenario: Confirmation writes stay inside their columns
- **WHEN** an admin confirms a claim
- **THEN** the only update ranges are `Bills!P:Q` and `Bills!G` and no other column changes

#### Scenario: Repair write stays inside the status columns
- **WHEN** a repair request is appended or marked done
- **THEN** the only update ranges are inside `Repairs!A:H` and no other column changes

#### Scenario: No Repairs range when the tab is absent
- **WHEN** the `Repairs` tab is absent
- **THEN** the read request contains only the `Bills` and `Leases` ranges

### Requirement: Strict Bills validation

Each Bills value SHALL be validated: room A-E after trim and uppercase; period `^\d{4}-(0[1-9]|1[0-2])$`; rent, water, and electricity `^\d{1,7}$` after trim, with blank allowed only for water and electricity; due_date and paid_on `^\d{4}-\d{2}-\d{2}$` real calendar dates; claimed_on blank or a real ISO date; bank_last5 blank or `^\d{5}$`; each utility meter group blank or complete with whole-number readings, an NT$ rate matching `^\d{1,4}(\.\d{1,4})?$` and above zero, an end not below its start, and a rounded cost equal to the amount; confirmed_on blank or a real ISO date not earlier than claimed_on or paid_on when those are set; confirm_note blank or a valid note; confirm_note set only with confirmed_on; confirmed_on set only with both claim cells; no duplicate `(room, period)`. Rows failing any check are invalid.

#### Scenario: Formatted amount rejected
- **WHEN** a rent or utility cell contains `$1,000`, `1,000`, a negative number, or a currency word
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Spreadsheet error rejected
- **WHEN** a cell contains `#DIV/0!`, `#N/A`, or another spreadsheet error
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Impossible calendar date rejected
- **WHEN** a due_date, paid_on, claimed_on, or confirmed_on cell contains `2026-02-30` or another non-existent date
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

#### Scenario: Complete meter group accepted
- **WHEN** a utility has a start reading, an end reading, a rate, and an amount equal to `(end - start) x rate`
- **THEN** the row is valid and the bill carries that meter breakdown

#### Scenario: Partial meter group rejected
- **WHEN** a utility has one or two of its start, end, and rate cells blank and the others set
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Cost mismatch rejected
- **WHEN** a meter group is complete but `(end - start) x rate` does not equal the utility amount
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: End reading below start rejected
- **WHEN** a meter group has an end reading lower than its start reading
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Breakdown without an amount rejected
- **WHEN** a meter group is complete and the matching water or electricity amount is blank
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Zero usage with a zero amount accepted
- **WHEN** a meter group has equal start and end readings, a valid rate, and a matching amount of `0`
- **THEN** the row is valid and the breakdown shows zero units

#### Scenario: Confirmation without a claim rejected
- **WHEN** a row has a confirmation date but one or both claim cells are blank
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation note without a date rejected
- **WHEN** a row has a confirmation note but a blank confirmation date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation date before claim rejected
- **WHEN** a row has a confirmation date earlier than its claimed date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Confirmation date before payment rejected
- **WHEN** a row has a confirmation date earlier than its paid date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Invalid confirmation note rejected
- **WHEN** a confirmation note is longer than 200 characters, has a control character, or contains an email, a URL, or seven or more digits in a row
- **THEN** the row is invalid and that room's data is unavailable

### Requirement: Bill meter breakdown projection

The tenant feed SHALL include a water breakdown and an electricity breakdown for each open bill. Each breakdown SHALL hold the start reading, end reading, consumed units, and price per unit, or be null when the row has no meter group. Payment history SHALL keep its existing period, amount, and received date, with no breakdown.

#### Scenario: Breakdown is projected for an open bill
- **WHEN** an open bill row has a complete water meter group
- **THEN** the room feed holds the water start, end, units, and rate for that bill

#### Scenario: Missing meter group projects null
- **WHEN** an open bill row has blank meter cells for a utility
- **THEN** that utility's breakdown is null and the amount still appears

#### Scenario: Payment history has no breakdown
- **WHEN** a bill has a paid_on date and a complete meter group
- **THEN** the payment entry holds only period, amount, and received date

#### Scenario: Breakdown stays inside its room
- **WHEN** rooms A and B have distinct meter values and room A's feed is requested
- **THEN** the serialized result holds only room A's meter values and none of room B's

#### Scenario: Invalid meter group hides the room
- **WHEN** room A has an invalid meter group and room B has only valid rows
- **THEN** room A's feed is unavailable and room B's feed renders normally

#### Scenario: Logs hold no meter values
- **WHEN** an invalid meter group is logged
- **THEN** the log holds only counts, tab names, row numbers, and a fixed reason code, never a reading, rate, or amount

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

### Requirement: Room-scoped server-side projection

The system SHALL expose feed data only through server-only accessors. The tenant accessor SHALL accept a validated room letter, filter rows by exact room on the server before caching or returning, and return a narrow typed projection that includes the room's latest confirmed claim as a date and optional note. The admin claim accessor SHALL accept only an admin session and SHALL return only room, period, claimed_on, and bank_last5 for rows with a claim and no paid_on. No API route, route handler, or Server Action SHALL return full Bill or Lease rows.

#### Scenario: Room A receives no other room's values
- **WHEN** a fixture feed contains distinct sentinel values for rooms A-E and room A's feed is requested
- **THEN** the serialized result contains only room A's sentinels and none of room B-E's sentinels

#### Scenario: Cross-room request is denied before data access
- **WHEN** the tenant of room A requests the room B dashboard
- **THEN** the page denies access and does not call the feed accessor for room B

#### Scenario: Admin claim projection is narrow
- **WHEN** an admin loads the claim list
- **THEN** each entry holds only room, period, claimed date, and suffix, and no rent, utility, lease, paid value, or confirmation value

#### Scenario: No endpoint returns the full feed
- **WHEN** the app's routes, route handlers, and Server Actions are inspected
- **THEN** none returns AppFeed rows or a full-sheet snapshot to the client

#### Scenario: Latest confirmation is projected
- **WHEN** a room has several confirmed bills and more than 12 payments
- **THEN** the tenant feed holds the latest confirmation by confirmation date, including when that bill is outside the 12-payment cap

#### Scenario: Latest confirmation stays in its room
- **WHEN** rooms A and B have confirmed claims and room A's feed is requested
- **THEN** room A's projection holds only room A's latest confirmation and no room B confirmation

### Requirement: Per-room server caching

The accessor SHALL be cached with `use cache` and keyed by the room letter, with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` and tag `appfeed:room:<letter>`. Each cache entry SHALL contain only that room's already-filtered projection; no cache entry may contain another room's rows. A successful claim write or claim confirmation SHALL invalidate the tag for that room.

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

#### Scenario: Confirmation invalidates only its room
- **WHEN** a claim confirmation succeeds for room A
- **THEN** the room A tag is invalidated and room B's entry is unchanged

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

The system SHALL map missing configuration, 401, 403, 429, 5xx, network errors, an 8-second timeout, a wrong title or tab set, a header mismatch, and a claim or repair write failure to one generic unavailable state. It MUST NOT render raw error text, stack traces, cell values, note text, tokens, spreadsheet IDs, or service-account details.

#### Scenario: Any failure is generic
- **WHEN** any listed failure occurs
- **THEN** the user sees the localized data-temporarily-unavailable copy and no raw error, stack trace, cell value, repair note, token, spreadsheet ID, or service-account detail

#### Scenario: Logs contain no cell values
- **WHEN** a failure, invalid row, claim write, or repair write is logged
- **THEN** the log contains only counts, tab names, row numbers, and a fixed reason code, never cell contents, a bank suffix, a claimed date, a repair note, or credentials

### Requirement: No tenant personal information

The system MUST NOT read, cache, log, or display tenant personal information. AppFeed SHALL exclude names, phone numbers, emails, ID numbers, addresses, LINE IDs, full account numbers, and deposit, except for the short repair note, completion note, and confirmation note, which SHALL be limited and checked for detectable personal data. The last five digits of a sending account SHALL be the only account data stored. The app MUST NOT reference the main rent file's ID, name, or URL in code, environment configuration, or request URLs.

#### Scenario: PII-like value is rejected
- **WHEN** a name, phone number, email address, ID number, or address is entered in a Bills, Leases, or structured Repairs column
- **THEN** validation rejects it and the value is not displayed

#### Scenario: Detectable personal data in a note is rejected
- **WHEN** a repair, completion, or confirmation note contains an email address, a URL, or a run of seven or more digits
- **THEN** the request is rejected and the note is not written or logged

#### Scenario: Only schema columns are read
- **WHEN** the app reads AppFeed
- **THEN** it reads only the fixed ranges and schema columns and never a name, phone, address, or other notes column outside the defined note fields

#### Scenario: Full account number is never stored
- **WHEN** a tenant tries to report a full bank account number in a claim or repair note
- **THEN** the claim or repair is rejected and the value is not written or logged

#### Scenario: Repair note length is limited
- **WHEN** a repair note is blank, longer than 200 characters, or contains a control character
- **THEN** the request is rejected and no row is appended

#### Scenario: Completion and confirmation notes are limited
- **WHEN** a completion or confirmation note is longer than 200 characters, has a control character, or contains an email, a URL, or a long digit run
- **THEN** the write is rejected and the note is not stored or logged

#### Scenario: Fixtures and logs are clean
- **WHEN** the test fixtures and runtime logs are inspected
- **THEN** fixtures are synthetic and logs contain no tenant personal information

### Requirement: Repairs tab schema

The `Repairs` tab SHALL expose exactly the header row `room, request_id, category, note, submitted_on, status, done_on, done_note` in that order. It SHALL hold one row per repair request, with room A-E, a unique 16-character lowercase hex request ID, category `plumbing`, `electrical`, `appliance`, or `other`, a short note, an ISO submitted date, status `pending` or `done`, a blank or ISO done date, and an optional completion note. A pending row SHALL have a blank completion note. Deposit and free-text personal data are excluded.

#### Scenario: Exact Repairs header
- **WHEN** the first row of the Repairs tab is read
- **THEN** it equals the eight header names above, in that order, after trimming surrounding whitespace

#### Scenario: Valid repair row
- **WHEN** a Repairs row has room A, a 16-character hex ID, an allowed category, a valid note, an ISO submitted date, and status `pending`
- **THEN** the row is valid and appears in room A's repair history

#### Scenario: Unique request ID
- **WHEN** two Repairs rows have the same request_id
- **THEN** both rows are invalid

#### Scenario: Status and done date pair
- **WHEN** a Repairs row has status `pending` and a done date, or status `done` and a blank done date
- **THEN** the row is invalid

#### Scenario: Pending row has no completion note
- **WHEN** a Repairs row has status `pending` and a completion note
- **THEN** the row is invalid

#### Scenario: Done row may have a note
- **WHEN** a Repairs row has status `done`, a done date, and a valid completion note
- **THEN** the row is valid

#### Scenario: Header-only tab
- **WHEN** the Repairs tab has only its header row
- **THEN** the tab is valid and every room's repair history is empty

### Requirement: Strict Repairs row validation

Each Repairs value SHALL be validated: room A-E after trim and uppercase; request_id `^[0-9a-f]{16}$`; category one of the four allowed values; submitted_on a real ISO date; status `pending` or `done`; done_on blank for `pending` and a real ISO date not earlier than submitted_on for `done`; done_note blank for `pending` and blank or a valid note for `done`; no duplicate request_id. Rows failing any check are invalid. The repair note SHALL follow its separate note rule.

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

#### Scenario: Invalid completion note rejected
- **WHEN** a done_note is longer than 200 characters, has a control character, or contains an email, a URL, or seven or more digits in a row
- **THEN** the row is invalid

#### Scenario: Pending completion note rejected
- **WHEN** a pending row has a done_note value
- **THEN** the row is invalid

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

The system SHALL append one complete row to `Repairs` when a tenant submits a request. It SHALL update only `status`, `done_on`, and `done_note` of an existing Repairs row when an admin marks it done. A repair write MUST NOT change `room`, `request_id`, `category`, `note`, or `submitted_on`, and MUST NOT create, delete, reorder, or rename tabs or columns.

#### Scenario: Submit appends one row
- **WHEN** a valid repair request is accepted
- **THEN** the `Repairs` tab gains one row with all eight cells, status `pending`, and a blank completion note

#### Scenario: Status write changes two cells
- **WHEN** an admin marks a request done without a note
- **THEN** only `status` and `done_on` change on that row

#### Scenario: Completion note is written
- **WHEN** an admin marks a request done with a note
- **THEN** `status`, `done_on`, and `done_note` change on that row

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
- **THEN** `status` and `done_on` keep their previous values, and `done_note` is not written

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

The system SHALL expose repair data only through server-only accessors. A tenant accessor SHALL accept a validated room letter and return only that room's `request_id`, `category`, `note`, `submitted_on`, `status`, `done_on`, and the latest completion as a date and optional note. The admin accessor SHALL accept only an admin session and return only room, `request_id`, `category`, `note`, and `submitted_on` for pending requests. No route, route handler, or Server Action SHALL return full Repair rows.

#### Scenario: Room A receives no other room's repairs
- **WHEN** a fixture feed contains distinct repair values for rooms A-E and room A's repairs are requested
- **THEN** the serialized result contains only room A's repair values and none of room B-E's values

#### Scenario: Admin repair projection is narrow
- **WHEN** an admin loads the pending repair list
- **THEN** each entry holds only room, request ID, category, note, and submitted date, and no done date, completion note, or other sheet value

#### Scenario: Tenant cannot call the admin accessor
- **WHEN** a tenant session or anonymous request asks for the pending repair list
- **THEN** the system denies access before reading the sheet

#### Scenario: No endpoint returns full repair rows
- **WHEN** the app's routes, route handlers, and Server Actions are inspected
- **THEN** none returns full `Repairs` rows or a full-sheet snapshot to the client

#### Scenario: Latest completion is projected
- **WHEN** a room has more than 20 repairs and its latest done repair is outside the 20-item history
- **THEN** the tenant repair result holds that latest completion date and note

#### Scenario: Latest completion stays in its room
- **WHEN** rooms A and B have done repairs and room A's repairs are requested
- **THEN** room A's result holds only room A's latest completion and no room B completion

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

### Requirement: Claim confirmation write boundaries

The system SHALL write a claim confirmation to only `Bills!P:Q` and `Bills!G` of an existing row. It SHALL write the confirmation date and note first, then the paid date. A failed second write SHALL leave the claim pending. A confirmation write MUST NOT create, delete, or reorder rows, tabs, or columns.

#### Scenario: Confirmation writes in safe order
- **WHEN** the app confirms a pending claim
- **THEN** it first writes `Bills!P:Q` with the confirmation date and note, then writes `Bills!G` with the paid date

#### Scenario: First write failure changes nothing
- **WHEN** the `Bills!P:Q` write fails
- **THEN** the paid date, confirmation date, and note keep their previous values

#### Scenario: Second write failure keeps the claim pending
- **WHEN** the `Bills!P:Q` write succeeds and the `Bills!G` write fails
- **THEN** the paid date stays blank, the claim stays in the pending list, and the tenant line shows no confirmation

#### Scenario: Retry overwrites the hidden confirmation
- **WHEN** an admin retries a confirmation after a second-write failure
- **THEN** the app overwrites `Bills!P:Q` and writes `Bills!G` on the same row

#### Scenario: No structural write
- **WHEN** a confirmation write request is inspected
- **THEN** it does not create a tab, add a row, delete a row, or change a header
