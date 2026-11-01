# Spec Delta

## MODIFIED Requirements

### Requirement: Responsive content structure

Portal content SHALL be constrained to a centered container, approximately 72rem wide on dashboard and admin pages, and SHALL use the specified multi-column arrangement at large viewports while collapsing to one column at mobile widths. The tenant repair section SHALL span the content width below the bills and side column. DOM order MUST match reading and focus order in every arrangement, and no supported viewport may require horizontal scrolling.

#### Scenario: Desktop tenant dashboard
- **WHEN** the tenant dashboard is rendered at a 1280-pixel-wide viewport
- **THEN** open bills occupy the main column and bank details plus payment history occupy a narrower side column, with the repair section spanning the width below them

#### Scenario: Desktop admin console
- **WHEN** the admin console is rendered at a 1280-pixel-wide viewport
- **THEN** the room-code reset card and bank-account card appear side by side, with the claims and repairs cards full width below

#### Scenario: Desktop sign-in
- **WHEN** either sign-in page is rendered at a 1280-pixel-wide viewport
- **THEN** a brand/context panel and the form card appear side by side within the centered container

#### Scenario: Mobile stack
- **WHEN** any portal page is rendered at a 390-pixel-wide viewport
- **THEN** its sections stack in a single column in reading order, with the repair section after the bills and side content on the dashboard and after the claims card on the admin console

#### Scenario: Reading order
- **WHEN** a multi-column layout collapses to one column
- **THEN** the visual order matches the DOM order used by keyboard focus

### Requirement: Section and status presentation

Page content SHALL be organized into raised section cards with a heading, optional caption, consistent internal padding, and dividers between related rows. Empty, unavailable, and status states MUST use dedicated card or badge treatments and MUST include localized text, so colour is never the only cue.

#### Scenario: Bill card
- **WHEN** an open bill is displayed
- **THEN** it appears as a card showing the billing period, total, due date, breakdown labels, and a status badge with localized status text

#### Scenario: Empty bills
- **WHEN** the room has no open bills
- **THEN** the bills card shows the localized no-bills message instead of an empty list

#### Scenario: Unavailable feed
- **WHEN** AppFeed data is unavailable for the room
- **THEN** a dedicated unavailable card replaces the affected lease, bills, payment, or repair content without exposing placeholder amounts or dates

#### Scenario: Bank account card
- **WHEN** a bank account is configured
- **THEN** its labeled values appear in a side-column card with the same heading and divider treatment as other sections

#### Scenario: Status is not colour-only
- **WHEN** a bill, payment, or repair status is displayed
- **THEN** the localized status text is present in addition to any colour treatment

#### Scenario: Repair card
- **WHEN** a repair request is displayed
- **THEN** it appears in a section card with its category, note, submitted date, and a localized status badge

#### Scenario: Empty repairs
- **WHEN** the room has no repair requests
- **THEN** the repair card shows the localized empty message and still shows the form

#### Scenario: Unavailable repairs
- **WHEN** the Repairs tab cannot be read
- **THEN** a dedicated unavailable card replaces the repair form and history without hiding the other cards

### Requirement: Admin console layout

The admin console SHALL place the room-code reset and bank-account sections in separate cards in a responsive two-column layout at large viewports, with the pending-claims and pending-repairs cards full width below. The one-time reset result MUST stay visible inside the reset card when the layout collapses. A bank-account, claim-list, or repair-list read failure MUST render an unavailable notice in its own card without disabling the other cards.

#### Scenario: Desktop side-by-side
- **WHEN** the admin console is rendered at a large viewport
- **THEN** the reset card appears in one column and the bank-account card in the other

#### Scenario: Claims card spans the width
- **WHEN** the admin console is rendered at a large viewport with pending claims
- **THEN** the claims card appears below the other two cards and spans the content width

#### Scenario: Repairs card spans the width
- **WHEN** the admin console is rendered at a large viewport with pending repairs
- **THEN** the repairs card appears below the claims card and spans the content width

#### Scenario: Mobile stack
- **WHEN** the admin console is rendered at a 390-pixel-wide viewport
- **THEN** the reset card, the bank-account card, the claims card, and the repairs card stack in that order in a single column

#### Scenario: Reset success
- **WHEN** a room code reset succeeds
- **THEN** the one-time code result stays visible inside the reset card with its copy control and warning

#### Scenario: Bank account unavailable
- **WHEN** the shared bank account cannot be read
- **THEN** the bank column shows an unavailable notice and the reset card remains usable

#### Scenario: Claims unavailable
- **WHEN** the pending claim list cannot be read
- **THEN** the claims card shows an unavailable notice and the reset and bank cards remain usable

#### Scenario: Repairs unavailable
- **WHEN** the pending repair list cannot be read
- **THEN** the repairs card shows an unavailable notice and the other cards remain usable

### Requirement: Behavior preservation

The layout system MUST preserve server rendering and no-JavaScript operation, locale-prefixed navigation, localized copy, authorization and rate limits, AppFeed ordering and caps, and the collapsed-by-default payment disclosure. It MUST NOT add runtime dependencies, routes, or environment variables. It MAY read the repair data defined by the repair-requests capability.

#### Scenario: No-JavaScript disclosure
- **WHEN** the tenant dashboard is rendered with client-side JavaScript disabled
- **THEN** the payment history remains a native disclosure and opens without script

#### Scenario: No-JavaScript repair actions
- **WHEN** client-side JavaScript is disabled and a tenant submits a repair or an admin marks one done
- **THEN** the action runs, the page reloads, and the new state shows

#### Scenario: Locale switch
- **WHEN** a user switches locale from a room dashboard
- **THEN** the equivalent dashboard opens in the other locale with the same room path

#### Scenario: Payments stay collapsed
- **WHEN** the dashboard first renders
- **THEN** the payment history disclosure is closed by default

#### Scenario: Authorization unchanged
- **WHEN** a tenant session is expired or invalid
- **THEN** the protected page still redirects to the localized sign-in page
