# Spec Delta

## ADDED Requirements

### Requirement: Open bill meter breakdown

The room dashboard SHALL show the water and electricity meter breakdown under an open bill when the bill carries one. It SHALL show the start reading, end reading, consumed units, and price per unit, with the cost already shown as the amount. A utility without a breakdown SHALL show its amount only. The payment history SHALL stay unchanged.

#### Scenario: Water breakdown appears
- **WHEN** an open bill has a complete water meter group
- **THEN** the bill shows the water start reading, end reading, units, and price per unit next to the water amount

#### Scenario: Electricity breakdown appears
- **WHEN** an open bill has a complete electricity meter group
- **THEN** the bill shows the electricity start reading, end reading, units, and price per unit next to the electricity amount

#### Scenario: Both utilities have a breakdown
- **WHEN** an open bill has complete groups for water and electricity
- **THEN** the bill shows two separate breakdown lines, each with its own readings and rate

#### Scenario: Missing breakdown
- **WHEN** an open bill has no meter group for a utility
- **THEN** the bill shows that utility's amount with no reading or rate

#### Scenario: Breakdown follows the locale
- **WHEN** the dashboard renders in `zh-TW` or `en`
- **THEN** the breakdown labels use that locale's dictionary and the numbers use that locale's formatting

#### Scenario: Payment history stays unchanged
- **WHEN** the tenant expands the payments disclosure
- **THEN** each payment shows its period, amount, and received date, with no meter readings or rate

#### Scenario: Unavailable feed shows no breakdown
- **WHEN** the room feed is unavailable
- **THEN** no meter reading or rate renders, and the generic unavailable state remains
