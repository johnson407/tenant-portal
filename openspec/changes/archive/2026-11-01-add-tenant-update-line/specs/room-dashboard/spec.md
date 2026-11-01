# room-dashboard Specification Delta

## ADDED Requirements

### Requirement: Latest update line placement

The room dashboard SHALL place the latest-update line in the header area next to the room context and before the bills, payment, and repair sections. The line SHALL remain visible without opening the payment disclosure. It MUST NOT replace the data-freshness timestamp. It MUST work without client-side JavaScript. It SHALL be hidden when no qualifying event exists.

#### Scenario: Line appears in the header
- **WHEN** a tenant opens a dashboard with a completed repair or a confirmed claim
- **THEN** the latest-update line appears in the header area before the bills and payment sections

#### Scenario: Line is separate from the timestamp
- **WHEN** the dashboard shows both the latest-update line and the data-freshness timestamp
- **THEN** both appear with separate labels and neither replaces the other

#### Scenario: Payments stay collapsed
- **WHEN** the dashboard first renders with the latest-update line and one or more payments
- **THEN** the line is visible while the payment disclosure stays collapsed

#### Scenario: Line works without JavaScript
- **WHEN** client-side JavaScript is disabled
- **THEN** the latest-update line still renders with its label, date, and note

#### Scenario: No event hides the line
- **WHEN** the room has no completed repair and no confirmed claim
- **THEN** the header area renders no latest-update line and the other sections keep their normal layout

#### Scenario: Narrow viewport keeps the line readable
- **WHEN** the dashboard renders at a 390-pixel-wide viewport
- **THEN** the latest-update line wraps within the header and causes no horizontal scrolling
