# Spec Delta

## Purpose

Let a tenant of one of rooms A–E sign in with a room letter plus a 10-character access code, and keep them signed in via a signed httpOnly session cookie, so they can view only their own room's information. Codes are stored exclusively as bcrypt hashes seeded from environment variables; no tenant personal information is ever stored.

## ADDED Requirements

### Requirement: Tenant sign-in by room letter and access code
The system SHALL authenticate a tenant by accepting a room letter (A–E) and a 10-character access code, and SHALL establish a session only when both match the seeded values for that room.

#### Scenario: Successful login
- **WHEN** a tenant submits room letter "B" with the correct current 10-character access code for room B
- **THEN** the system establishes a session for room B and redirects the tenant to the room B dashboard

#### Scenario: Wrong access code
- **WHEN** a tenant submits room letter "C" with a 10-character code that is not room C's current code
- **THEN** the system rejects the login without establishing a session and reports invalid credentials

#### Scenario: Unknown or invalid room letter
- **WHEN** a tenant submits a room letter outside A–E, or an access code whose length differs from 10 characters
- **THEN** the system rejects the login without revealing which field was wrong

### Requirement: Access codes stored only as bcrypt hashes
The system SHALL store access codes only as bcrypt hashes, and MUST NOT store any access code in plain text in the database, logs, or source control.

#### Scenario: Code hashing only
- **WHEN** any access code exists in the system
- **THEN** only its bcrypt hash is persisted and the plain-text code never appears in stored files or logs

### Requirement: Codes seeded from environment, never committed
The system SHALL obtain initial room access codes (or their bcrypt hashes) from environment variables, and MUST NOT contain any seeded code or hash in committed source files.

#### Scenario: Deployment seeds codes from env
- **WHEN** the application starts on Vercel with room code environment variables configured
- **THEN** each room's code is available for verification from that environment configuration and no committed file contains the code

#### Scenario: Missing seed configuration
- **WHEN** one or more room code environment variables are absent at login time
- **THEN** login for the affected rooms fails with a rejection and no fallback default code is used

### Requirement: Signed httpOnly session cookie
The system SHALL maintain tenant login state using a cryptographically signed, httpOnly session cookie that identifies the authenticated room letter, and MUST NOT store tenant personal information in the session.

#### Scenario: Session cookie established
- **WHEN** a tenant logs in successfully
- **THEN** the browser receives an httpOnly, signed session cookie identifying the room

#### Scenario: Invalid cookie rejected
- **WHEN** a browser presents a session cookie with an invalid or missing signature
- **THEN** the system treats the visitor as unauthenticated and denies access to tenant pages

### Requirement: Tenants restricted to their own room
The system SHALL restrict an authenticated tenant to viewing only the room identified by their session, and MUST NOT expose another room's dashboard, bills, payments, or lease information.

#### Scenario: Tenant requests own room
- **WHEN** the authenticated tenant of room A requests the room A dashboard
- **THEN** the system serves the room A dashboard

#### Scenario: Tenant requests another room
- **WHEN** an authenticated tenant of room A requests the dashboard of room B, or any other room's data
- **THEN** the system denies access and does not return room B's information

### Requirement: No tenant personal information stored
The system MUST NOT store tenant personal information (names, phone numbers, email addresses) in any database, file, log, cookie, or analytics record.

#### Scenario: Data model contains only room data
- **WHEN** the system stores any data for rooms A–E
- **THEN** the stored data contains no tenant names, phone numbers, or email addresses
