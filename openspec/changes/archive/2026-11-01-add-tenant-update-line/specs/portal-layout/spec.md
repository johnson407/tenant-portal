# portal-layout Specification Delta

## ADDED Requirements

### Requirement: Latest update status presentation

The latest-update line SHALL render as a status element in the room header, not inside a section card or a disclosure. It SHALL show the localized event label as text and MUST NOT rely on colour or an icon alone. At a 390-pixel-wide viewport it SHALL wrap without horizontal scrolling. DOM order SHALL keep it before the bills and payment content.

#### Scenario: Header status element
- **WHEN** a room dashboard renders with a latest-update line
- **THEN** the line appears in the header area as a status element, outside the bills, payment, and repair cards

#### Scenario: Status is not colour-only
- **WHEN** the latest-update line renders
- **THEN** the localized event label is present as text in addition to any colour or icon treatment

#### Scenario: Narrow viewport
- **WHEN** the dashboard renders at a 390-pixel-wide viewport
- **THEN** the line wraps within the header and the page needs no horizontal scrolling

#### Scenario: Reading order
- **WHEN** the dashboard is read by a keyboard or screen reader
- **THEN** the latest-update line comes before the bills and payment content in DOM order

#### Scenario: No JavaScript
- **WHEN** client-side JavaScript is disabled
- **THEN** the latest-update line still renders and remains readable in the header
