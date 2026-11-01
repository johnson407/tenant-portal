# repair-requests Specification Delta

## MODIFIED Requirements

### Requirement: Admin repair completion

An authenticated admin SHALL mark a pending repair request done. The system SHALL set `status` to `done`, `done_on` to the current date in Asia/Taipei, and an optional `done_note`, in one write after a fresh read. The note SHALL be blank or 1 to 200 printable characters and MUST NOT contain a control character, an email, a URL, or seven or more digits. It MUST reject an unknown request, an already done request, an unauthenticated request, and an invalid note. A failed write MUST leave the row unchanged.

#### Scenario: Admin marks a request done
- **WHEN** an admin marks a pending request done without a note
- **THEN** the row holds status `done`, the current Asia/Taipei date in `done_on`, and a blank `done_note`

#### Scenario: Admin adds a completion note
- **WHEN** an admin marks a pending request done with a valid note
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
- **THEN** the system denies the request without writing the sheet

#### Scenario: Completion write failure is generic
- **WHEN** the status write fails with a timeout, 401, 403, 429, or 5xx
- **THEN** the admin sees the generic failure and the row keeps status `pending`

#### Scenario: Fresh read failure blocks the write
- **WHEN** the app cannot read the current `Repairs` row before writing
- **THEN** the completion is not written and the admin sees the generic failure

#### Scenario: Completion form works without JavaScript
- **WHEN** an admin disables client-side JavaScript and submits a completion
- **THEN** the action runs, the page reloads, and the request leaves the pending queue

### Requirement: Repair confidentiality

The system MUST NOT log a repair note, a completion note, a category, a request ID, or a date. A repair note and a completion note SHALL be readable only by the owning tenant's dashboard and an admin session. They MUST NOT appear in page metadata, another room's cache entry, or any unauthenticated response.

#### Scenario: Logs stay free of repair values
- **WHEN** a repair read or write fails
- **THEN** the log contains only a fixed reason code and counts, never a note, completion note, category, request ID, or date

#### Scenario: Other rooms cannot read the request
- **WHEN** room A has a repair request and room B loads its dashboard
- **THEN** room B's response, cache entry, and page metadata contain no room A repair value

#### Scenario: Completion note stays private
- **WHEN** room A has a completion note and room B loads its dashboard or feed
- **THEN** room B's response, cache entry, and page metadata contain no room A completion note

#### Scenario: Metadata is clean
- **WHEN** any dashboard or admin page renders
- **THEN** the document metadata contains no repair note, completion note, or request ID

### Requirement: No edit or reopen

A tenant MUST NOT change the category, note, or submitted date of a submitted request. An admin MUST NOT reopen a done request, edit a request, change a completion note, or delete a request. A second completion attempt SHALL be rejected.

#### Scenario: Tenant cannot edit a request
- **WHEN** a tenant submits a change to an existing request
- **THEN** the system rejects the change and leaves the row unchanged

#### Scenario: Admin cannot reopen a request
- **WHEN** an admin attempts to move a done request back to `pending`
- **THEN** the system rejects the action and leaves the row unchanged

#### Scenario: Admin cannot change a completion note
- **WHEN** an admin attempts to replace or clear a stored completion note
- **THEN** the system rejects the action and leaves the note unchanged

#### Scenario: No delete control
- **WHEN** the tenant or admin views a request
- **THEN** no delete control is present and no delete request is accepted
