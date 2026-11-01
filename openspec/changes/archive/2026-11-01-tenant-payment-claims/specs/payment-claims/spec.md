# Spec Delta

## Purpose

Lets a tenant report that they paid a bill, and lets only the landlord review those reports. A report stays pending until the landlord confirms the payment.

## ADDED Requirements

### Requirement: Tenant payment claim submission

An authenticated tenant SHALL report a payment for one open bill of their own room by entering the paid date and the last five digits of the sending account. The system MUST accept a report only for the session's room and only for a bill with a blank `paid_on`. It MUST reject a paid bill, another room's bill, an unknown period, and an unauthenticated request.

#### Scenario: Tenant reports a payment
- **WHEN** the tenant of room A submits a valid paid date and five-digit suffix for an open bill of room A
- **THEN** the claim is written to that bill and the tenant sees the localized pending claim state

#### Scenario: Another room's bill is denied
- **WHEN** the tenant of room A submits a claim for a bill of room B
- **THEN** the system denies the request and writes no cell

#### Scenario: Paid bill is rejected
- **WHEN** the tenant submits a claim for a bill that already has a `paid_on` value
- **THEN** the system rejects the claim and leaves both claim cells unchanged

#### Scenario: Unknown period is rejected
- **WHEN** the tenant submits a claim for a period that has no Bills row for their room
- **THEN** the system rejects the claim with a localized message

#### Scenario: Anonymous request is denied
- **WHEN** a request without a valid tenant session attempts a claim
- **THEN** the system denies the request without reading or writing the sheet

### Requirement: Claim field validation

The claimed date SHALL be a real `YYYY-MM-DD` calendar date in Asia/Taipei and MUST NOT be later than the current date there. The account suffix SHALL be exactly five digits after trimming surrounding whitespace. Invalid input SHALL be rejected without a write and SHALL show a localized validation message.

#### Scenario: Formatted date rejected
- **WHEN** the tenant enters `2026/11/01`, `11-01-2026`, or a date with a time
- **THEN** the claim is rejected and no cell changes

#### Scenario: Impossible date rejected
- **WHEN** the tenant enters `2026-02-30`
- **THEN** the claim is rejected with a localized message

#### Scenario: Future date rejected
- **WHEN** the tenant enters a date later than the current date in Asia/Taipei
- **THEN** the claim is rejected and no cell changes

#### Scenario: Suffix must be five digits
- **WHEN** the tenant enters `1234`, `123456`, `12a45`, or a blank suffix
- **THEN** the claim is rejected and no cell changes

#### Scenario: Whitespace is trimmed
- **WHEN** the tenant enters ` 12345 `
- **THEN** the stored suffix is `12345`

### Requirement: Pending claim state

A valid claim SHALL write `claimed_on` and `bank_last5` for that bill and MUST NOT change `paid_on`. The bill SHALL stay in the open bills list with a localized pending claim state. The claim MUST NOT appear in payment history. A bill with a `paid_on` value SHALL NOT show a pending state.

#### Scenario: Bill stays open
- **WHEN** the tenant claims an open bill and reloads the dashboard
- **THEN** the bill still appears in open bills with the pending claim state and its due date

#### Scenario: Payment history is unchanged
- **WHEN** a claim is pending
- **THEN** the payments disclosure does not list that bill as paid

#### Scenario: Confirmed bill is not pending
- **WHEN** the landlord later sets `paid_on` and the tenant reloads the dashboard
- **THEN** the bill leaves open bills, appears in payment history, and shows no pending state

### Requirement: Claim replacement

A tenant SHALL replace the claimed date and suffix of a pending claim for the same bill. A replacement SHALL overwrite both cells in one write and MUST NOT add a Bills row. A bill with a `paid_on` value MUST NOT be changed.

#### Scenario: Tenant corrects a pending claim
- **WHEN** the tenant submits a second valid claim for the same pending bill
- **THEN** the two cells hold the new values and no extra row exists

#### Scenario: Confirmed claim cannot change
- **WHEN** the tenant submits a claim for a bill that the landlord has confirmed
- **THEN** the system rejects the claim and leaves the row unchanged

### Requirement: Claim write failure

If the sheet cannot be read fresh before the write, or the write fails, the system SHALL leave the bill unchanged and show a generic localized failure. It MUST NOT show success, raw error text, or a partial claim.

#### Scenario: Write failure is generic
- **WHEN** the update call fails with a timeout, 401, 403, 429, or 5xx
- **THEN** the tenant sees the generic failure and no claim cell changes

#### Scenario: Fresh read failure blocks the write
- **WHEN** the app cannot read the current Bills row before writing
- **THEN** the claim is not written and the tenant sees the generic failure

#### Scenario: Both cells or neither
- **WHEN** the update would set only one of the two claim cells
- **THEN** the system writes neither cell

### Requirement: Claim rate limit

The system SHALL limit claim writes per tenant room and SHALL reject excess attempts with a generic localized message. If the counter store is unavailable, the system SHALL fail closed and reject the write.

#### Scenario: Limit exceeded
- **WHEN** a tenant room exceeds the allowed number of claim writes in the window
- **THEN** further claims are rejected with a generic message and no cell changes

#### Scenario: Counter store unavailable
- **WHEN** the rate-limit store cannot be reached
- **THEN** the claim is rejected and no cell changes

### Requirement: Admin claim review

An authenticated admin SHALL see a list of pending claims across all rooms. Each entry SHALL show the room, period, claimed date, and last five digits. The list MUST exclude confirmed bills and MUST NOT be available to a tenant session or an anonymous request.

#### Scenario: Admin sees pending claims
- **WHEN** an admin opens the admin console while claims are pending
- **THEN** the console lists each pending claim with room, period, claimed date, and last five digits

#### Scenario: Confirmed claims leave the list
- **WHEN** a listed bill receives a `paid_on` value
- **THEN** the next admin load no longer lists it

#### Scenario: Tenant cannot read the list
- **WHEN** a tenant session or anonymous request asks for the claim list
- **THEN** the system denies access and returns no claim value

#### Scenario: No pending claims
- **WHEN** no bill has a claim without a `paid_on` value
- **THEN** the admin console shows a localized empty state, not an error

### Requirement: Claim confidentiality

The system MUST NOT log the account suffix, the claimed date, or any cell value. Claim values SHALL be readable only by the owning tenant's dashboard and an admin session. They MUST NOT appear in page metadata, in another room's cache entry, or in any unauthenticated response.

#### Scenario: Logs stay free of claim values
- **WHEN** a claim read or write fails
- **THEN** the log contains only a fixed reason code and counts, never the suffix or date

#### Scenario: Other rooms cannot read the claim
- **WHEN** room A has a claim and room B loads its feed
- **THEN** room B's response and cache entry contain no room A claim value

#### Scenario: Metadata is clean
- **WHEN** any dashboard or admin page renders
- **THEN** the document metadata contains no claim value

### Requirement: Claim availability

When AppFeed is unavailable, the system SHALL hide the claim form and MUST NOT accept a claim.

#### Scenario: No form without feed data
- **WHEN** the tenant dashboard shows the unavailable state
- **THEN** no claim form renders

#### Scenario: Claim rejected while the feed is unavailable
- **WHEN** a tenant submits a claim while the sheet cannot be read
- **THEN** the claim is rejected and no cell changes

### Requirement: Claim shown immediately

After a successful claim, the tenant's dashboard SHALL show the pending state on the next render, without waiting for the feed cache lifetime.

#### Scenario: Pending state appears at once
- **WHEN** the tenant submits a valid claim
- **THEN** the next dashboard render shows the pending state for that bill
