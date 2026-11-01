# Spec Delta

## Purpose

Lets a tenant report a repair for their own room, and lets the landlord review pending repairs and mark them done.

## ADDED Requirements

### Requirement: Tenant repair submission

An authenticated tenant SHALL submit a repair request only for the session's room. The request SHALL hold a category and a short note. The system MUST generate the request ID, submitted date, and initial `pending` status on the server. It MUST reject an unauthenticated request, another room, an invalid category or note, and a missing or unreadable `Repairs` tab.

#### Scenario: Tenant submits a repair request
- **WHEN** the tenant of room A submits a valid category and note
- **THEN** one pending row is appended for room A and the request appears in that room's history

#### Scenario: Another room's request is denied
- **WHEN** the tenant of room A submits a repair request for room B
- **THEN** the system denies the request and appends no row

#### Scenario: Anonymous request is denied
- **WHEN** a request without a valid tenant session attempts a repair submission
- **THEN** the system denies the request without reading or writing the sheet

#### Scenario: Stale tenant session is denied
- **WHEN** the tenant session version does not match the room's current version
- **THEN** the system denies the request and appends no row

#### Scenario: Invalid category is rejected
- **WHEN** the tenant submits a category outside `plumbing`, `electrical`, `appliance`, and `other`
- **THEN** the system rejects the request with a localized message and appends no row

#### Scenario: Invalid note is rejected
- **WHEN** the tenant submits a blank note, a note over 200 characters, or a note with a control character
- **THEN** the system rejects the request with a localized message and appends no row

#### Scenario: Missing tab rejects the submission
- **WHEN** the `Repairs` tab is absent or unreadable
- **THEN** the system rejects the request with the generic localized unavailable copy and appends no row

### Requirement: Repair form availability

The system SHALL show the repair form only when the tenant is authorized for the room and the `Repairs` tab is readable. When the tab is missing, invalid, or unreachable, the system SHALL hide the form and show a localized unavailable state. The form MUST submit without client-side JavaScript.

#### Scenario: Authorized tenant sees the form
- **WHEN** the tenant of room A opens the dashboard and the `Repairs` tab is readable
- **THEN** the repair form shows the category field, the note field, and the submit control

#### Scenario: Missing tab hides the form
- **WHEN** the `Repairs` tab is absent while the tenant is authorized
- **THEN** the repair section shows the localized unavailable state and no form

#### Scenario: Form submits without JavaScript
- **WHEN** the tenant disables client-side JavaScript and submits a valid repair request
- **THEN** the action runs, the page reloads, and the request appears in the room history

### Requirement: Tenant repair history

The room dashboard SHALL list the room's repair requests with category, note, submitted date, status, and done date. It SHALL show pending requests before done requests and SHALL show at most 20 requests. It SHALL show a localized empty state when the room has no requests. It MUST NOT show another room's request.

#### Scenario: Pending requests come first
- **WHEN** a room has both pending and done requests
- **THEN** the pending requests appear before the done requests

#### Scenario: Done request shows its date
- **WHEN** a request has status `done` and a `done_on` date
- **THEN** the history shows the localized done status and the completion date

#### Scenario: Empty history
- **WHEN** the room has no repair requests
- **THEN** the section shows the localized empty state, not an error

#### Scenario: History is capped
- **WHEN** the room has more than 20 repair requests
- **THEN** the history shows at most 20, with pending requests first

#### Scenario: Other room is excluded
- **WHEN** room B has a repair request and room A loads its dashboard
- **THEN** room A's history contains no room B request

### Requirement: Repair submission rate limit

The system SHALL limit repair submissions per room and client IP. It SHALL reject excess attempts with a generic localized message. If the counter store is unavailable, the system SHALL fail closed and reject the submission.

#### Scenario: Submission limit exceeded
- **WHEN** a room and client IP exceed the allowed number of repair submissions in the window
- **THEN** further submissions are rejected with a generic message and no row is appended

#### Scenario: Counter store unavailable
- **WHEN** the rate-limit store cannot be reached
- **THEN** the submission is rejected and no row is appended

### Requirement: Admin pending repair queue

An authenticated admin SHALL see a list of pending repair requests across all rooms. Each entry SHALL show the room, category, note, and submitted date. The list MUST exclude done requests and MUST NOT be available to a tenant or anonymous request. It SHALL show a localized empty state when no request is pending.

#### Scenario: Admin sees pending repairs
- **WHEN** an admin opens the admin console while repair requests are pending
- **THEN** the console lists each pending request with room, category, note, and submitted date

#### Scenario: Done requests leave the queue
- **WHEN** a listed request is marked done
- **THEN** the next admin load no longer lists it

#### Scenario: Tenant cannot read the queue
- **WHEN** a tenant session or anonymous request asks for the pending repair list
- **THEN** the system denies access and returns no request value

#### Scenario: No pending repairs
- **WHEN** no repair request has status `pending`
- **THEN** the admin console shows a localized empty state, not an error

#### Scenario: Repair list is unavailable
- **WHEN** the `Repairs` tab cannot be read or has an invalid row
- **THEN** the admin repair section shows a localized unavailable state and the other admin sections remain usable

### Requirement: Admin repair completion

An authenticated admin SHALL mark a pending repair request done. The system SHALL set `status` to `done` and `done_on` to the current date in Asia/Taipei in one write, after a fresh read. It MUST reject an unknown request, a request that is already done, and an unauthenticated request. A failed write MUST leave the row unchanged.

#### Scenario: Admin marks a request done
- **WHEN** an admin marks a pending request done
- **THEN** the row holds status `done` and the current Asia/Taipei date in `done_on`

#### Scenario: Already done request is rejected
- **WHEN** an admin marks a request that already has status `done`
- **THEN** the system rejects the action and leaves the row unchanged

#### Scenario: Unknown request is rejected
- **WHEN** an admin marks a request ID that is not in the `Repairs` tab
- **THEN** the system rejects the action, appends no row, and changes no cell

#### Scenario: Tenant cannot mark a request done
- **WHEN** a tenant session or anonymous request attempts a completion
- **THEN** the system denies the request without writing the sheet

#### Scenario: Completion write failure is generic
- **WHEN** the status write fails with a timeout, 401, 403, 429, or 5xx
- **THEN** the admin sees the generic failure and the row keeps status `pending`

#### Scenario: Fresh read failure blocks the write
- **WHEN** the app cannot read the current `Repairs` row before writing
- **THEN** the completion is not written and the admin sees the generic failure

### Requirement: Repair completion rate limit

The system SHALL limit repair completion writes per admin client IP and SHALL reject excess attempts with a generic localized message. If the counter store is unavailable, the system SHALL fail closed and leave the row unchanged.

#### Scenario: Completion limit exceeded
- **WHEN** an admin client IP exceeds the allowed number of completion writes in the window
- **THEN** further completions are rejected with a generic message and no cell changes

#### Scenario: Completion counter store unavailable
- **WHEN** the rate-limit store cannot be reached
- **THEN** the completion is rejected and no cell changes

### Requirement: Repair confidentiality

The system MUST NOT log a repair note, category, request ID, or date. A repair note SHALL be readable only by the owning tenant's dashboard and an admin session. It MUST NOT appear in page metadata, another room's cache entry, or any unauthenticated response.

#### Scenario: Logs stay free of repair values
- **WHEN** a repair read or write fails
- **THEN** the log contains only a fixed reason code and counts, never a note, category, request ID, or date

#### Scenario: Other rooms cannot read the request
- **WHEN** room A has a repair request and room B loads its dashboard
- **THEN** room B's response and cache entry contain no room A repair value

#### Scenario: Metadata is clean
- **WHEN** any dashboard or admin page renders
- **THEN** the document metadata contains no repair note or request ID

### Requirement: Repair status presentation

Each repair request SHALL show a localized `pending` or `done` status. The status MUST NOT rely on colour alone. A done request SHALL show its completion date.

#### Scenario: Pending status
- **WHEN** a request has status `pending`
- **THEN** the history and admin queue show the localized pending label

#### Scenario: Done status
- **WHEN** a request has status `done`
- **THEN** the history shows the localized done label and the completion date

#### Scenario: Both locales
- **WHEN** the dashboard or admin console renders in `zh-TW` or `en`
- **THEN** every repair label and status comes from that locale's dictionary

### Requirement: No edit or reopen

A tenant MUST NOT change the category, note, or submitted date of a submitted request. An admin MUST NOT reopen a done request, edit a request, or delete a request. A second completion attempt SHALL be rejected.

#### Scenario: Tenant cannot edit a request
- **WHEN** a tenant submits a change to an existing request
- **THEN** the system rejects the change and leaves the row unchanged

#### Scenario: Admin cannot reopen a request
- **WHEN** an admin attempts to move a done request back to `pending`
- **THEN** the system rejects the action and leaves the row unchanged

#### Scenario: No delete control
- **WHEN** the tenant or admin views a request
- **THEN** no delete control is present and no delete request is accepted

### Requirement: Repair availability is independent

Failure of the `Repairs` tab SHALL NOT hide or change bills, payments, or lease data. Failure of `Bills` or `Leases` SHALL NOT hide the repair form or history. Each section SHALL show its own localized unavailable state.

#### Scenario: Repairs fail while bills render
- **WHEN** the `Repairs` tab is absent or invalid and the `Bills` and `Leases` tabs are valid
- **THEN** the repair section shows unavailable and the bills, payments, and lease still render

#### Scenario: Bills fail while repairs render
- **WHEN** the `Bills` or `Leases` tab is invalid and the `Repairs` tab is valid
- **THEN** the bills, payments, and lease sections show unavailable and the repair form and history still render
