# Design

## Context

Greenfield project: the repo currently contains only this planning home, a README, and a `.gitignore` already covering `.env*`, `.next/`, `.vercel/`, and `node_modules/`. No application code exists yet. Motivation is in proposal.md; behavior contracts are in the three spec deltas (`tenant-auth`, `room-dashboard`, `admin-reset`).

Key constraints shaping the design:

- Five rooms, fixed: A, B, C, D, E. Room letters are the only tenant identifiers.
- Access codes are exactly 10 characters, supplied at deploy time via env vars, never committed; bcrypt hashes are the preferred seed form.
- Zero tenant PII anywhere: no names, phones, or emails in data, logs, cookies, or analytics.
- One small persistent store is needed because backend runtime is serverless.

## Goals / Non-Goals

**Goals:**

- Secure tenant sign-in per room with bcrypt code verification and a signed, httpOnly session cookie
- Per-room dashboard pages scoped strictly to the session's room letter
- Admin area gated by `ADMIN_PASSWORD` with per-room code reset that persists
- Deployment to Vercel with all secrets environment-sourced

**Non-Goals:**

- Real billing/lease data integration (dashboard content is placeholder)
- Tenant self-service code changes, password recovery, or email flows
- Any persistence of tenant personal information, ever
- Multi-room or multi-landlord tenancy models

## Decisions

- **Next.js App Router + TypeScript + Tailwind**: matches the user's stated stack and deploy target. Server Components render dashboards; auth checks happen in server-side middleware and server actions, so hashes and secrets never reach the client.

- **Hashed codes seeded from env, verified with bcrypt**: the preferred seed form is precomputed bcrypt hashes (`ROOM_A_HASH` … `ROOM_E_HASH`); plaintext 10-char codes in env (`ROOM_A_CODE` …) are supported as a fallback the app hashes once at start and caches. The app always compares submissions against the room's current bcrypt hash; plaintext codes never appear in logs, source, or responses. Alternative considered: plaintext codes in a database — rejected outright by the no-PII/minimal-data posture and "hashes only" spec.

- **One tiny persistent store for code hashes (Vercel KV / Upstash Redis, one key per room)**: admin reset must persist a new hash at runtime; env vars are immutable between deploys, so env alone cannot support rotation. The store holds at most five bcrypt-hash strings (`room:<letter>`), seeded from env hashes on first use per room ("seed-on-first-use"). Alternatives considered: writing env vars via the Vercel API from runtime (rejected — fragile and credential-heavy); a SQL database (rejected — overkill for five strings).

- **Signup-free per-room identity**: there is no user table. A "tenant" is fully represented by a room letter. Rationale: with 5 fixed rooms and a no-PII mandate, any user record would either be redundant or hold personal data. Room metadata is a static TypeScript map over rooms A–E.

- **Signed JWT-in-cookie sessions via `jose` (HS256)**: cookie `tp_session`, `httpOnly; Secure; SameSite=Lax`, short expiry (e.g., 7 days), payload `{ role: "tenant" | "admin", room?: "a"…"e", exp }`. One cookie with a `role` claim keeps tenant/admin grants unmistakable; middleware and server actions both check `role` and `room`. Alternative considered: `iron-session` — functionally equivalent; `jose` is lighter. Admin-only flows live under `/admin`, tenant flows under `/`.

- **Room scoping in one place**: server component for `/rooms/[room]` re-derives scope from the session claim (`session.room === params.room`), never trusting the URL alone, so a room-A tenant requesting `/rooms/b` is denied. Middleware handles redirects (to `/login` or `/admin/login`) as a convenience layer, not the security boundary.

- **Admin auth and reset**: `ADMIN_PASSWORD` env var compared with a timing-safe comparison; on success an admin session (`role: "admin"`) is issued. Reset action (admin-only): accepts or generates a new 10-character code for a room → bcrypt-hashes it (cost 12) → writes the hash to the persistent store → returns the plaintext code exactly once in the admin UI response (never logged). Alternative considered: letting tenants self-rotate codes (rejected for MVP).

- **Rate limiting tenant + admin login attempts**: simple per-IP + per-room counters in the same KV store with short TTL (e.g., 10 fails/15 min), since KV is already a dependency. Alternative considered: no limiter for MVP (rejected — a 10-char code with no limiter invites automated guessing against a public form).

- **Placeholder dashboard content**: static, typed placeholder data per room (bills, payments, lease dates), clearly labeled as sample data. Contains no personal info. Structured so a future change can swap the data source without touching the page shell.

- **Privacy enforcement**: no analytics endpoints, no logging of submitted codes or cookies, no form fields beyond room letter/code and admin password, no PII in any module or KV key.

- **Runtime selection: Node.js runtime for all routes/actions** (bcryptjs and the KV SDK both run happily; avoids edge/Node mismatch).

## Risks / Trade-offs

- [Plaintext seed codes in Vercel env vars if hashes are not precomputed] → Treat pre-hashed env vars (`ROOM_*_HASH`) as the preferred form; plaintext never touches git (`.gitignore` already excludes `.env*`), and the landlord can rotate immediately after first deploy.
- [KV wipe reverts codes to seeded env hashes] → Seed-on-first-use restores a known state; document that rotation must be re-done after any KV data loss.
- [Brute-force of the 10-char code on the public login] → Rate limiting above plus 10-char minimum length; no usernames to enumerate.
- [Session secret loss/rotation invalidates all sessions] → Tenants simply log in again; documented procedure.
- [Placeholder data mistaken for real amounts/dates] → Label dashboard sections as sample data until real data arrives.
- [Admin plaintext display could be overlooked] → Admin UI makes the one-time code prominent (copy button + "never shown again" warning).
- [Middleware-only guards are convenient but not sufficient] → Server-side claim checks are the security boundary; middleware is UX only.

## Migration Plan

Greenfield — no migration. Deployment order:
1. Provision KV store in Vercel; set env vars (`SESSION_SECRET`, `ADMIN_PASSWORD`, `ROOM_*_HASH` or `ROOM_*_CODE`).
2. Deploy to Vercel; verify tenant login for each room works and a wrong code fails.
3. Exercise admin login and one room code reset; verify the new code persists across a fresh deployment.
4. Rollback: redeploy previous build; clearing the five KV hash keys re-seeds from env on next use.

## Open Questions

- Exact KV flavor (Vercel KV vs direct Upstash) — either fits; decide at setup from pricing.
- Whether tenants should optionally generate their own code at first sign-in from a landlord-provided one-time setup code — deferred; does not change the specs' observable behavior.
- Whether admin reset generates a random code or records a landlord-chosen one — both are permitted by the specs (form can support both); default to admin-generated random code shown once, with an optional "let me choose" field.
