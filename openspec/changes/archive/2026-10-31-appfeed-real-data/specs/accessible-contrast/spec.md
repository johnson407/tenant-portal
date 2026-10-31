# Spec Delta

## MODIFIED Requirements

### Requirement: Room dashboard meets AA

The authorized `/rooms/[room]` view SHALL meet 4.5:1 for all normal text and 3:1 for large text.

#### Scenario: Section captions and lease labels
- **WHEN** the authorized room dashboard renders
- **THEN** the last-updated caption measures at least 4.5:1 on slate-100 (slate-700: 9.45:1) and the three lease `<dt>` labels measure at least 4.5:1 on white (slate-700: 10.35:1)

#### Scenario: Headings and card content
- **WHEN** the authorized room dashboard renders
- **THEN** the room heading, section headings, bill/payment rows, breakdown labels, and lease values measure at least 4.5:1 (headings slate-800/slate-900: 14.63:1/17.85:1; body slate-900: 17.85:1 on white, 16.30:1 on slate-100)
