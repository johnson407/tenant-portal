# Spec Delta

## MODIFIED Requirements

### Requirement: Admin console layout

The admin console SHALL place the room-code reset and bank-account sections in separate cards in a responsive two-column layout at large viewports, with the pending-claims card full width below. The one-time reset result MUST stay visible inside the reset card when the layout collapses. A bank-account read failure MUST render an unavailable card in the bank column without disabling reset. A claim-list read failure MUST render an unavailable notice in the claims card without disabling the other cards.

#### Scenario: Desktop side-by-side
- **WHEN** the admin console is rendered at a large viewport
- **THEN** the reset card appears in one column and the bank-account card in the other

#### Scenario: Claims card spans the width
- **WHEN** the admin console is rendered at a large viewport with pending claims
- **THEN** the claims card appears below the other two cards and spans the content width

#### Scenario: Mobile stack
- **WHEN** the admin console is rendered at a 390-pixel-wide viewport
- **THEN** the reset card, the bank-account card, and the claims card stack in that order in a single column

#### Scenario: Reset success
- **WHEN** a room code reset succeeds
- **THEN** the one-time code result stays visible inside the reset card with its copy control and warning

#### Scenario: Bank account unavailable
- **WHEN** the shared bank account cannot be read
- **THEN** the bank column shows an unavailable notice and the reset card remains usable

#### Scenario: Claims unavailable
- **WHEN** the pending claim list cannot be read
- **THEN** the claims card shows an unavailable notice and the reset and bank cards remain usable
