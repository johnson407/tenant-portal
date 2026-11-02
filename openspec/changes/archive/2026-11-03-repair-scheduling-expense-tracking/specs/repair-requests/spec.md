# Spec Delta

## MODIFIED Requirements

### Requirement: Tenant repair history

The room dashboard SHALL list the room's repair requests with category, note, submitted date, status, planned visit window when set, and done date. It SHALL show active requests before done requests and SHALL show at most 20 requests. It SHALL show a localized empty state when the room has no requests. It MUST NOT show another room's request or an expense amount.

#### Scenario: Active requests come first
- **WHEN** a room has active and done requests
- **THEN** active requests appear before done requests, with the newest active request first

#### Scenario: Pending requests come first
- **WHEN** a room has pending and done requests
- **THEN** pending requests appear before done requests

#### Scenario: Planned visit window is shown
- **WHEN** a request has a planned visit start and end
- **THEN** the history shows the localized visit window in the active locale's date and time format

#### Scenario: No visit window is set
- **WHEN** a request has no planned visit window
- **THEN** the history shows no visit date or time

#### Scenario: Done request shows its date
- **WHEN** a request has status `done` and a `done_on` date
- **THEN** the history shows the localized done status and the completion date

#### Scenario: Empty history
- **WHEN** the room has no repair requests
- **THEN** the section shows the localized empty state, not an error

#### Scenario: History is capped
- **WHEN** the room has more than 20 repair requests
- **THEN** the history shows at most 20, with active requests first

#### Scenario: Other room is excluded
- **WHEN** room B has a repair request and room A loads its dashboard
- **THEN** room A's history contains no room B request

#### Scenario: Expense is hidden from the tenant
- **WHEN** a tenant views a repair with a recorded expense amount
- **THEN** the dashboard and its serialized data contain no expense amount

### Requirement: Admin pending repair queue

An authenticated admin SHALL see all active repair requests across rooms, with room, category, note, submitted date, status, and planned visit window when set. The admin SHALL be able to update an active request's status and visit window. The list MUST exclude done requests and MUST NOT be available to a tenant or anonymous request. It SHALL show a localized empty state when no active request exists.

#### Scenario: Admin sees active repairs
- **WHEN** an admin opens the console while pending, scheduled, or in-progress repairs exist
- **THEN** the console lists each active repair with its room, category, note, submitted date, status, and visit window when set

#### Scenario: Admin sees pending repairs
- **WHEN** an admin opens the console while repair requests are pending
- **THEN** the console lists each pending request with its room, category, note, and submitted date

#### Scenario: Admin changes status and visit window
- **WHEN** an admin saves a valid status and visit window for an active repair
- **THEN** the repair history shows the saved values on the next load

#### Scenario: Done repairs leave the active queue
- **WHEN** an active repair is marked done
- **THEN** the next admin load excludes it from the active queue

#### Scenario: Done requests leave the queue
- **WHEN** a listed request is marked done
- **THEN** the next admin load no longer lists it as active

#### Scenario: Tenant cannot read the queue
- **WHEN** a tenant session or anonymous request asks for the admin repair list
- **THEN** the system denies access and returns no repair value

#### Scenario: No active repairs
- **WHEN** no repair has status `pending`, `scheduled`, or `in_progress`
- **THEN** the admin console shows a localized empty state, not an error

#### Scenario: No pending repairs
- **WHEN** no request is pending
- **THEN** the admin console shows a localized empty state, not an error

#### Scenario: Repair list is unavailable
- **WHEN** the `Repairs` tab cannot be read or has an invalid row
- **THEN** the admin repair section shows a localized unavailable state and the other admin sections remain usable

### Requirement: Admin repair completion

An authenticated admin SHALL mark a pending, scheduled, or in-progress repair done. The system SHALL set `status` to `done`, `done_on` to the current date in Asia/Taipei, and an optional `done_note`, in one write after a fresh read. The note SHALL be blank or 1 to 200 printable characters and MUST NOT contain a control character, an email, a URL, or seven or more digits. It MUST reject an unknown request, an already done request, an unauthenticated request, and an invalid note. A failed write MUST leave the row unchanged.

#### Scenario: Admin marks an active request done
- **WHEN** an admin marks a pending, scheduled, or in-progress request done without a note
- **THEN** the row holds status `done`, the current Asia/Taipei date in `done_on`, and a blank `done_note`

#### Scenario: Admin marks a request done
- **WHEN** an admin marks a pending request done without a note
- **THEN** the row holds status `done`, the current Asia/Taipei date in `done_on`, and a blank `done_note`

#### Scenario: Admin adds a completion note
- **WHEN** an admin marks an active request done with a valid note
- **THEN** the row holds status `done`, the completion date, and the note

#### Scenario: Invalid completion note rejected
- **WHEN** an admin submits a note longer than 200 characters, with a control character, an email, a URL, or seven or more digits in a row
- **THEN** the system rejects the action with a localized message and leaves the row unchanged

#### Scenario: Already done request is rejected
- **WHEN** an admin marks a request that already has status `done`
- **THEN** the system rejects the action and leaves the row unchanged

#### Scenario: Unknown request is rejected
- **WHEN** an admin marks a request ID that is not in the `Repairs` tab
- **THEN** the system rejects the action, appends no row, and changes no cell

#### Scenario: Tenant cannot mark a request done
- **WHEN** a tenant session or anonymous request attempts a completion
- **THEN** the system denies the action without writing the sheet

#### Scenario: Completion write failure is generic
- **WHEN** the status write fails with a timeout, 401, 403, 429, or 5xx
- **THEN** the admin sees the generic failure and the row keeps its previous status and values

#### Scenario: Fresh read failure blocks the write
- **WHEN** the app cannot read the current `Repairs` row before writing
- **THEN** the completion is not written and the admin sees the generic failure

#### Scenario: Completion form works without JavaScript
- **WHEN** an admin disables client-side JavaScript and submits a completion
- **THEN** the action runs, the page reloads, and the request leaves the active queue

### Requirement: Repair confidentiality

The system MUST NOT log a repair note, a completion note, an expense amount, a category, a request ID, or a date. Repair notes and completion notes SHALL be readable only by the owning tenant and an admin session. Expense amounts SHALL be readable only by an admin session. Repair values MUST NOT appear in another room's cache entry, page metadata, or any unauthenticated response.

#### Scenario: Logs stay free of repair values
- **WHEN** a repair read or write fails
- **THEN** the log contains only a fixed reason code and counts, never a note, completion note, expense amount, category, request ID, or date

#### Scenario: Other rooms are excluded
- **WHEN** room A has a repair request and room B loads its dashboard or feed
- **THEN** room B's response, cache entry, and page metadata contain no room A repair value

#### Scenario: Other rooms cannot read the request
- **WHEN** room A has a repair request and room B loads its dashboard
- **THEN** room B's response, cache entry, and page metadata contain no room A repair value

#### Scenario: Completion note stays private
- **WHEN** room A has a completion note and room B loads its dashboard or feed
- **THEN** room B's response, cache entry, and page metadata contain no room A completion note

#### Scenario: Expense is admin-only
- **WHEN** a tenant or anonymous visitor requests repair data
- **THEN** no expense amount is included in the response, projection, cache entry, or page metadata

#### Scenario: Metadata is clean
- **WHEN** any dashboard or admin page renders
- **THEN** the document metadata contains no repair note, completion note, expense amount, or request ID

### Requirement: Repair status presentation

Each repair request SHALL show a localized `pending`, `scheduled`, `in_progress`, or `done` status. The status MUST NOT rely on colour alone. A done request SHALL show its completion date. A set visit window SHALL appear with its localized label and date and time.

#### Scenario: Pending status
- **WHEN** a request has status `pending`
- **THEN** the history and admin queue show the localized pending label

#### Scenario: Scheduled status
- **WHEN** a request has status `scheduled`
- **THEN** the history and admin queue show the localized scheduled label

#### Scenario: In-progress status
- **WHEN** a request has status `in_progress`
- **THEN** the history and admin queue show the localized in-progress label

#### Scenario: Done status
- **WHEN** a request has status `done`
- **THEN** the history shows the localized done label and the completion date

#### Scenario: Both locales
- **WHEN** the dashboard or admin console renders in `zh-TW` or `en`
- **THEN** every repair label, status, and visit time uses that locale's dictionary and formatting

### Requirement: No edit or reopen

A tenant MUST NOT change the category, note, or submitted date of a submitted request. An admin MUST NOT change those fields, reopen a done request, change a completion note after completion, or delete a request. An admin MAY update an active request's status and visit window, and MAY add or replace its expense amount after completion. A second completion attempt SHALL be rejected.

#### Scenario: Tenant cannot edit a request
- **WHEN** a tenant submits a change to an existing request
- **THEN** the system rejects the change and leaves the row unchanged

#### Scenario: Admin cannot change original request fields
- **WHEN** an admin attempts to change a request's room, category, note, or submitted date
- **THEN** the system rejects the change and leaves those fields unchanged

#### Scenario: Admin cannot reopen a request
- **WHEN** an admin attempts to move a done request to an active status
- **THEN** the system rejects the change and leaves the row unchanged

#### Scenario: Admin cannot change a completion note
- **WHEN** an admin attempts to replace or clear a stored completion note
- **THEN** the system rejects the action and leaves the note unchanged

#### Scenario: Expense can be recorded after completion
- **WHEN** an admin records or updates the expense amount for a done request
- **THEN** only that request's expense amount changes

#### Scenario: No delete control
- **WHEN** the tenant or admin views a request
- **THEN** no delete control is present and no delete request is accepted

## ADDED Requirements

### Requirement: Repair visit window

An admin SHALL set or clear a planned visit window on an active repair. A window SHALL contain a start and end time in Asia/Taipei, with the start earlier than the end. The tenant dashboard SHALL show the window for the owning room only.

#### Scenario: Admin schedules a visit
- **WHEN** an admin saves a valid start and end time for an active repair
- **THEN** the room's repair history shows that visit window

#### Scenario: Admin changes a visit window
- **WHEN** an admin changes the planned time for an active repair
- **THEN** the new window appears in the tenant history on the next load

#### Scenario: Admin clears a visit window
- **WHEN** an admin clears both visit times for an active repair
- **THEN** the tenant history shows no visit window

#### Scenario: Partial or invalid window is rejected
- **WHEN** an admin submits only one time or submits an end time that is not after the start
- **THEN** the system rejects the update and leaves the saved window unchanged

#### Scenario: Tenant cannot change a visit window
- **WHEN** a tenant submits a visit time update
- **THEN** the system rejects it and leaves the saved window unchanged

### Requirement: Admin repair history and expenses

An authenticated admin SHALL be able to view completed repairs and record or update one optional whole-NT$ expense amount for each repair. A blank amount means no amount has been recorded. The admin console SHALL show the sum of all recorded amounts and MUST NOT show expense data to tenants.

#### Scenario: Admin views completed repairs
- **WHEN** an admin opens repair management with completed requests
- **THEN** the console lists completed requests with their room, category, completion date, and saved expense amount when present

#### Scenario: Admin records an expense later
- **WHEN** an admin saves a valid amount for a completed repair with no amount
- **THEN** that repair stores and displays the amount

#### Scenario: Admin updates an expense
- **WHEN** an admin changes a saved amount for a completed repair
- **THEN** the repair shows the new amount and the total uses the new amount

#### Scenario: Invalid expense is rejected
- **WHEN** an admin submits a negative, fractional, or non-numeric amount
- **THEN** the system rejects the update and leaves the saved amount unchanged

#### Scenario: Expense total includes recorded amounts
- **WHEN** the admin console shows repair expenses
- **THEN** the total equals the sum of every recorded expense amount, including zero, and excludes blank amounts

#### Scenario: Expense total is unavailable
- **WHEN** the repair data cannot be read or validated
- **THEN** the admin console shows an unavailable state instead of a partial expense total

#### Scenario: Tenant cannot read or write expenses
- **WHEN** a tenant or anonymous request attempts to read or change an expense amount
- **THEN** the system denies the request and returns or writes no amount
