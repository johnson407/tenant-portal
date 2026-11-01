# Spec Delta

## MODIFIED Requirements

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
