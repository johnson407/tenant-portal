# Spec Delta

## Purpose

Gives the landlord one admin-maintained bank account record and shows those transfer details to tenants so rent can be paid without asking for them separately.

## ADDED Requirements

### Requirement: Bank account record

The system SHALL maintain exactly one bank account record, shared by every room, containing a bank name, recipient name, bank code, and account number. All four fields SHALL be required and stored after trimming surrounding whitespace. The absence of a record SHALL mean that no bank account is configured.

#### Scenario: One record serves every room
- **WHEN** the landlord saves a bank account and a tenant of any room A-E opens their dashboard
- **THEN** each room sees the same bank name, recipient name, bank code, and account number

#### Scenario: No record configured
- **WHEN** no bank account has ever been saved
- **THEN** the admin form fields are empty and no tenant dashboard shows a bank account section

### Requirement: Admin-only bank account editing

Only an authenticated admin session SHALL be able to read or replace the bank account record. The admin page SHALL show the saved values prefilled when a record exists, and saving SHALL replace all four fields at once.

#### Scenario: Admin saves transfer details
- **WHEN** an admin session submits a valid bank name, recipient name, bank code, and account number
- **THEN** the record is saved and the admin sees a localized confirmation

#### Scenario: Admin page prefills saved values
- **WHEN** an admin opens the admin page while a bank account is configured
- **THEN** the form shows the saved bank name, recipient name, bank code, and account number

#### Scenario: Non-admin cannot write
- **WHEN** a tenant session or an unauthenticated request attempts the bank account save action
- **THEN** the system denies the action without reading or changing the stored record

### Requirement: Bank account validation

Before saving, the system SHALL validate the bank name and recipient name as 1-80 characters with no control characters, the bank code as 3-7 digits, and the account number as 6-20 digits. Invalid input SHALL be rejected without changing the stored record, and the form SHALL show a localized validation message.

#### Scenario: Malformed bank code rejected
- **WHEN** the admin submits a bank code containing letters, spaces, or fewer than three digits
- **THEN** the save is rejected and the previous record is unchanged

#### Scenario: Formatted account number rejected
- **WHEN** the admin submits an account number containing spaces, hyphens, or non-digit characters
- **THEN** the save is rejected with a localized message

#### Scenario: Surrounding whitespace is trimmed
- **WHEN** the admin submits `  玉山銀行  ` as the bank name and ` 808 ` as the bank code
- **THEN** the stored values are `玉山銀行` and `808`

#### Scenario: Blank required field rejected
- **WHEN** any of the four fields is blank or whitespace only
- **THEN** the save is rejected and the previous record is unchanged

### Requirement: Bank account storage failure

If the KV store is unavailable or the write fails, the system SHALL leave the previous record unchanged and show a generic localized failure instead of a success. If the current record cannot be read when the admin page loads, the page SHALL show a generic unavailable notice instead of an empty form.

#### Scenario: Write failure keeps previous values
- **WHEN** a save fails while a record already exists
- **THEN** the admin sees a generic failure and the previous record is still served to tenants

#### Scenario: Read failure does not invite overwriting
- **WHEN** the admin page cannot read the record because the KV store is unavailable
- **THEN** the page shows the localized unavailable notice and does not present an empty editable form

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
- **THEN** the bank account section is omitted and the bills, payments, and lease sections still render normally

### Requirement: Bank detail confidentiality

The system MUST NOT write the recipient name or account number to logs, error messages, page metadata, or any response available to an unauthenticated request. Bank detail reads and writes SHALL occur only on the server.

#### Scenario: Logs stay free of bank values
- **WHEN** a bank account read or write fails
- **THEN** the log contains only a fixed reason, never the recipient name, bank code, or account number

#### Scenario: Anonymous request gets no bank details
- **WHEN** an unauthenticated visitor requests a room dashboard or the admin page
- **THEN** no bank account value appears in the response
