# Spec Delta

## MODIFIED Requirements

### Requirement: Room code reset

While in an admin session, the system SHALL allow resetting the access code of any room (A–E) by accepting a 4–64 character alphanumeric password, or generating a random 10-character alphanumeric password when the submitted field is blank, hashing the result with bcrypt, and replacing that room's stored hash; the plaintext MUST be shown to the admin once and never stored.

#### Scenario: Successful reset

- **WHEN** the admin resets the access code for room `B` with a 4–64 character alphanumeric password
- **THEN** room B's stored bcrypt hash is replaced and the tenant of room B must sign in with the new password

#### Scenario: Successful reset with a generated password

- **WHEN** the admin submits the reset form for room `C` with the new-password field blank
- **THEN** the system generates a random 10-character alphanumeric password, stores only its bcrypt hash, and shows the plaintext to the admin once

#### Scenario: Out-of-policy password rejected

- **WHEN** the admin submits a non-blank password shorter than 4 characters, longer than 64 characters, or containing non-alphanumeric characters
- **THEN** the system rejects the reset without changing the stored hash and reports invalid input

#### Scenario: Reset requires admin session

- **WHEN** a tenant session or unauthenticated request attempts the code-reset action
- **THEN** the system denies the action without changing any stored hash
