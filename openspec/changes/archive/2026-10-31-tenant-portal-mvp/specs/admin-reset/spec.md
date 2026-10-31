# Spec Delta

## Purpose

Provides a landlord-only admin area, guarded by an environment-variable password, with the ability to reset any room's access code.

## ADDED Requirements

### Requirement: Admin authentication
The admin area SHALL require a password supplied via the `ADMIN_PASSWORD` environment variable, and MUST NOT be reachable without a valid admin session established by submitting that password.

#### Scenario: Admin signs in
- **WHEN** the user submits the correct `ADMIN_PASSWORD` value at the admin sign-in
- **THEN** the system creates an admin session and grants access to the admin area

#### Scenario: Wrong admin password
- **WHEN** the user submits an incorrect password at the admin sign-in
- **THEN** the system rejects entry with a generic failure message and no admin session is created

#### Scenario: Admin session absent
- **WHEN** a visitor without an admin session requests any admin page
- **THEN** the system redirects them to the admin sign-in

### Requirement: Room code reset
While in an admin session, the system SHALL allow resetting the access code of any room (A–E) by hashing the new code with bcrypt and replacing that room's stored hash; the plaintext new code MUST be shown to the admin once and never stored.

#### Scenario: Successful reset
- **WHEN** the admin resets the access code for room `B` with a new 10-character code
- **THEN** room B's stored bcrypt hash is replaced and the tenant of room B must sign in with the new code

#### Scenario: Reset requires admin session
- **WHEN** a tenant session or unauthenticated request attempts the code-reset action
- **THEN** the system denies the action without changing any stored hash
