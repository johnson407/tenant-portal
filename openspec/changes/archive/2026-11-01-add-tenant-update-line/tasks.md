# Tasks

## 1. AppFeed schema and validation

- [x] 1.1 Extend `BILLS_HEADER` to 17 columns and `REPAIRS_HEADER` to 8 columns in `lib/appfeed/validate.ts`. Change `BILLS_RANGE` to `Bills!A:Q` and `REPAIRS_RANGE` to `Repairs!A:H` in `lib/appfeed/google.ts`. Verify the header tests in `tests/appfeed-validate.test.ts` and `tests/appfeed-google.test.ts` pass, and `npx tsc --noEmit` reports no error.
- [x] 1.2 Add `confirmedOn` and `confirmNote` to `BillRow`, and `doneNote` to `RepairRow`. Extend `parseBillRow` and `parseRepairRow` with the date, note, and cross-field rules from `specs/appfeed-data-source/spec.md`. Verify new valid and invalid cases in `tests/appfeed-validate.test.ts` and `tests/appfeed-repairs-validate.test.ts` pass.
- [x] 1.3 Extract the shared note checks into one pure validator. Keep `isValidRepairNote` behavior unchanged. Add optional note validation for completion and confirmation notes. Verify `tests/appfeed-validate.test.ts`, `tests/appfeed-repairs-validate.test.ts`, and `tests/appfeed-boundary.test.ts` pass.
- [x] 1.4 Update `docs/appfeed-rules.md` with the 17-column Bills header, the 8-column Repairs header, the new read ranges, and the note rules. Verify the document lists the exact headers and ranges from the spec.

## 2. Latest event projections and helper

- [x] 2.1 Add `lastConfirmation` to the tenant `RoomFeed` projection. Compute it from all room bills that have both `paid_on` and `confirmed_on`, before the 12-payment cap. Verify a new case in `tests/appfeed-feed.test.ts` where the latest confirmation is outside the payment cap.
- [x] 2.2 Add `lastDone` to the successful `RoomRepairsResult`. Compute it from all room done repairs, before the 20-item history cap. Verify a new case in `tests/appfeed-repairs-feed.test.ts` where the latest done repair is outside the history cap.
- [x] 2.3 Add a pure `selectLatestUpdate` helper in `lib/appfeed/updates.ts`. It returns the latest event kind, date, and optional note. It applies the claim tie-break and the one-source-unavailable rules. Verify a new `tests/tenant-updates.test.ts` covers repair-only, claim-only, both, tie, no event, one source unavailable, and both unavailable.
- [x] 2.4 Confirm the line adds no sheet read and no cache entry. Verify the room page calls only `getRoomFeed` and `getRoomRepairs`, and `npm test` passes.

## 3. Repair completion note

- [x] 3.1 Change `completeRepair` to accept an optional note, validate it, and write `Repairs!F:H` with `["done", doneOn, doneNote]`. Keep the fresh read, lock, rate limit, and verification. Verify new cases in `tests/repair-actions.test.ts` for a note, a blank note, and an invalid note.
- [x] 3.2 Read the `note` field in `markRepairDoneAction` and return a locale-independent `invalid-note` error. Map the error in the admin repair form. Verify `tests/repair-actions.test.ts` and `tests/repair-forms.test.ts` pass.
- [x] 3.3 Add the optional note input to `RepairDoneForm`. Add the label, placeholder, pending, and error copy to both dictionaries and the `Dictionary` type. Verify `tests/repair-forms.test.ts`, `tests/i18n-repairs.test.ts`, and `npx tsc --noEmit` pass.
- [x] 3.4 Update `docs/appfeed-rules.md` with the `Repairs!F:H` completion write and the `done_note` rule. Verify the document matches the spec.
- [x] 3.5 Confirm a completed repair invalidates the room repair cache and appears on the latest-update line on the next tenant render. Verify the cache test in `tests/appfeed-repairs-feed.test.ts` and the room page test in `tests/room-page.test.ts`.

## 4. Admin claim confirmation

- [x] 4.1 Add `lib/appfeed/claim-lock.ts` with a 30-second `SET NX EX` lock keyed by `claim:confirm:<room>:<period>`. It returns a release function, returns null when held, and throws when Redis is absent. Verify a new `tests/claim-lock.test.ts` covers acquire, hold, release, and missing Redis.
- [x] 4.2 Add `confirmClaim` to `lib/appfeed/claims.ts`. It validates the admin session, room, period, paid date, and note; enforces the rate limit and lock; reads fresh; writes `Bills!P:Q` then `Bills!G`; verifies the row; and invalidates `appfeed:room:<room>` with `{ expire: 0 }`. Verify new cases in `tests/claims.test.ts` for success, safe write order, second-write failure, invalid date, invalid note, paid bill, and missing claim.
- [x] 4.3 Add a `claim-confirm` rate-limit bucket with a conservative window and fail-closed behavior. Verify `tests/rate-limit.test.ts` and the new `tests/claims.test.ts` rate case.
- [x] 4.4 Add `app/[lang]/admin/claim-actions.ts` and `claim-state.ts`. The action checks the admin session, reads `room`, `period`, `paidOn`, and `note`, and maps every result to a locale-independent code. Verify a new `tests/claim-actions.test.ts` covers success, denial, invalid input, and generic failure.
- [x] 4.5 Add `app/[lang]/admin/claim-confirm-form.tsx` with a paid-date field prefilled from the claimed date, an optional note field, a pending label, and an error slot. Render it for each pending claim in `app/[lang]/admin/page.tsx`. Verify `tests/admin-page.test.ts` and a new `tests/claim-forms.test.ts` cover the fields and the no-JavaScript form.
- [x] 4.6 Add the claim confirmation labels, placeholders, button states, and error copy to both dictionaries and the `Dictionary` type. Verify `tests/i18n-dictionaries.test.ts` and `npx tsc --noEmit` pass.
- [x] 4.7 Update `docs/appfeed-rules.md` with the `Bills!P:Q` and `Bills!G` write order, the `confirmed_on` and `confirm_note` rules, and the sheet-first deploy and rollback steps. Verify the document matches the spec.

## 5. Tenant latest-update line

- [x] 5.1 Add the latest-update label, repair-completed label, payment-confirmed label, and note label to both dictionaries and the `Dictionary` type. Verify `tests/i18n-dictionaries.test.ts` and `tests/i18n-format.test.ts` pass.
- [x] 5.2 Render the line in the room header with `selectLatestUpdate` and `formatDate`. Keep the existing data-freshness timestamp and its label separate. Verify `tests/room-page.test.ts` covers repair, claim, both, tie, no event, one source unavailable, and both unavailable.
- [x] 5.3 Add the header status layout. Use text plus a border or icon, not colour alone. Keep the line before the bills and payment sections in DOM order. Verify `tests/room-page.test.ts` for DOM order and text labels, and a manual 390-pixel render.
- [x] 5.4 Confirm the line shows no other room's event, date, or note. Verify `tests/appfeed-boundary.test.ts`, `tests/room-page.test.ts`, and `tests/portal-shell.test.ts`.
- [x] 5.5 Update `docs/appfeed-rules.md` with the admin rule: confirm a claim in the console to update the tenant line. A manual `paid_on` edit does not update the line. Verify the document says this.

## 6. Integration verification

- [x] 6.1 Run `npm test` and confirm every test passes.
- [x] 6.2 Run `npx tsc --noEmit` and confirm no type error.
- [x] 6.3 Run `npm run build` and confirm the production build succeeds.
- [x] 6.4 In a test `AppFeed` sheet, add the three new headers before deploying the new app. Verify the old app still renders, then deploy the new app. Confirm one claim and complete one repair. Verify the line in `zh-TW` and `en`, at 390px, and with client-side JavaScript disabled.
- [x] 6.5 Run `openspec validate add-tenant-update-line --strict` and confirm it passes.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived specs and the updated `docs/appfeed-rules.md`.
