# lease-renewal-reminders Specification

## Purpose

Shows a timely renewal reminder to tenants and the landlord when a lease is within 60 days of its end date, derived only from the PII-free AppFeed `Leases` data.

## Requirements

### Requirement: 60-day renewal window

The system SHALL treat a lease as due for a renewal reminder when today in Asia/Taipei is between 60 calendar days before `lease_end` and `lease_end`, inclusive. It SHALL use whole calendar days and SHALL NOT use `renewal_due` to suppress the reminder.

#### Scenario: Exactly 60 days before the end date

- **WHEN** today is exactly 60 calendar days before a lease's `lease_end`
- **THEN** the lease is due for a reminder

#### Scenario: 61 days before the end date

- **WHEN** today is 61 calendar days before a lease's `lease_end`
- **THEN** the lease is not due for a reminder

#### Scenario: On the lease end date

- **WHEN** today equals a lease's `lease_end`
- **THEN** the lease is due for a reminder

#### Scenario: After the lease end date

- **WHEN** today is one day after a lease's `lease_end`
- **THEN** the lease is not due for a reminder

#### Scenario: Renewal decision date is set

- **WHEN** a lease has a `renewal_due` value and today is inside the 60-day window
- **THEN** the lease is still due for a reminder

#### Scenario: No lease row

- **WHEN** a room has no valid `Leases` row
- **THEN** the room is not due for a reminder

#### Scenario: Window crosses a month boundary

- **WHEN** `lease_end` is `2027-03-01` and today is `2026-12-31`
- **THEN** the lease is due for a reminder because exactly 60 calendar days remain

### Requirement: Tenant renewal banner

On an authorized tenant dashboard, the system SHALL show a localized renewal banner when the tenant's lease is inside the 60-day window. The banner SHALL state the lease end date and SHALL appear before the lease facts and bills. It MUST NOT show another room's lease or appear when the feed is unavailable.

#### Scenario: Tenant lease is inside the window

- **WHEN** the authenticated tenant for room `B` opens their dashboard and room B's lease end is inside the window
- **THEN** the page shows the localized renewal banner with room B's lease end date before the lease facts and bills

#### Scenario: Tenant lease is outside the window

- **WHEN** the tenant opens their dashboard and the lease end is more than 60 days away or already past
- **THEN** the page shows no renewal banner and the rest of the dashboard renders normally

#### Scenario: Feed is unavailable

- **WHEN** the tenant's room feed is unavailable
- **THEN** the page shows no renewal banner and keeps the generic unavailable state

#### Scenario: Tenant cannot see another room's reminder

- **WHEN** the tenant authenticated for room `A` requests the room `B` dashboard
- **THEN** the system denies access and renders no room B reminder

#### Scenario: Renewal decision date is set

- **WHEN** the tenant's lease has a `renewal_due` value and the lease end is inside the window
- **THEN** the renewal banner still appears

#### Scenario: No dismiss control

- **WHEN** the tenant views the renewal banner
- **THEN** the banner has no dismiss control and the system stores no reminder state

#### Scenario: Banner works without JavaScript

- **WHEN** client-side JavaScript is disabled
- **THEN** the renewal banner still renders with its heading, message, and lease end date

#### Scenario: Banner follows the locale

- **WHEN** the dashboard renders in `zh-TW` or `en`
- **THEN** the banner uses that locale's heading and message and formats the lease end date for that locale

### Requirement: Admin renewal banner

On the admin console, the system SHALL show one localized renewal banner that lists every room inside the 60-day window, sorted by lease end date and then room letter. Each line SHALL show the room and lease end date. The banner MUST appear above the admin cards and MUST NOT show when no room is inside the window.

#### Scenario: Several rooms are inside the window

- **WHEN** rooms A, B, and D have lease ends inside the window
- **THEN** one banner lists rooms A, B, and D with their lease end dates, ordered by date and then room letter

#### Scenario: One room is inside the window

- **WHEN** only room C has a lease end inside the window
- **THEN** the banner lists only room C and its lease end date

#### Scenario: No room is inside the window

- **WHEN** every lease end is outside the window
- **THEN** the admin console shows no renewal banner and the other cards keep their normal layout

#### Scenario: Two rooms share an end date

- **WHEN** rooms A and C have the same lease end date inside the window
- **THEN** the banner lists room A before room C

#### Scenario: Banner sits above the admin cards

- **WHEN** the admin console renders with a renewal reminder
- **THEN** the banner appears after the page heading and before the reset, bank, claims, and repairs cards

#### Scenario: Admin banner follows the locale

- **WHEN** the admin console renders in `zh-TW` or `en`
- **THEN** the banner uses that locale's heading, caption, room label, and date formatting

#### Scenario: Admin banner works without JavaScript

- **WHEN** client-side JavaScript is disabled
- **THEN** the admin renewal banner still renders with its list

#### Scenario: Anonymous visitor

- **WHEN** a visitor without an admin session requests the admin console
- **THEN** the system redirects to the admin sign-in page and shows no reminder list

#### Scenario: Lease reminder read fails

- **WHEN** the reminder accessor cannot read or validate the `Leases` data
- **THEN** the banner area shows the localized unavailable notice and the reset, bank, claims, and repairs cards remain usable

### Requirement: Reminder read boundary

The system SHALL derive reminders only from the existing `Leases` data. The tenant SHALL use the room feed. The admin SHALL use a server-only accessor that requires an admin session and returns only `room` and `lease_end`. The admin read MAY use the existing fixed `Bills!A:Q` and `Leases!A:D` snapshot, but it MUST NOT add a range, write to the sheet, return full lease rows or bill data, or log cell values.

#### Scenario: Admin projection is narrow

- **WHEN** an admin loads the renewal banner
- **THEN** each entry holds only a room letter and a lease end date, with no lease start, renewal date, bill, claim, repair, or personal data

#### Scenario: Tenant projection stays in its room

- **WHEN** rooms A and B have lease ends inside the window and room A's dashboard is requested
- **THEN** room A's page holds only room A's reminder and no room B value

#### Scenario: No write

- **WHEN** a reminder is read for either view
- **THEN** the system does not change any cell, row, tab, or column

#### Scenario: No new range

- **WHEN** the reminder accessor reads the sheet
- **THEN** it uses only the existing fixed `Bills!A:Q` and `Leases!A:D` snapshot and adds no range

#### Scenario: Invalid bill row does not hide renewals

- **WHEN** a `Bills` row attributed to a room is invalid but every `Leases` row is valid
- **THEN** the admin banner still lists the leases inside the window

#### Scenario: Bills header or row shape failure

- **WHEN** the shared snapshot fails on a `Bills` header or an over-wide `Bills` row
- **THEN** the admin banner shows the unavailable notice

#### Scenario: Invalid lease row

- **WHEN** any `Leases` row attributed to a room is invalid
- **THEN** the admin banner shows the unavailable notice and does not show a partial list

#### Scenario: Unauthenticated accessor call

- **WHEN** a tenant session or anonymous request asks for the admin reminder list
- **THEN** the system denies access before reading the sheet

#### Scenario: Logs hold no cell values

- **WHEN** a reminder read or validation fails
- **THEN** the log holds only a fixed reason code, never a room's lease dates or other cell contents

### Requirement: Renewal banner presentation

The renewal banner SHALL render as a labeled section with localized text, use an amber surface whose text meets at least 4.5:1 contrast, and MUST NOT rely on colour alone. It SHALL wrap at a 390-pixel viewport without horizontal scrolling and SHALL work without client-side JavaScript.

#### Scenario: Text contrast

- **WHEN** the renewal banner renders in either view
- **THEN** its heading, message, and date text, plus the room text in the admin variant, measure at least 4.5:1 against the banner surface

#### Scenario: Status is not colour-only

- **WHEN** the renewal banner renders
- **THEN** a localized heading and message are present as text in addition to the amber treatment

#### Scenario: Narrow viewport

- **WHEN** either view renders at a 390-pixel-wide viewport
- **THEN** the banner text wraps within the content width and the page needs no horizontal scrolling

#### Scenario: Operating system colour scheme

- **WHEN** the operating system requests light mode or dark mode
- **THEN** the banner keeps the same dark portal surfaces and text colours in both cases
