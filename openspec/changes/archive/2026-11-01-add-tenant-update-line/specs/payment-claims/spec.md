# payment-claims Specification Delta

## MODIFIED Requirements

### Requirement: Admin claim review

An authenticated admin SHALL see a list of pending claims across all rooms. Each entry SHALL show the room, period, claimed date, last five digits, a confirmation form with a paid-date field prefilled with the claimed date, an optional note field, and a confirm control. The list MUST exclude confirmed bills and MUST NOT be available to a tenant session or an anonymous request. The form MUST work without client-side JavaScript.

#### Scenario: Admin sees pending claims
- **WHEN** an admin opens the admin console while claims are pending
- **THEN** the console lists each pending claim with room, period, claimed date, last five digits, and a confirmation form

#### Scenario: Paid date is prefilled
- **WHEN** a pending claim has a claimed date
- **THEN** the confirmation form's paid-date field starts with that claimed date

#### Scenario: Note is optional
- **WHEN** an admin confirms a claim without a note
- **THEN** the confirmation succeeds and stores no note

#### Scenario: Confirmed claims leave the list
- **WHEN** a listed bill receives a `paid_on` value
- **THEN** the next admin load no longer lists it

#### Scenario: Tenant cannot read the list
- **WHEN** a tenant session or anonymous request asks for the claim list
- **THEN** the system denies access and returns no claim value

#### Scenario: No pending claims
- **WHEN** no bill has a claim without a `paid_on` value
- **THEN** the admin console shows a localized empty state, not an error

#### Scenario: Form submits without JavaScript
- **WHEN** an admin disables client-side JavaScript and confirms a pending claim
- **THEN** the action runs, the page reloads, and the claim leaves the pending list

### Requirement: Claim confidentiality

The system MUST NOT log the account suffix, the claimed date, the paid date, the confirmation date, the confirmation note, or any cell value. Claim values SHALL be readable only by the owning tenant's dashboard and an admin session. They MUST NOT appear in page metadata, in another room's cache entry, or in any unauthenticated response.

#### Scenario: Logs stay free of claim values
- **WHEN** a claim read or write fails
- **THEN** the log contains only a fixed reason code and counts, never the suffix, date, or note

#### Scenario: Other rooms cannot read the claim
- **WHEN** room A has a claim and room B loads its feed
- **THEN** room B's response and cache entry contain no room A claim value

#### Scenario: Confirmation note stays private
- **WHEN** room A has a confirmation note and room B loads its feed or dashboard
- **THEN** room B's response, cache entry, and page metadata contain no room A note

#### Scenario: Metadata is clean
- **WHEN** any dashboard or admin page renders
- **THEN** the document metadata contains no claim value

## ADDED Requirements

### Requirement: Admin claim confirmation

An authenticated admin SHALL confirm a pending claim for one room and period. The system SHALL require a paid date that is a real ISO date not later than the current date in Asia/Taipei and an optional note of 1 to 200 printable characters. It SHALL write the confirmation date and note, then the paid date, verify the row, and invalidate the room feed cache.

#### Scenario: Admin confirms a claim
- **WHEN** an admin submits a valid paid date and a valid note for a pending room A claim
- **THEN** the row holds the paid date, the current Asia/Taipei confirmation date, and the note, and the claim leaves the pending list

#### Scenario: Confirmation without a note
- **WHEN** an admin confirms a claim with a blank note
- **THEN** the row holds the paid date and confirmation date, and the note cell stays blank

#### Scenario: Write failure is generic
- **WHEN** the confirmation write fails with a timeout, 401, 403, 429, or 5xx
- **THEN** the admin sees the generic failure and the paid date stays blank

#### Scenario: Verification protects the row
- **WHEN** the fresh read after the writes does not show the expected room, period, paid date, and confirmation date
- **THEN** the admin sees the generic failure and no success state

#### Scenario: Tenant sees the confirmation next
- **WHEN** the confirmation succeeds
- **THEN** the room feed cache is invalidated and the tenant's next dashboard render shows the new latest-update line

### Requirement: Claim confirmation validation

The system SHALL reject a claim confirmation from an unauthenticated request, another room, an unknown period, a paid bill, a missing claim, a future or invalid paid date, and an invalid note. A rejected confirmation MUST NOT change any cell.

#### Scenario: Future paid date rejected
- **WHEN** the admin enters a paid date later than the current date in Asia/Taipei
- **THEN** the system rejects the action and changes no cell

#### Scenario: Invalid paid date rejected
- **WHEN** the admin enters a formatted, impossible, or blank paid date
- **THEN** the system rejects the action with a localized message and changes no cell

#### Scenario: Invalid note rejected
- **WHEN** the admin enters a note longer than 200 characters, with a control character, an email, a URL, or seven or more digits in a row
- **THEN** the system rejects the action with a localized message and changes no cell

#### Scenario: Unknown period rejected
- **WHEN** the admin confirms a period that has no Bills row for the room
- **THEN** the system rejects the action and changes no cell

#### Scenario: Paid bill rejected
- **WHEN** the admin confirms a bill that already has a paid date
- **THEN** the system rejects the action and changes no cell

#### Scenario: Missing claim rejected
- **WHEN** the admin confirms a bill with a blank claimed date or blank suffix
- **THEN** the system rejects the action and changes no cell

#### Scenario: Tenant cannot confirm
- **WHEN** a tenant session or anonymous request attempts a confirmation
- **THEN** the system denies the request without reading or writing the sheet

### Requirement: Claim confirmation rate limit

The system SHALL limit claim confirmation writes per admin client IP and SHALL reject excess attempts with a generic localized message. If the counter store is unavailable, the system SHALL fail closed and leave the row unchanged.

#### Scenario: Confirmation limit exceeded
- **WHEN** an admin client IP exceeds the allowed number of confirmation writes in the window
- **THEN** further confirmations are rejected with a generic message and no cell changes

#### Scenario: Confirmation counter store unavailable
- **WHEN** the rate-limit store cannot be reached
- **THEN** the confirmation is rejected and no cell changes

### Requirement: Claim confirmation availability

When AppFeed is unavailable or the Bills tab is invalid, the system SHALL hide the confirmation form and MUST NOT accept a confirmation.

#### Scenario: No form without feed data
- **WHEN** the admin console shows the claim list as unavailable
- **THEN** no confirmation form renders

#### Scenario: Confirmation rejected while the feed is unavailable
- **WHEN** an admin submits a confirmation while the sheet cannot be read
- **THEN** the confirmation is rejected and no cell changes

### Requirement: Claim confirmation is immediate

After a successful confirmation, the tenant's dashboard SHALL show the confirmation on the next render, without waiting for the feed cache lifetime.

#### Scenario: Confirmation appears at once
- **WHEN** an admin confirms a pending claim
- **THEN** the tenant's next dashboard render shows the payment-confirmed event on the latest-update line
