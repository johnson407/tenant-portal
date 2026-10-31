# Spec Delta

## MODIFIED Requirements

### Requirement: Tenant bank account display

The system SHALL show the configured bank account on each authenticated tenant dashboard as a reference section listing the bank name, recipient name, bank code, and account number. The section SHALL be shown regardless of AppFeed availability and MUST NOT appear when no record is configured or the record cannot be read.

#### Scenario: Bank details shown to tenant
- **WHEN** an authenticated tenant opens their room dashboard while a bank account is configured
- **THEN** the dashboard shows all four saved values under a localized bank account heading

#### Scenario: AppFeed unavailable does not hide bank details
- **WHEN** the tenant dashboard shows the AppFeed unavailable state but a bank account is configured
- **THEN** the bank account section still renders

#### Scenario: Unconfigured account is hidden
- **WHEN** no bank account is configured
- **THEN** the dashboard renders no bank account heading and no empty or placeholder bank values

#### Scenario: Read failure hides only the section
- **WHEN** reading the bank account fails while the tenant dashboard renders
- **THEN** the bank account section is omitted and the bills, payments, and header lease facts still render normally
