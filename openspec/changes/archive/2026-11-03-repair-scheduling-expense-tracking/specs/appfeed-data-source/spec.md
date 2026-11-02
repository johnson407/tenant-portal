# Spec Delta

## MODIFIED Requirements

### Requirement: Repairs tab schema

The `Repairs` tab SHALL expose exactly the header row `room, request_id, category, note, submitted_on, status, done_on, done_note, visit_start, visit_end, expense_amount` in that order. It SHALL hold one row per repair request, with room A-E, a unique 16-character lowercase hex request ID, an allowed category, a short note, an ISO submitted date, status `pending`, `scheduled`, `in_progress`, or `done`, an optional complete visit window, a blank or ISO done date, an optional completion note, and an optional whole-NT$ expense amount. Expense amounts are admin-only. Deposit and free-text personal data are excluded.

#### Scenario: Exact Repairs header
- **WHEN** the first row of the Repairs tab is read
- **THEN** it equals the eleven header names above, in that order, after trimming surrounding whitespace

#### Scenario: Valid repair row
- **WHEN** a Repairs row has valid request fields and status `pending`
- **THEN** the row is valid and appears in the room's repair history

#### Scenario: Unique request ID
- **WHEN** two Repairs rows have the same request_id
- **THEN** both rows are invalid

#### Scenario: Status and done date pair
- **WHEN** a Repairs row has status other than `done` with a done date, or status `done` with a blank done date
- **THEN** the row is invalid

#### Scenario: Scheduled row has a visit window
- **WHEN** a Repairs row has status `scheduled` and no complete visit window
- **THEN** the row is invalid

#### Scenario: Visit window is complete or blank
- **WHEN** only one of visit_start and visit_end is set, or the end is not after the start
- **THEN** the row is invalid

#### Scenario: Pending row has no completion note
- **WHEN** a Repairs row is not done and has a completion note
- **THEN** the row is invalid

#### Scenario: Done row may have a note
- **WHEN** a Repairs row has status `done`, a done date, and a valid completion note
- **THEN** the row is valid

#### Scenario: Expense is optional
- **WHEN** a Repairs row has a blank expense_amount
- **THEN** the row is valid and no expense is included in the admin total

#### Scenario: Zero expense is a recorded amount
- **WHEN** a Repairs row has expense_amount `0`
- **THEN** the row is valid and zero is included as a recorded amount

#### Scenario: Header-only tab
- **WHEN** the Repairs tab has only its header row
- **THEN** the tab is valid and every room's repair history is empty

### Requirement: Fixed ranges and header allow-list

The system SHALL read cell data only from `Bills!A:Q`, `Leases!A:D`, and, when present, `Repairs!A:K`, and SHALL validate each first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range. A tenant claim write SHALL target only `Bills!H:I`. A claim confirmation SHALL write only `Bills!P:Q` and then `Bills!G`. Repair writes SHALL target only `Repairs!A:K`.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:Q`, `Leases!A:D`, and, when present, `Repairs!A:K`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the affected tab is unavailable and no rows from it are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data beyond Q on Bills, beyond D on Leases, or beyond K on Repairs
- **THEN** that data is outside the requested ranges and never reaches the app

#### Scenario: Write stays inside the claim columns
- **WHEN** a tenant writes a claim
- **THEN** the update range is inside `Bills!H:I` and no other column changes

#### Scenario: Confirmation writes stay inside their columns
- **WHEN** an admin confirms a claim
- **THEN** the only update ranges are `Bills!P:Q` and `Bills!G`

#### Scenario: Repair writes stay inside the Repairs row
- **WHEN** a tenant submits a repair or an admin updates its status, visit window, completion, or expense
- **THEN** the write changes only the intended cells in that request's `Repairs!A:K` row

#### Scenario: Repair write stays inside the status columns
- **WHEN** an admin updates a repair
- **THEN** the write stays inside the status, completion, visit, or expense cells of that Repairs row

#### Scenario: No Repairs range when the tab is absent
- **WHEN** the `Repairs` tab is absent
- **THEN** the read request contains only the `Bills` and `Leases` ranges

### Requirement: Strict Repairs row validation

Each Repairs value SHALL be validated: room A-E; request_id `^[0-9a-f]{16}$`; category one of the four allowed values; submitted_on a real ISO date; status one of `pending`, `scheduled`, `in_progress`, or `done`; done_on blank unless status is `done`, and a real date not earlier than submitted_on when set; done_note blank unless status is `done`, and otherwise blank or a valid note; visit_start and visit_end both blank or both valid Asia/Taipei timestamps with start before end; a scheduled row SHALL have a visit window; expense_amount blank or a whole non-negative NT$ integer; no duplicate request_id. Rows failing any check are invalid.

#### Scenario: Invalid request ID rejected
- **WHEN** a request_id is short, long, uppercase, or contains a non-hex character
- **THEN** the row is invalid

#### Scenario: Invalid category rejected
- **WHEN** a category is not `plumbing`, `electrical`, `appliance`, or `other`
- **THEN** the row is invalid

#### Scenario: Invalid status rejected
- **WHEN** status is not `pending`, `scheduled`, `in_progress`, or `done`
- **THEN** the row is invalid

#### Scenario: Impossible submitted date rejected
- **WHEN** submitted_on contains `2026-02-30` or another non-existent date
- **THEN** the row is invalid

#### Scenario: Done without a date rejected
- **WHEN** a row has status `done` and a blank done_on
- **THEN** the row is invalid

#### Scenario: Non-done row with completion date rejected
- **WHEN** a row has a non-done status and a done_on value
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

#### Scenario: Non-done completion note rejected
- **WHEN** a non-done row has a done_note value
- **THEN** the row is invalid

#### Scenario: Pending completion note rejected
- **WHEN** a pending row has a done_note value
- **THEN** the row is invalid

#### Scenario: Scheduled row without a window rejected
- **WHEN** a row has status `scheduled` and either visit time is blank
- **THEN** the row is invalid

#### Scenario: Partial or reversed visit window rejected
- **WHEN** only one visit time is set or visit_end is not after visit_start
- **THEN** the row is invalid

#### Scenario: Invalid visit timestamp rejected
- **WHEN** a visit time is not a real date and time with the Asia/Taipei offset
- **THEN** the row is invalid

#### Scenario: Invalid expense rejected
- **WHEN** expense_amount is negative, fractional, formatted with separators, or not numeric
- **THEN** the row is invalid

### Requirement: Repair write boundaries

The system SHALL append one complete row to `Repairs` when a tenant submits a request. An admin SHALL update only lifecycle fields, visit times, completion fields, or expense_amount on an existing row. A repair write MUST NOT change the room, request ID, category, note, or submitted date, and MUST NOT create, delete, reorder, or rename tabs or columns.

#### Scenario: Submit appends one row
- **WHEN** a valid repair request is accepted
- **THEN** the `Repairs` tab gains one complete row with status `pending`, blank completion fields, blank visit times, and blank expense_amount

#### Scenario: Status and visit update changes only those fields
- **WHEN** an admin updates an active repair's status or visit window
- **THEN** only `status`, `visit_start`, and `visit_end` change on that row

#### Scenario: Status write changes two cells
- **WHEN** an admin marks a request done without a note
- **THEN** only the status and done date change on that row

#### Scenario: Completion changes completion fields
- **WHEN** an admin marks an active repair done
- **THEN** only `status`, `done_on`, and `done_note` change, in one row update

#### Scenario: Completion note is written
- **WHEN** an admin marks a request done with a note
- **THEN** status, done date, and completion note change on that row

#### Scenario: Expense update changes one cell
- **WHEN** an admin records or changes an expense amount
- **THEN** only `expense_amount` changes on that row

#### Scenario: Original request fields stay unchanged
- **WHEN** a repair submission or admin update is written
- **THEN** room, request_id, category, note, and submitted_on keep their values

#### Scenario: No other cell changes
- **WHEN** a repair submission or completion is written
- **THEN** the room, request ID, category, note, and submitted date keep their values

#### Scenario: No structural write
- **WHEN** a repair write request is inspected
- **THEN** it does not create or delete a tab, delete a row, or change a header

#### Scenario: Append failure leaves no partial row
- **WHEN** the append call fails
- **THEN** no partial row is written and the tenant sees the generic failure

#### Scenario: Update failure leaves row unchanged
- **WHEN** an admin repair update fails
- **THEN** the row keeps all previous values and the admin sees a generic failure

#### Scenario: Status write failure leaves both cells unchanged
- **WHEN** a status update fails
- **THEN** the status and done date keep their previous values, and the completion note is not written

### Requirement: Repair projection is narrow and server-only

The system SHALL expose repair data only through server-only accessors. A tenant accessor SHALL return only the owning room's request ID, category, note, submitted date, status, visit window, done date, and latest completion date and note. An admin accessor SHALL require an admin session and return only fields needed to manage repairs and calculate the expense total. Expense amounts MUST NOT enter tenant projections. No route, route handler, or Server Action SHALL return full Repair rows.

#### Scenario: Room A receives no other room's repairs
- **WHEN** a fixture feed contains distinct repair values for rooms A-E and room A's repairs are requested
- **THEN** the serialized result contains only room A's repair values and none of room B-E's values

#### Scenario: Tenant projection excludes expense
- **WHEN** a tenant loads the repair history for their room
- **THEN** the projection and response contain no expense amount

#### Scenario: Admin projection supports repair management
- **WHEN** an admin loads repair management
- **THEN** the projection contains lifecycle fields, visit times, and expense amounts for use by the admin page

#### Scenario: Admin repair projection is narrow
- **WHEN** an admin loads the repair list
- **THEN** each entry contains only repair fields needed by the admin view and no unrelated AppFeed values

#### Scenario: Tenant cannot call the admin accessor
- **WHEN** a tenant session or anonymous request asks for the admin repair list
- **THEN** the system denies access before returning repair values

#### Scenario: No endpoint returns full repair rows
- **WHEN** routes, route handlers, and Server Actions are inspected
- **THEN** none returns raw `Repairs` rows or a full-sheet snapshot to the client

#### Scenario: Latest completion stays in its room
- **WHEN** rooms A and B have done repairs and room A's repairs are requested
- **THEN** room A's result holds only room A's latest completion and no room B completion

#### Scenario: Latest completion is projected
- **WHEN** a room has more than 20 repairs and its latest done repair is outside the 20-item history
- **THEN** the tenant repair result holds that latest completion date and note

### Requirement: Repair cache is room-scoped

The repair accessor SHALL use a cache entry for one room only. A successful repair submit or admin update SHALL invalidate the tag for the affected room. The admin expense total SHALL use a fresh, validated admin projection.

#### Scenario: Cache key is the room
- **WHEN** room A and room B request their repair histories
- **THEN** they produce separate cache entries and neither entry contains the other room's data

#### Scenario: No all-rooms repair entry
- **WHEN** the cache is inspected after any room request
- **THEN** no entry contains the full `Repairs` tab or another room's rows

#### Scenario: Submit invalidates only its room
- **WHEN** a repair submit succeeds for room A
- **THEN** the room A repair tag is invalidated and room B's entry is unchanged

#### Scenario: Admin update invalidates the affected room
- **WHEN** an admin changes status, visit timing, completion, or expense for room A
- **THEN** the room A repair tag is invalidated and room B's entry is unchanged

#### Scenario: Completion invalidates only its room
- **WHEN** an admin marks a room A request done
- **THEN** the room A repair tag is invalidated and room B's entry is unchanged

#### Scenario: Missing tab is not cached as empty
- **WHEN** the `Repairs` tab is absent
- **THEN** the repair section shows unavailable on every load and does not show an empty history
