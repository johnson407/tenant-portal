# Spec Delta

## MODIFIED Requirements

### Requirement: Leases tab schema

The `Leases` tab SHALL expose exactly the header row `room, lease_start, lease_end, renewal_due` in that order. It SHALL hold one row per room with room A-E, ISO lease dates, `lease_end` on or after `lease_start`, and an optional ISO renewal date. Deposit and free-text notes are excluded.

#### Scenario: Exact Leases header
- **WHEN** the first row of the Leases tab is read
- **THEN** it equals the four header names above, in that order, after trimming surrounding whitespace

#### Scenario: Optional renewal date
- **WHEN** a Leases row has a blank renewal_due
- **THEN** the lease is valid and the dashboard shows renewal as not set

#### Scenario: Missing lease row
- **WHEN** a room has bills but no Leases row
- **THEN** the dashboard header shows lease dates not available while the room's bills and payments still render

### Requirement: Empty and missing-data states

A room with no valid Bills rows SHALL show a distinct no-bills-yet state, not the unavailable state. A room with no paid Bills rows SHALL show a distinct no-payments-yet state. A room with no Leases row SHALL show lease dates not available while still showing its bills and payments.

#### Scenario: Room has no bills
- **WHEN** AppFeed has no Bills rows for the room
- **THEN** the bills section shows the no-bills-yet copy and the dashboard is not treated as unavailable

#### Scenario: Room has no payments
- **WHEN** all of the room's Bills rows have a blank paid_on
- **THEN** the payments section shows the no-payments-yet copy while open bills still render

#### Scenario: Room has no lease
- **WHEN** AppFeed has no Leases row for the room
- **THEN** the dashboard header shows lease dates not available and the room's bills and payments still render
