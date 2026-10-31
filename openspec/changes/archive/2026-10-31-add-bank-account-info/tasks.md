# Tasks

## 1. Localized copy and types

- [x] 1.1 Add `room.bankAccount` (heading, bankName, recipientName, bankCode, accountNo) and `admin.bank` (sectionHeading, bankName, recipientName, bankCode, accountNo labels, placeholders, save, saving, saved, unavailable, errors.invalid, errors.generic) to `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, and `lib/i18n/dictionaries/zh-TW.ts`; verify with `npx vitest run tests/i18n-dictionaries.test.ts` (matching key structure, English free of Chinese) and `npx tsc --noEmit`.

## 2. Bank account server module

- [x] 2.1 Create `lib/bank-account.ts` with the `BankAccount` type and pure `parseBankAccount(input)` that trims all four fields and enforces bank/recipient name 1-80 non-control characters, bank code `/^\d{3,7}$/`, and account number `/^\d{6,20}$/`, returning a field-specific failure; verify with a new `tests/bank-account.test.ts` covering blank fields, whitespace trimming, control characters, short/long names, letter and hyphen bank codes, and spaced account numbers.
- [x] 2.2 Add `getBankAccount()` and `saveBankAccount(record)` using `@upstash/redis` `hgetall`/`hset` on the fixed key `bank:account`, revalidate values read from Redis through `parseBankAccount`, treat a missing or corrupt record as `null`, and throw only after logging a fixed reason when KV is unconfigured or a call fails; verify with `tests/bank-account.test.ts` (mocked Redis class as in `tests/code-store.test.ts`) covering round-trip, missing record, corrupted fields, missing env, and read/write errors.

## 3. Admin save action

- [x] 3.1 Add `app/[lang]/admin/bank-state.ts` exporting the `idle | error | success` state union, locale-independent codes (`saved`, `invalid`, `generic`), and `GENERIC_BANK_ERROR`; verify `npx tsc --noEmit`.
- [x] 3.2 Add `app/[lang]/admin/bank-actions.ts` with `saveBankAccountAction(localeInput, _prev, formData)` that rejects any non-admin session before reading input or KV, validates via `parseBankAccount`, saves, and returns localized-code states without leaking values; verify with a new `tests/admin-bank-action.test.ts` covering admin success, tenant and anonymous denial with no KV write, each invalid field, and a KV write failure.

## 4. Admin page and form

- [x] 4.1 Build `app/[lang]/admin/bank-form.tsx` as a client component: controlled inputs seeded from server-provided values, `useActionState`, disabled save while pending, localized labels/placeholders, and error-code mapping; verify `tests/form-labels.test.ts` renders both locales, checks prefill values, and asserts the invalid and generic messages map per locale.
- [x] 4.2 Wire `app/[lang]/admin/page.tsx` to read the record inside a try/catch, render the bank form with prefilled values on success, render the localized unavailable notice instead of the form when the read throws, and give the reset form its own section heading while broadening the page `<h1>`; verify updated `tests/admin-page.test.ts` (mock `getBankAccount` and the bank form) covers prefill, no-record empty form, read failure notice, and both-locale headings.

## 5. Tenant dashboard display

- [x] 5.1 Render a bank account section in `app/[lang]/rooms/[room]/page.tsx` from a separately guarded `getBankAccount()` call, placed outside the `feed === null` branch, showing the four values as plain text under the localized heading; verify `tests/room-page.test.ts` (mock `getBankAccount`) shows the section with the feed, still shows it when the feed is unavailable, and omits it entirely when the record is missing or the read throws.
- [x] 5.2 Confirm the section never renders on the unauthorized/denied path or in page metadata; verify `tests/room-page.test.ts` asserts no bank values in the denied HTML and that `generateMetadata` does not include them.

## 6. Integration checks

- [x] 6.1 Run `npm test` and confirm the whole Vitest suite passes, including the updated dictionary, form, admin page, and room page tests.
- [x] 6.2 Run `npx tsc --noEmit` and `npm run build` and confirm both succeed.
- [x] 6.3 With `npm run dev:kv` and a configured admin password, sign in to `/zh-TW/admin`, save a bank account, and confirm `/zh-TW/rooms/a` and `/en/rooms/a` show the same values without a restart; then confirm an invalid bank code is rejected and the stored values remain.

## Workflow follow-up

- Run `openspec validate add-bank-account-info --strict` and fix any reported warnings before archiving.
- Archive the change after the work is reviewed and merged.
