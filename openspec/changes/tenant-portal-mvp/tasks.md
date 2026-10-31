# Tasks

## 1. Project scaffolding

- [x] 1.1 Scaffold Next.js (App Router) + TypeScript + Tailwind project in the repo root (e.g. via `create-next-app` into this directory) and verify `npm run dev` serves the default page and `npm run build` succeeds (e.g. via `create-next-app` into this directory) and verify `npm run dev` serves the default page and `npm run build` succeeds
- [x] 1.2 Add dependencies `bcryptjs`, `jose`, and `@vercel/kv` (or chosen Upstash client) and verify `npm run build` still succeeds with the new imports referenced
- [x] 1.3 Add `.env.example` listing every required variable (`SESSION_SECRET`, `ADMIN_PASSWORD`, `ROOM_CODE_HASH_A`–`ROOM_CODE_HASH_E`) with empty values and a short comment on how to generate each, and verify `.env*` is already git-ignored so no real secret could be committed

## 2. Code seeding and storage (tenant-auth foundation)

- [x] 2.1 Implement the seeded hash store: on first lookup of `room:<letter>`, if the key is absent in KV and the matching `ROOM_CODE_HASH_<letter>` env var exists, write the env value once; verify with a unit/integration test that first lookup seeds, second lookup reads from KV, and missing env vars yield "no code configured"
- [x] 2.2 Implement code verification `verifyRoomCode(room, submitted)` using `bcrypt.compare` against the stored hash, returning one boolean without logging the submitted value; verify with unit tests covering correct code, wrong code, unknown room (returns false)
- [x] 2.3 Add a small ops helper script (`scripts/hash-codes.mjs`) that bcrypt-hashes seed plaintext codes and prints env-ready `ROOM_CODE_HASH_*` lines; verify by running it locally with a sample code and confirming the printed hash verifies with `bcrypt.compare`

## 3. Tenant session and login

- [x] 3.1 Implement session sign/verify with `jose` (HS256, `SESSION_SECRET`), claim shape `{ role: "tenant", room: "a", exp }` plus the admin variant `{ role: "admin" }`, and cookie helpers (`tp_session`, httpOnly, Secure, SameSite=Lax); verify with unit tests that a valid token round-trips, a tampered one is rejected, and both tenant/admin claims serialize
- [x] 3.2 Build `/login` page (room select A–E + 10-char code field) and a Server Action that verifies the code, then sets the tenant cookie and redirects to `/rooms/<letter>`; verify manually: correct code logs in, wrong code shows "Invalid room or access code", unknown room or wrong-length code gets the same generic message
- [x] 3.3 Add rate limiting on the login and admin-login actions (per-IP and per-room counters in KV, exponential backoff); verify the limiter blocks rapid repeat submissions and clears after the backoff window

## 4. Tenant dashboard (room-dashboard + scope)

- [x] 4.1 Add middleware guarding `/rooms/*`: no valid tenant cookie → redirect to `/login`; admin cookie alone → redirect to `/login`; verify by curl-ing pages with no cookie, a valid tenant cookie for room A, and an admin-only cookie
- [x] 4.2 Build `/rooms/[room]` page rendering placeholder bills, payments, and lease dates from a typed per-room constants module containing no names/phones/emails; server component re-checks `session.room === params.room` and renders a not-authorized result on mismatch; verify: tenant A sees room A's placeholders, tenant A requesting `/rooms/d` is denied with no room D data in the response, and section labels clearly mark data as placeholder
- [x] 4.3 Verify no-PII guarantee end-to-end for tenant flow: grep the codebase and dev-server logs for any capture of names/phones/emails, confirm the login action and cookies contain only room letters, and confirm no analytics package is installed

## 5. Admin area and code reset (admin-reset)

- [x] 5.1 Build `/admin/login` page with a Server Action verifying `ADMIN_PASSWORD` and setting the `role: "admin"` cookie; verify: correct password enters `/admin`, wrong password shows a generic error, no admin cookie cannot reach `/admin`
- [x] 5.2 Build `/admin` reset form (room select + new 10-char code, or generate) whose Server Action bcrypt-hashes the new code, writes it to the KV hash store, and displays the plaintext code exactly once with a copy button and a "shown only once" warning; verify: reset room B, confirm the old code no longer logs in while the new one does, confirm the hash store was updated, and confirm plaintext never appears in logs or persisted files
- [x] 5.3 Guard reset actions to `role: \"admin\"` only and rate-limit admin login; verify a tenant cookie or anonymous request calling the reset action fails without changing the stored hash

## 6. Deploy and integration verification

- [ ] 6.1 Configure Vercel project with env vars (`SESSION_SECRET`, `ADMIN_PASSWORD`, seeded `ROOM_CODE_HASH_*`), provision the KV store, deploy, and verify the deployed app seeds from env on first login
- [ ] 6.2 Run the spec scenarios end-to-end on the deployed URL per each spec delta (`tenant-auth`, `room-dashboard`, `admin-reset`) and record pass/fail in the change notes
