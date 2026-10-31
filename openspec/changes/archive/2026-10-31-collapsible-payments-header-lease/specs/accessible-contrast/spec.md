# Spec Delta

## MODIFIED Requirements

### Requirement: Text contrast is evaluated against the effective background

Every rendered text node SHALL have a contrast ratio of at least 4.5:1 against the background actually behind it after colour inheritance, in both `prefers-color-scheme: light` and `prefers-color-scheme: dark`.

#### Scenario: Authorized room dashboard in OS dark mode
- **WHEN** `prefers-color-scheme: dark` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the light page and its white cards — including bill/payment labels, bill/payment amounts, and lease `<dd>` values — measures at least 4.5:1 (foreground resolves to slate-900: 17.85:1 on white, 16.30:1 on slate-100), and no text renders as inherited `#ededed` on white or slate-100 (1.17:1 and 1.07:1)

#### Scenario: Authorized room dashboard in OS light mode
- **WHEN** `prefers-color-scheme: light` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the page and cards measures at least 4.5:1, with no layout or copy difference from the dark-mode rendering

### Requirement: Room dashboard meets AA

The authorized `/rooms/[room]` view SHALL meet 4.5:1 for all normal text and 3:1 for large text.

#### Scenario: Section captions and lease labels
- **WHEN** the authorized room dashboard renders
- **THEN** the last-updated caption measures at least 4.5:1 on slate-100 (slate-700: 9.45:1) and the three lease `<dt>` labels measure at least 4.5:1 on slate-100 (slate-700: 9.45:1)

#### Scenario: Headings and card content
- **WHEN** the authorized room dashboard renders
- **THEN** the room heading, section headings, bill/payment rows, breakdown labels, and lease values measure at least 4.5:1 (headings slate-800/slate-900: 14.63:1/17.85:1; body slate-900: 17.85:1 on white, 16.30:1 on slate-100)
