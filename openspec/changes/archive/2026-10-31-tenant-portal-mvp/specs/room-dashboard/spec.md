# Spec Delta

## Purpose

Presents each authenticated tenant a private dashboard for their own room, showing bills, payments, and lease dates as placeholder data for the MVP.

## ADDED Requirements

### Requirement: Room dashboard display
For each authenticated tenant with a valid session, the system SHALL display a dashboard for their room showing bills, payments, and lease dates.

#### Scenario: Tenant views own dashboard
- **WHEN** the tenant authenticated for room `E` opens their dashboard
- **THEN** the page shows room E's bills, payments, and lease dates

#### Scenario: Unauthenticated access attempt
- **WHEN** a visitor without a valid session requests any room dashboard
- **THEN** the system redirects them to the tenant login page

### Requirement: Placeholder data
For the MVP, the dashboard's bills, payments, and lease dates SHALL be placeholder content that does not contain any tenant personal information.

#### Scenario: No personal data rendered
- **WHEN** any room dashboard is rendered
- **THEN** the placeholder content contains no tenant names, phone numbers, or email addresses
