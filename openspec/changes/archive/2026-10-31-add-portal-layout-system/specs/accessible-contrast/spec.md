# Spec Delta

## MODIFIED Requirements

### Requirement: Text contrast is evaluated against the effective background

Every rendered text node SHALL have a contrast ratio of at least 4.5:1 against the background actually behind it after colour inheritance, in both `prefers-color-scheme: light` and `prefers-color-scheme: dark`.

#### Scenario: Authorized room dashboard in OS dark mode

- **WHEN** `prefers-color-scheme: dark` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the near-black page and its charcoal cards — including bill/payment labels, bill/payment amounts, lease stat values, and captions — measures at least 4.5:1 (slate-100 on slate-950: 18.41:1; slate-300 on slate-900: 12.02:1), and no text inherits a colour that fails against the dark surfaces

#### Scenario: Authorized room dashboard in OS light mode

- **WHEN** `prefers-color-scheme: light` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the page and cards measures at least 4.5:1, with no layout, copy, or colour difference from the dark-mode rendering

### Requirement: Tenant sign-in page meets AA

All text on `/login`, including the brand/context panel, SHALL meet 4.5:1 for normal text and the page's UI controls SHALL meet 3:1 for boundaries and focus indication.

#### Scenario: Tenant login footer and form

- **WHEN** the tenant sign-in page renders in either OS colour scheme
- **THEN** the "Landlord?" footer line and "Admin area" link measure at least 4.5:1 on the slate-900 card (footer resolves to slate-300: 12.02:1; link hover resolves to white: 17.85:1), the inputs' placeholders measure at least 4.5:1 (slate-400 on slate-950: 7.87:1), and the input/select border and focus indicator each measure at least 3:1 against both slate-950 and slate-900

#### Scenario: Tenant brand panel

- **WHEN** the tenant sign-in page renders its brand/context panel
- **THEN** the panel heading and description measure at least 4.5:1 on slate-900 (slate-100: 16.30:1; slate-300: 12.02:1)

### Requirement: Room dashboard meets AA

The authorized `/rooms/[room]` view SHALL meet 4.5:1 for all normal text and 3:1 for large text on its dark shell.

#### Scenario: Section captions and lease labels

- **WHEN** the authorized room dashboard renders
- **THEN** the last-updated caption measures at least 4.5:1 on slate-950 (slate-300: 13.59:1) and the three lease stat labels measure at least 4.5:1 on slate-900 (slate-300: 12.02:1)

#### Scenario: Headings and card content

- **WHEN** the authorized room dashboard renders
- **THEN** the room heading, section headings, bill/payment rows, breakdown labels, and lease values measure at least 4.5:1 (room heading slate-100 on slate-950: 18.41:1; section headings, payment rows, and lease values slate-100 on slate-900: 16.30:1; bill rows remain at least 16.30:1 on their translucent card; secondary labels slate-300 on slate-900: 12.02:1)

#### Scenario: Bill and payment status badges

- **WHEN** a bill or payment status badge renders
- **THEN** its localized status text measures at least 4.5:1 against the badge background, and the status remains understandable without colour

### Requirement: Not authorized view meets AA

The `/rooms/[room]` denial view SHALL meet 4.5:1 for all text on its dark shell, including the centered denial card.

#### Scenario: Unauthorized or expired tenant session

- **WHEN** a request for `/rooms/[room]` is unauthenticated, belongs to another room, or carries a stale session version
- **THEN** "Not authorized", its subtitle, and the back link measure at least 4.5:1 on slate-950 or the slate-900 card (slate-100: 18.41:1; slate-400: 7.87:1; slate-300: 13.59:1 on slate-950 and 12.02:1 on slate-900; hover white: 20.17:1)

### Requirement: Admin sign-in page meets AA

All text and form controls on `/admin/login`, including the brand/context panel, SHALL meet 4.5:1 for text and 3:1 for boundaries and focus indication.

#### Scenario: Admin password form

- **WHEN** the admin sign-in page renders in either OS colour scheme
- **THEN** the heading, subtitle, label, error text, and button measure at least 4.5:1 (slate-100 16.30:1, slate-400 6.96:1, slate-300 12.02:1, red-400 6.45:1, slate-950 on slate-100 18.41:1) and the password input's border and focus indicator each measure at least 3:1 against slate-950 and slate-900

#### Scenario: Admin brand panel

- **WHEN** the admin sign-in page renders its brand/context panel
- **THEN** the panel heading and description measure at least 4.5:1 on slate-900 (slate-100: 16.30:1; slate-300: 12.02:1)

### Requirement: Large text meets 3:1

Text at or above 24px, or at or above 18.66px and bold, SHALL measure at least 3:1 against its background.

#### Scenario: Page headings

- **WHEN** any page heading renders
- **THEN** it measures at least 3:1 (room heading slate-100 on slate-950: 18.41:1; card headings slate-100 on slate-900: 16.30:1)

## REMOVED Requirements

### Requirement: Change is colour-only

**Reason**: This requirement froze layout, spacing, copy, and structure to protect contrast, which conflicts with a deliberate layout pass. Contrast should be guaranteed directly instead of by prohibiting layout changes.

**Migration**: Replaced by "Layout revisions preserve contrast" in this capability. Existing colour guarantees remain in force for every new dark surface.

## ADDED Requirements

### Requirement: Layout revisions preserve contrast

Any layout, spacing, or structural revision SHALL preserve this capability's contrast guarantees. Normal text MUST remain at least 4.5:1, large text and graphical boundaries/focus indicators at least 3:1, status MUST NOT be conveyed by colour alone, and pages MUST render identically under both operating-system colour schemes.

#### Scenario: New dark surface

- **WHEN** a new card, panel, divider, or badge is introduced in the dashboard, admin console, sign-in screens, or denial view
- **THEN** its text meets 4.5:1 and its control boundaries and focus indicators meet 3:1 against the adjacent dark surfaces

#### Scenario: Status uses text as well as colour

- **WHEN** a bill or payment status is presented in a new badge or card treatment
- **THEN** localized status text is present and meets 4.5:1, so the meaning does not depend on colour perception

#### Scenario: Focus survives restructuring

- **WHEN** a control is moved into a new header, sidebar, brand panel, or two-column card
- **THEN** keyboard focus remains visible with at least a 3:1 indicator against both the control and its surrounding surface

#### Scenario: Both OS colour schemes

- **WHEN** the redesigned pages render with `prefers-color-scheme: light` or `prefers-color-scheme: dark`
- **THEN** the dark surfaces, text, and control colours are identical in both cases
