# room-dashboard Specification

## Purpose

Presents each authenticated tenant a private dashboard for their own room, showing bills, payments, and lease dates as placeholder data for the MVP.

## Requirements

### Requirement: Room dashboard display

For each authenticated tenant with a valid session, the system SHALL display a dashboard for their room showing bills, payments, and lease dates read from AppFeed and scoped to the session's room, plus the configured bank account reference shared by all rooms and the room's repair requests. It SHALL show open bills, up to 12 recent payments, the room's lease, the bank account section when one is configured, and the repair form and request history. It MUST NOT render placeholder data in production. Each open bill SHALL offer a claim form and SHALL show the pending claim state when one exists.

#### Scenario: Tenant views own dashboard
- **WHEN** the tenant authenticated for room `E` opens their dashboard
- **THEN** the page shows room E's AppFeed open bills, payment history, lease dates, and repair requests next to the room heading

#### Scenario: Bank account appears alongside AppFeed data
- **WHEN** the tenant authenticated for room `A` opens their dashboard while a bank account is configured
- **THEN** the page shows the bank name, recipient name, bank code, and account number in a labeled reference section in addition to the AppFeed sections

#### Scenario: Unauthenticated access attempt
- **WHEN** a visitor without a valid session requests any room dashboard
- **THEN** the system redirects them to the tenant login page

#### Scenario: Tenant cannot view another room
- **WHEN** the tenant authenticated for room `A` requests the room `B` dashboard
- **THEN** the system denies access and does not render or serialize any room B data

#### Scenario: Feed unavailable
- **WHEN** AppFeed is unreachable, misconfigured, has the wrong title or tabs, has a header mismatch, or has an invalid row for the tenant's room
- **THEN** the affected bills, payments, and lease sections show the localized generic unavailable state and no bill, payment, or lease values

#### Scenario: Open bills are ordered by due date
- **WHEN** a room has several Bills rows with a blank paid_on
- **THEN** the dashboard lists those open bills in ascending due_date order

#### Scenario: Payment history is limited to 12
- **WHEN** a room has more than 12 Bills rows with a paid_on date
- **THEN** the dashboard shows only the 12 rows with the latest paid_on dates, newest first

#### Scenario: No bills yet
- **WHEN** AppFeed has no valid Bills rows for the tenant's room
- **THEN** the bills section shows the localized no-bills-yet state, distinct from the unavailable state

#### Scenario: Missing lease
- **WHEN** AppFeed has no Leases row for the tenant's room but has valid Bills rows
- **THEN** the header shows the localized missing-lease copy and the bills and payments still render

#### Scenario: No placeholder data in production
- **WHEN** any room dashboard renders in production
- **THEN** it contains no placeholder amounts, dates, sample-data badge, or sample-data caption

#### Scenario: Open bill offers a claim form
- **WHEN** the tenant has an open bill with no claim
- **THEN** the bill shows the localized claim form with a paid date field and a five-digit suffix field

#### Scenario: Pending claim is visible
- **WHEN** the tenant has an open bill with a claim
- **THEN** the bill shows the localized pending state and its claimed date, and the form still allows a replacement

#### Scenario: Paid bill has no claim form
- **WHEN** a bill has a paid_on value
- **THEN** the bill shows no claim form and no pending state

#### Scenario: Repair form appears
- **WHEN** the tenant has a readable Repairs tab
- **THEN** the dashboard shows the repair form with the category field, note field, warning, and submit control

#### Scenario: Repair history appears
- **WHEN** the room has repair requests
- **THEN** the dashboard lists each request with its category, note, submitted date, and localized status

#### Scenario: Repairs unavailable does not hide bills
- **WHEN** the Repairs tab is absent or invalid and the Bills and Leases tabs are valid
- **THEN** the repair section shows its unavailable state and the bills, payments, and lease still render

#### Scenario: Bills unavailable does not hide repairs
- **WHEN** the Bills or Leases tab is invalid and the Repairs tab is valid
- **THEN** the bills, payments, and lease sections show unavailable and the repair form and history still render

### Requirement: Open bill meter breakdown

The room dashboard SHALL show the water and electricity meter breakdown under an open bill when the bill carries one. It SHALL show the start reading, end reading, consumed units, and price per unit, with the cost already shown as the amount. A utility without a breakdown SHALL show its amount only. The payment history SHALL stay unchanged.

#### Scenario: Water breakdown appears
- **WHEN** an open bill has a complete water meter group
- **THEN** the bill shows the water start reading, end reading, units, and price per unit next to the water amount

#### Scenario: Electricity breakdown appears
- **WHEN** an open bill has a complete electricity meter group
- **THEN** the bill shows the electricity start reading, end reading, units, and price per unit next to the electricity amount

#### Scenario: Both utilities have a breakdown
- **WHEN** an open bill has complete groups for water and electricity
- **THEN** the bill shows two separate breakdown lines, each with its own readings and rate

#### Scenario: Missing breakdown
- **WHEN** an open bill has no meter group for a utility
- **THEN** the bill shows that utility's amount with no reading or rate

#### Scenario: Breakdown follows the locale
- **WHEN** the dashboard renders in `zh-TW` or `en`
- **THEN** the breakdown labels use that locale's dictionary and the numbers use that locale's formatting

#### Scenario: Payment history stays unchanged
- **WHEN** the tenant expands the payments disclosure
- **THEN** each payment shows its period, amount, and received date, with no meter readings or rate

#### Scenario: Unavailable feed shows no breakdown
- **WHEN** the room feed is unavailable
- **THEN** no meter reading or rate renders, and the generic unavailable state remains

### Requirement: Dashboard lease and payment presentation

The room dashboard SHALL place the room's lease start, lease end, and renewal decision due adjacent to the room heading, and SHALL present payment history inside a disclosure that is collapsed by default. The disclosure MUST work without client-side JavaScript and MUST use the localized payments label as its visible control text. The claim form SHALL sit with its open bill and MUST submit without client-side JavaScript.

#### Scenario: Lease facts appear next to the room heading
- **WHEN** an authenticated tenant with a valid lease opens their dashboard
- **THEN** the lease start, lease end, and renewal decision due render next to the room heading, and no separate trailing lease section is rendered

#### Scenario: Payment history starts collapsed
- **WHEN** the dashboard renders with one or more recorded payments
- **THEN** the payments disclosure is collapsed, so no payment row is visible until the tenant expands it

#### Scenario: Tenant expands payment history
- **WHEN** the tenant activates the payments disclosure
- **THEN** the recorded payments become visible with the existing period, amount, and received-date formatting for the active locale

#### Scenario: Missing lease next to the heading
- **WHEN** AppFeed loads successfully but has no lease for the tenant's room
- **THEN** the header area shows the localized missing-lease copy while bills and payments still render

#### Scenario: Lease without a renewal date
- **WHEN** the lease exists but its renewal decision due date is absent
- **THEN** the header lease facts show the localized not-available value for the renewal date

#### Scenario: No lease facts when the feed is unavailable
- **WHEN** AppFeed is unavailable
- **THEN** the header renders no lease facts and the localized generic unavailable notice remains

#### Scenario: Claim form submits without JavaScript
- **WHEN** the tenant disables client-side JavaScript and submits a valid claim
- **THEN** the action runs, the page reloads, and the pending state shows
