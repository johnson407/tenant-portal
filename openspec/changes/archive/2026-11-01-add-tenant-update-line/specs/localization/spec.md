# localization Specification Delta

## ADDED Requirements

### Requirement: Localized tenant update copy

All user-facing copy for the latest-update line SHALL come from the dictionary for the active locale. This includes the line label, the repair-completed and payment-confirmed event labels, the note label, and any empty state when the line is absent. Both locales SHALL have complete copy, with no fallback text from the other locale.

#### Scenario: Traditional Chinese update line
- **WHEN** a tenant opens `/zh-TW/rooms/a` with a completed repair
- **THEN** the line label, repair-completed label, and note label are Traditional Chinese

#### Scenario: English update line
- **WHEN** a tenant opens `/en/rooms/a` with a confirmed claim
- **THEN** the line label, payment-confirmed label, and note label are English

#### Scenario: No mixed locale
- **WHEN** the update line renders in either locale
- **THEN** no label or note caption comes from the other locale

#### Scenario: Event labels are distinct
- **WHEN** the latest event changes from a repair to a claim
- **THEN** the line uses the matching localized event label for the new event

### Requirement: Localized confirmation and completion errors

Validation and error messages for claim confirmation and repair completion notes SHALL be shown in the active locale. A Server Action MUST return a locale-independent error code, and the form for the active locale SHALL map that code to its dictionary entry. This includes invalid date, invalid note, unavailable, rate, already-done, not-found, and generic errors.

#### Scenario: Confirmation errors in Traditional Chinese
- **WHEN** an admin submits an invalid paid date or note on `/zh-TW/admin`
- **THEN** the page shows the Traditional Chinese confirmation error for that failure

#### Scenario: Confirmation errors in English
- **WHEN** an admin confirms an already paid claim on `/en/admin`
- **THEN** the page shows the English confirmation error

#### Scenario: Completion note errors in Traditional Chinese
- **WHEN** an admin submits an invalid completion note on `/zh-TW/admin`
- **THEN** the page shows the Traditional Chinese note error

#### Scenario: Completion note errors in English
- **WHEN** an admin submits an invalid completion note on `/en/admin`
- **THEN** the page shows the English note error

#### Scenario: Same failure, correct locale
- **WHEN** the same confirmation failure occurs in both locales
- **THEN** each form shows the message from its own dictionary and neither shows a raw error code

### Requirement: Latest update date formatting

The latest-update date SHALL use the active locale's date conventions and MUST NOT shift to another calendar day because of timezone conversion. The event date SHALL be formatted from the stored ISO date, not from the page load time.

#### Scenario: Traditional Chinese event date
- **WHEN** the latest event date is `2026-11-01` and the locale is `zh-TW`
- **THEN** the line shows the date in Traditional Chinese format, such as `2026年11月1日`

#### Scenario: English event date
- **WHEN** the latest event date is `2026-11-01` and the locale is `en`
- **THEN** the line shows the date in English format, such as `Nov 1, 2026`

#### Scenario: Date does not shift
- **WHEN** the server runs in any timezone and the latest event date is `2026-11-01`
- **THEN** the line still shows November 1, 2026

#### Scenario: Event date is not the load time
- **WHEN** the page loads on a later day than the latest event
- **THEN** the line shows the stored event date and not the current date
