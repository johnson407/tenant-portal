# Spec Delta

## Purpose

Guarantees that every portal view is legible under WCAG 2.1 AA in both OS light and dark colour preferences, including inherited text colours, form-control boundaries, and focus indicators.

## ADDED Requirements

### Requirement: Text contrast is evaluated against the effective background

Every rendered text node SHALL have a contrast ratio of at least 4.5:1 against the background actually behind it after colour inheritance, in both `prefers-color-scheme: light` and `prefers-color-scheme: dark`.

#### Scenario: Authorized room dashboard in OS dark mode
- **WHEN** `prefers-color-scheme: dark` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the light page and its white cards — including bill/payment labels, bill/payment amounts, and lease `<dd>` values that have no explicit text class — measures at least 4.5:1 (foreground resolves to slate-900: 17.85:1 on white, 16.30:1 on slate-100), and no text renders as inherited `#ededed` on white or slate-100 (1.17:1 and 1.07:1)

#### Scenario: Authorized room dashboard in OS light mode
- **WHEN** `prefers-color-scheme: light` is active and an authorized tenant opens `/rooms/<their room>`
- **THEN** every text node on the page and cards measures at least 4.5:1, with no layout or copy difference from the dark-mode rendering

### Requirement: Tenant sign-in page meets AA

All text on `/login` SHALL meet 4.5:1 for normal text and the page's UI controls SHALL meet 3:1 for boundaries and focus indication.

#### Scenario: Tenant login footer and form
- **WHEN** the tenant sign-in page renders in either OS colour scheme
- **THEN** the "Landlord?" footer line and "Admin area" link measure at least 4.5:1 on the slate-900 card (footer resolves to slate-300: 12.02:1; link hover resolves to white: 17.85:1), the inputs' placeholders measure at least 4.5:1 (slate-400 on slate-950: 7.87:1), and the input/select border and focus indicator each measure at least 3:1 against both slate-950 and slate-900

### Requirement: Room dashboard meets AA

The authorized `/rooms/[room]` view SHALL meet 4.5:1 for all normal text and 3:1 for large text.

#### Scenario: Section captions and lease labels
- **WHEN** the authorized room dashboard renders
- **THEN** the three "(sample data)" captions measure at least 4.5:1 on slate-100 (slate-700: 9.45:1) and the three lease `<dt>` labels measure at least 4.5:1 on white (slate-700: 10.35:1)

#### Scenario: Headings and card content
- **WHEN** the authorized room dashboard renders
- **THEN** the room heading, section headings, bill/payment rows, and lease values measure at least 4.5:1 (headings slate-800/slate-900: 14.63:1/17.85:1; body slate-900: 17.85:1 on white, 16.30:1 on slate-100)

### Requirement: Not authorized view meets AA

The `/rooms/[room]` denial view SHALL meet 4.5:1 for all text on its dark background.

#### Scenario: Unauthorized or expired tenant session
- **WHEN** a request for `/rooms/[room]` is unauthenticated, belongs to another room, or carries a stale session version
- **THEN** "Not authorized", its subtitle, and the back link measure at least 4.5:1 on slate-950 (slate-100: 18.41:1; slate-400: 7.87:1; slate-300: 13.59:1; hover white: 20.17:1)

### Requirement: Admin sign-in page meets AA

All text and form controls on `/admin/login` SHALL meet 4.5:1 for text and 3:1 for boundaries and focus indication.

#### Scenario: Admin password form
- **WHEN** the admin sign-in page renders in either OS colour scheme
- **THEN** the heading, subtitle, label, error text, and button measure at least 4.5:1 (slate-100 16.30:1, slate-400 6.96:1, slate-300 12.02:1, red-400 6.45:1, slate-950 on slate-100 18.41:1) and the password input's border and focus indicator each measure at least 3:1 against slate-950 and slate-900

### Requirement: Admin reset page and success panel meet AA

`/admin` SHALL meet 4.5:1 for text in the reset form and in the reset-success panel, and 3:1 for form-control boundaries and focus indication.

#### Scenario: Reset form controls
- **WHEN** the admin reset form renders its idle or error state
- **THEN** the room select and code input borders and focus indicators each measure at least 3:1 against slate-950 and slate-900, and the code input placeholder measures at least 4.5:1 on slate-950 (slate-400: 7.87:1)

#### Scenario: Reset-success panel
- **WHEN** a reset succeeds and the amber panel renders
- **THEN** the confirmation text, one-time code, warning, and "Reset another room" control measure at least 4.5:1 (slate-900 on amber-50 17.22:1; red-700 6.24:1; slate-600 7.31:1) and the white-on-slate-900 Copy button measures at least 4.5:1 (17.85:1)

### Requirement: UI component boundaries and focus indicators meet 3:1

Borders that identify text inputs and selects, and the focus indicator on every interactive control, SHALL have at least 3:1 contrast against the adjacent colours. Decorative card borders and separators are exempt but SHOULD remain visibly distinct.

#### Scenario: Input and select boundaries
- **WHEN** any text input or select is rendered on `/login`, `/admin/login`, or `/admin`
- **THEN** its border measures at least 3:1 against both the field fill (slate-950) and the card behind it (slate-900); slate-500 achieves 4.24:1 and 3.75:1 respectively

#### Scenario: Keyboard focus indication
- **WHEN** a user focuses any text input, select, or button by keyboard
- **THEN** a visible focus indicator is drawn in a colour measuring at least 3:1 against the control and the surrounding card (slate-300 ring: 13.59:1 on slate-950, 12.02:1 on slate-900), replacing the previous outline-suppressed state

### Requirement: Large text meets 3:1

Text at or above 24px, or at or above 18.66px and bold, SHALL measure at least 3:1 against its background.

#### Scenario: Page headings
- **WHEN** any page heading renders
- **THEN** it measures at least 3:1 (room heading slate-900 on slate-100: 16.30:1; dark-page headings slate-100 on slate-900/slate-950: 16.30:1/18.41:1)

### Requirement: Change is colour-only

The change SHALL NOT alter layout, spacing, copy, component structure, page behaviour, or dependencies; only colour-related utility classes may differ.

#### Scenario: No non-colour change
- **WHEN** the rendered markup of each affected page is compared before and after the change
- **THEN** element structure, text content, and layout classes are identical, and the only differences are colour utilities (text, background, border, divide, ring, placeholder)
