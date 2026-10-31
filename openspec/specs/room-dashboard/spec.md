# room-dashboard Specification

## Purpose

Presents each authenticated tenant a private dashboard for their own room, showing bills, payments, and lease dates as placeholder data for the MVP.

## Requirements

### Requirement: Room dashboard display
For each authenticated tenant with a valid session, the system SHALL display a dashboard for their room showing bills, payments, and lease dates read from AppFeed and scoped to the session's room, plus the configured bank account reference shared by all rooms. It SHALL show open bills, up to 12 recent payments, the room's lease, and the bank account section when one is configured, and MUST NOT render placeholder data in production.

#### Scenario: Tenant views own dashboard
- **WHEN** the tenant authenticated for room `E` opens their dashboard
- **THEN** the page shows room E's AppFeed open bills, payment history, and lease dates

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
- **THEN** the dashboard shows the localized generic unavailable state and no bill, payment, or lease values

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
- **THEN** the lease section shows not available and the bills and payments still render

#### Scenario: No placeholder data in production
- **WHEN** any room dashboard renders in production
- **THEN** it contains no placeholder amounts, dates, sample-data badge, or sample-data caption
