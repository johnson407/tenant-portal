# Design

## Context

See `proposal.md` for motivation and the delta specs for required behavior.

Current state:

- `lib/rooms.ts` exports `CODE_LENGTH = 10` and `isValidCode`, which requires exactly 10 characters.
- `lib/verify-room-code.ts` rejects any submitted value that is not exactly 10 characters with `invalid_input`.
- `app/[lang]/admin/actions.ts` accepts a chosen value only when it matches `/^[A-Za-z0-9]{10}$/`; otherwise it silently generates a random 10-character code.
- The login and reset inputs hard-code `minLength={10}` / `maxLength={10}`, and the dictionaries and tests assert "10-character" copy.
- Passwords are stored only as bcrypt hashes in Redis (`room:<letter>`), seeded once from `ROOM_CODE_HASH_<LETTER>`, and a reset bumps `room:<letter>:session-version`.
- `scripts/hash-codes.mjs` refuses plaintext shorter or longer than 10 characters.

Constraints: no plaintext or PII may be stored or logged; bcrypt-only storage, rate limiting, session cookies, and session-version revocation must not change; UI copy comes from the locale dictionaries.

## Goals / Non-Goals

**Goals:**

- One shared password policy used by tenant login, admin reset, and the seed-hash helper.
- Existing 10-character alphanumeric codes keep working with no data migration.
- Admin-entered passwords are used verbatim; only blank input triggers generation.
- Clear, locale-aware feedback when an admin-entered password is out of policy.

**Non-Goals:**

- No password strength meter, breached-password check, or entropy requirement.
- No support for symbols, spaces, Unicode, or passphrases; the character set stays alphanumeric.
- No change to bcrypt cost, Redis schema, session format, rate limits, or PII rules.
- No migration of stored hashes or re-seeding of rooms.

## Decisions

### 1. Shared policy constants in `lib/rooms.ts`

Replace `CODE_LENGTH` / `isValidCode` with:

- `ROOM_PASSWORD_MIN_LENGTH = 4`
- `ROOM_PASSWORD_MAX_LENGTH = 64`
- `ROOM_PASSWORD_PATTERN = /^[A-Za-z0-9]{4,64}$/`
- `isValidRoomPassword(value: unknown): value is string`

Both `verifyRoomCode` and the admin reset action import this validator, so login and reset cannot drift. Alternative considered: separate validators per caller — rejected because the two rules must stay identical.

64 characters is below bcrypt's 72-byte input limit for ASCII, so no silent truncation collisions are possible.

### 2. Login rejects out-of-policy input early with the existing generic error

`verifyRoomCode` uses `isValidRoomPassword` instead of the 10-character check. Any value outside the policy returns `invalid_input`, which the action already maps to the generic invalid-credentials message. Passwords created under the new policy always satisfy it, and legacy 10-character alphanumeric codes do too. A legacy code containing non-alphanumeric characters would not, which is why the migration plan requires checking the five current codes before deploy. Alternative considered: skip client-side/policy validation and always run `bcrypt.compare` — rejected because it wastes bcrypt work on obviously invalid input and keeps the existing uniform error behavior.

### 3. Admin reset: blank generates, invalid non-blank rejects

In `resetRoomCodeAction`:

- `""` (exactly empty) → generate a random 10-character code from the existing unambiguous alphabet.
- Non-blank and `isValidRoomPassword` → hash and store the value verbatim.
- Non-blank and invalid → return `{ status: "error", message: "invalid-password" }` without hashing, writing, or bumping the session version.

This replaces the current "invalid input falls back to generation" behavior, which would silently discard a mistyped password and show the admin a password they did not choose. Add `"invalid-password"` to `AdminResetError` and a locale-specific message to both dictionaries. Whitespace is not trimmed; a value containing spaces is non-alphanumeric and is rejected rather than silently altered.

### 4. Keep generation at 10 characters

Generated passwords stay 10 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, which satisfies the policy and preserves the current shape for admins who do not care to choose. Alternative considered: generate at maximum length — rejected as harder to read aloud without a security benefit given rate limiting.

### 5. Forms and copy

- Login input: `minLength={4}`, `maxLength={64}`; keep the existing styling.
- Admin reset input: `maxLength={64}` and no fixed `minLength` (blank must stay allowed).
- Dictionaries: replace "10-character" wording in `login.codePlaceholder`, `admin.newCodeLabel`, and `admin.codePlaceholder`; add `admin.errors.invalidPassword`. UI terminology stays "access code" for continuity with the rest of the app.
- `AGENTS.md`, `.env.example`, and `scripts/hash-codes.mjs` copy updated to describe 4–64 alphanumeric characters.

### 6. Tests

- `tests/verify-room-code.test.ts`: accept 4- and 64-character passwords, keep accepting 10-character legacy codes, reject 3 and 65 characters, reject non-alphanumeric input, and keep the "no plaintext logged" assertion.
- `tests/admin-reset-action.test.ts`: accept 4- and 64-character passwords, reject 3/65/symbol input with `invalid-password` and no writes, and verify blank input generates a 10-character alphanumeric password whose hash is stored.
- `tests/form-labels.test.ts`: update the assertions that currently expect "10 字元代碼" / "新的 10 字元代碼".

## Risks / Trade-offs

- **Weak 4-character passwords** → rate limiting with escalating lockouts remains the compensating control; the landlord chooses the password and can use longer values. The minimum is a product decision, not a cryptographic one.
- **Legacy non-alphanumeric code** → the previous validator enforced only length, so a 10-character code containing a symbol would be rejected after deploy. Mitigation: confirm all five current codes are alphanumeric before deploy and reset any that are not.
- **Rollback incompatibility** → after deploying, passwords outside 10 characters cannot be verified by the previous release. Mitigation: rollback requires resetting affected rooms to 10-character codes through the admin area; document this in the change summary.
- **Admin typo now blocks the reset** instead of generating a code → intentional; the admin sees an explicit invalid-input message and can retry.
- **Script/docs drift** → the helper, `.env.example`, and `AGENTS.md` are updated in the same change; the helper keeps its self-verification step.

## Migration Plan

1. Before deploying, confirm all five current room codes are 10 alphanumeric characters. The previous validator enforced length only, so a code containing a symbol would stop working; reset any such room to an alphanumeric password first.
2. Deploy the code change; no Redis or environment migration is needed.
3. Existing bcrypt hashes and 10-character alphanumeric codes remain valid.
4. Verify login for all five legacy codes, plus a newly set 4-character and 64-character password.
5. Rollback: redeploy the previous release and reset any room whose password is not exactly 10 characters.
