# Spec Delta

## MODIFIED Requirements

### Requirement: Tenant sign-in by room letter and access code

The system SHALL authenticate a tenant by accepting a room letter (A–E) and a room password of 4–64 alphanumeric characters (`A–Z`, `a–z`, `0–9`), and SHALL establish a session only when both match the stored values for that room.

#### Scenario: Successful login

- **WHEN** a tenant submits room letter "B" with the correct current password for room B
- **THEN** the system establishes a session for room B and redirects the tenant to the room B dashboard

#### Scenario: Wrong access code

- **WHEN** a tenant submits room letter "C" with a 4–64 character alphanumeric password that is not room C's current password
- **THEN** the system rejects the login without establishing a session and reports invalid credentials

#### Scenario: Unknown or invalid room letter

- **WHEN** a tenant submits a room letter outside A–E, or a password shorter than 4 characters, longer than 64 characters, or containing non-alphanumeric characters
- **THEN** the system rejects the login without revealing which field was wrong

#### Scenario: Existing 10-character code remains usable

- **WHEN** a room's stored password is a pre-existing 10-character alphanumeric code and the tenant submits that exact code
- **THEN** the system accepts the login because 10 characters satisfies the 4–64 character policy
