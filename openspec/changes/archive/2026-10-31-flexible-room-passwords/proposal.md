# Proposal

## Why

The landlord can only issue 10-character alphanumeric room codes, which forces an awkward, hard-to-remember format and prevents choosing a length that fits the tenant. Lifting the fixed length while keeping bcrypt-only storage lets the landlord set practical passwords without changing the existing authentication or session model.

## What Changes

- Replace the fixed 10-character rule with a shared room-password policy: 4–64 alphanumeric characters (`A–Z`, `a–z`, `0–9`).
- Tenant login accepts any password matching that policy and continues to reject anything else with the existing generic invalid-credentials error.
- Admin reset accepts a 4–64 character alphanumeric password. A blank field still generates a random 10-character alphanumeric code. The plaintext is shown once and only the bcrypt hash is stored.
- Update the login and reset form fields, labels, and placeholders so they no longer say "10-character".
- Update the seed-hash helper (`scripts/hash-codes.mjs`), `.env.example`, and `AGENTS.md` copy to describe the new policy.
- Not breaking for existing 10-character alphanumeric codes: 10 is inside the 4–64 range. The previous rule enforced length only, so the migration plan requires confirming that no current code contains non-alphanumeric characters.
- Unchanged: bcrypt-only storage, Redis-backed hashes, session cookies, session-version revocation on reset, rate limiting, and the no-PII rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tenant-auth`: the sign-in input rule changes from exactly 10 characters to the 4–64 character alphanumeric policy.
- `admin-reset`: the reset input rule changes from a 10-character code to the 4–64 character alphanumeric policy, while blank input still auto-generates a code.

## Impact

- `lib/rooms.ts`: replace `CODE_LENGTH` / `isValidCode` with policy constants and a validator.
- `lib/verify-room-code.ts`: validate tenant input against the new policy.
- `app/[lang]/login/login-form.tsx` and `app/[lang]/admin/reset-form.tsx`: remove fixed `minLength`/`maxLength` of 10 and apply the new bounds.
- `app/[lang]/admin/actions.ts`: validate the admin-entered password with the shared policy instead of the 10-character regex; keep blank-input generation.
- `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/zh-TW.ts`: update labels and placeholders.
- `scripts/hash-codes.mjs`, `.env.example`, `AGENTS.md`: update seed instructions and documentation.
- Tests: `tests/verify-room-code.test.ts`, `tests/admin-reset-action.test.ts`, and any form/page assertions that encode the 10-character rule.
- No new dependencies, environment variables, or external services.
