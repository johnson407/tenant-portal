# tenant-updates Specification

## Purpose

Shows each tenant the most recent change the landlord made to their room, with the event, its date, and an optional note.

## Requirements

### Requirement: Latest update line

The room dashboard SHALL show one latest-update line when the room has a qualifying event. A qualifying event is a completed repair or a confirmed payment claim. The line SHALL show a localized event label, the event date, and the note when one exists. It MUST NOT show another room's event. It MUST NOT render when no qualifying event exists.

#### Scenario: Completed repair is shown
- **WHEN** the room has a repair with status `done` and a done date
- **THEN** the latest-update line shows the localized repair-completed label and the done date

#### Scenario: Confirmed claim is shown
- **WHEN** the room has a bill with both a paid date and a confirmation date
- **THEN** the latest-update line shows the localized payment-confirmed label and the confirmation date

#### Scenario: Note is shown
- **WHEN** the latest qualifying event has a note
- **THEN** the line shows the note as plain text after the label and date

#### Scenario: Blank note is omitted
- **WHEN** the latest qualifying event has no note
- **THEN** the line shows the label and date without an empty note element

#### Scenario: No qualifying event
- **WHEN** the room has no completed repair and no confirmed claim
- **THEN** the dashboard renders no latest-update line

#### Scenario: Pending repair does not count
- **WHEN** the room has a repair with status `pending` and no done date
- **THEN** that repair does not create or change the latest-update line

#### Scenario: Pending claim does not count
- **WHEN** the room has a bill with a claimed date but no paid date or no confirmation date
- **THEN** that claim does not create or change the latest-update line

#### Scenario: New bill does not count
- **WHEN** the room receives a new open bill with no completed repair or confirmed claim
- **THEN** the latest-update line does not change

#### Scenario: Manual paid date does not count
- **WHEN** a bill has a paid date but no confirmation date
- **THEN** that payment does not create or change the latest-update line

#### Scenario: Other room is excluded
- **WHEN** room B has a qualifying event and room A loads its dashboard
- **THEN** room A's line contains no room B event, date, or note

### Requirement: Latest event selection

When the room has more than one qualifying event, the line SHALL show the event with the latest date. When a completed repair and a confirmed claim share the latest date, the claim confirmation SHALL take precedence. The line SHALL use the event date and MUST NOT use the page load time or the cache time.

#### Scenario: Latest repair wins
- **WHEN** the room has a completed repair dated later than every confirmed claim
- **THEN** the line shows that repair, its date, and its note

#### Scenario: Latest claim wins
- **WHEN** the room has a confirmed claim dated later than every completed repair
- **THEN** the line shows that claim, its date, and its note

#### Scenario: Tie goes to the claim
- **WHEN** a completed repair and a confirmed claim have the same latest date
- **THEN** the line shows the claim confirmation

#### Scenario: Older event is hidden
- **WHEN** the room has two qualifying events with different dates
- **THEN** the line shows only the later event and hides the earlier event

#### Scenario: Date is the event date
- **WHEN** the page is loaded on a later day than the latest event
- **THEN** the line still shows the event date, not the page load date

### Requirement: Update line availability

The system SHALL build the line from the readable Bills and Repairs data. When both sources are readable, it SHALL use both. When one source is unavailable, it SHALL use the other. When both are unavailable, it SHALL hide the line. An unavailable source MUST NOT hide an event from a readable source.

#### Scenario: Bills unavailable, repair shown
- **WHEN** the Bills tab is unavailable and the room has a completed repair
- **THEN** the line shows the repair event

#### Scenario: Repairs unavailable, claim shown
- **WHEN** the Repairs tab is unavailable and the room has a confirmed claim
- **THEN** the line shows the claim event

#### Scenario: Both sources unavailable
- **WHEN** both the Bills and Repairs data are unavailable
- **THEN** the dashboard renders no latest-update line

#### Scenario: Available source is not hidden
- **WHEN** one source is unavailable and the other has a qualifying event
- **THEN** the unavailable source does not hide or replace the available event

### Requirement: Update note content and confidentiality

A note on the latest-update line SHALL be plain text of 1 to 200 printable characters after trimming. It MUST NOT contain a control character, an email address, a URL, or a run of seven or more digits. The system MUST NOT log the note. The note SHALL be visible only to the owning tenant and an admin session.

#### Scenario: Note is escaped text
- **WHEN** a stored note contains characters such as `<`, `>`, or `&`
- **THEN** the line shows them as text and does not render them as markup

#### Scenario: Invalid note fails the room
- **WHEN** a confirmation or completion note fails the content rules
- **THEN** that room's affected data is unavailable and no note is displayed

#### Scenario: Note is not logged
- **WHEN** a read or write for a confirmation or completion note fails
- **THEN** the log contains only a fixed reason code and counts, never the note text

#### Scenario: Note stays in its room
- **WHEN** room A has a confirmation note and room B loads its dashboard or feed
- **THEN** room B's response and cache entry contain no room A note

#### Scenario: Note is absent from metadata
- **WHEN** any dashboard page renders
- **THEN** the document metadata contains no confirmation or completion note

### Requirement: Update line presentation

The latest-update line SHALL render in the room header area before the bills and payment sections. It SHALL remain visible without opening a disclosure and SHALL work without client-side JavaScript. The event label and date SHALL use the active locale's dictionary and date format. The line MUST NOT use colour as the only cue.

#### Scenario: Line is in the header
- **WHEN** a tenant opens a dashboard with a qualifying event
- **THEN** the line appears in the header area before the bills and payment sections

#### Scenario: Line survives without JavaScript
- **WHEN** client-side JavaScript is disabled
- **THEN** the latest-update line still renders with its label, date, and note

#### Scenario: Line is localized
- **WHEN** the dashboard renders in `zh-TW` or `en`
- **THEN** the event label, note label, and date use that locale's dictionary and formatting

#### Scenario: Line is not colour-only
- **WHEN** the line renders
- **THEN** the event label is present as text in addition to any colour or icon treatment

#### Scenario: Line is separate from the data timestamp
- **WHEN** the dashboard shows both the latest-update line and the data-freshness timestamp
- **THEN** the two dates have separate labels and do not replace each other
