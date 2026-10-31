# Proposal

## Why

The landlord needs a minimal web portal so tenants of rooms A–E can view their own room's status (bills, payments, lease dates) without sharing personal data or managing accounts. No existing system does this; the MVP replaces ad-hoc manual updates with self-service access per room.

## What Changes

- Build a Next.js (App Router, TypeScript, Tailwind) app deployable to Vercel
- Add tenant login: room letter (A–E) plus a 10-character access code
- Store only bcrypt hashes of access codes; codes are seeded from environment variables, never committed
- Issue a signed, httpOnly session cookie after successful login
- Add per-room tenant dashboard showing bills, payments, and lease dates (placeholder data for now); tenants see only their own room
- Add admin area protected by an `ADMIN_PASSWORD` env var, allowing reset of a room's access code (new hash written to env-configured secret store)
- Store NO tenant personal information (no names, phones, emails) anywhere in the system
- Planning-only change: proposal and design documents; application code is a later change

## Capabilities

### New Capabilities

- `tenant-auth`: Tenant sign-in by room letter plus 10-character access code; bcrypt-only code storage seeded from env; signed httpOnly session cookie; session-guarded access so each tenant sees only their own room
- `room-dashboard`: Per-room tenant dashboard displaying bills, payments, and lease date placeholders, visible only to the authenticated tenant of that room
- `admin-reset`: Admin-only area guarded by `ADMIN_PASSWORD` env var with the ability to reset any room's access code

### Modified Capabilities

(none — no existing specs)

## Impact

- New application codebase (Next.js App Router, TypeScript, Tailwind) deployed on Vercel
- New dependencies: `bcrypt` (hashing), session-signing library (e.g., `iron-session` or `jose`)
- Environment variables: room access codes (or their bcrypt hashes), `ADMIN_PASSWORD`, session secret
- Privacy constraint: no tenant personal data stored in DB, logs, cookies, or Vercel analytics
- No existing specs or code are modified; this is the initial capability set
