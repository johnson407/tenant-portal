# Tasks

## 1. Shared room-password policy and tenant login

- [x] 1.1 Replace `CODE_LENGTH` / `isValidCode` in `lib/rooms.ts` with `ROOM_PASSWORD_MIN_LENGTH = 4`, `ROOM_PASSWORD_MAX_LENGTH = 64`, `ROOM_PASSWORD_PATTERN`, and `isValidRoomPassword`, then switch `lib/verify-room-code.ts` to the new validator; verify `npx tsc --noEmit` reports no errors and no other module imports the removed names
- [x] 1.2 Update `tests/verify-room-code.test.ts` to cover acceptance of 4-, 10- (legacy), and 64-character passwords and rejection of 3-character, 65-character, and non-alphanumeric input, keeping the "no plaintext logged" assertion; verify with `npx vitest run tests/verify-room-code.test.ts`
- [x] 1.3 Change the login input in `app/[lang]/login/login-form.tsx` to `minLength={4}` / `maxLength={64}` and update the `login.codePlaceholder` copy in both dictionaries; update the affected assertions in `tests/form-labels.test.ts` and verify with `npx vitest run tests/form-labels.test.ts tests/login-page.test.ts`

## 2. Admin password reset

- [x] 2.1 Update `resetRoomCodeAction` in `app/[lang]/admin/actions.ts` so an empty value generates a random 10-character alphanumeric password, a valid 4–64 character alphanumeric value is used verbatim, and an invalid non-blank value returns `invalid-password` without hashing, writing, or bumping the session version; add `"invalid-password"` to `AdminResetError` and verify `npx tsc --noEmit` passes
- [x] 2.2 Add `admin.errors.invalidPassword` to `lib/i18n/dictionaries/en.ts` and `lib/i18n/dictionaries/zh-TW.ts` and map the new state in `app/[lang]/admin/reset-form.tsx`; update `admin.newCodeLabel` / `admin.codePlaceholder` to the 4–64 character wording and verify with `npx vitest run tests/form-labels.test.ts`
- [x] 2.3 Change the admin reset input in `app/[lang]/admin/reset-form.tsx` to allow up to 64 characters while leaving blank input allowed, and confirm the rendered form no longer enforces a 10-character length; verify with `npx vitest run tests/admin-page.test.ts tests/form-labels.test.ts`
- [x] 2.4 Extend `tests/admin-reset-action.test.ts` to cover 4- and 64-character acceptance, rejection of 3-character/65-character/non-alphanumeric input with `invalid-password` and no writes, and blank input generating a 10-character alphanumeric password whose hash is stored; verify with `npx vitest run tests/admin-reset-action.test.ts`

## 3. Seed helper and documentation

- [x] 3.1 Update `scripts/hash-codes.mjs` to accept 4–64 character alphanumeric passwords instead of exactly 10, keeping the bcrypt self-verification step; verify by running `node scripts/hash-codes.mjs --code-into=a abcd` and `node scripts/hash-codes.mjs --code-into=b 'A1b2C3d4E5F6G7h8I9J0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b8C9d0E1f2'` and confirming each prints a hash and exits 0
- [x] 3.2 Update `.env.example` and `AGENTS.md` to describe room passwords as 4–64 alphanumeric characters instead of 10-character codes; verify `grep -rn "10-character\|10 字元" AGENTS.md .env.example lib app scripts` returns no matches

## 4. Integration verification

- [x] 4.1 Run the full unit suite with `npm test` and typecheck with `npx tsc --noEmit`; both must pass
- [x] 4.2 Run `npm run build` and confirm the production build succeeds
- [x] 4.3 With `npm run dev:kv` running, verify in the browser that the admin can set a 4-character password and a 64-character password, a tenant logs in with each, an existing 10-character code still works, and a reset revokes the room's existing tenant session; verified locally: admin set a 4-character and a 64-character password, tenants logged in with both plus the legacy 10-character code, and resetting a room revoked its existing session
- [x] 4.4 Add admin-reset regression tests proving a rate-limit denial returns the generic error without hashing or writing, and a non-admin caller with an invalid room still consumes an attempt; verify with `npx vitest run tests/admin-reset-action.test.ts`

## Workflow follow-up

- Archive the change after review and verification are complete.
