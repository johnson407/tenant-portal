# Tasks

## 1. Repair schema and validation

- [x] 1.1 Add the repair types to `lib/appfeed/types.ts`: category, status, room request, pending request, snapshot result, and room/admin result unions. Include a failure reason for an absent tab. Verify with `npx tsc --noEmit`.
- [x] 1.2 Add the exact `Repairs` header, range, category list, request ID pattern, note limit, and `parseRepairRow` to `lib/appfeed/validate.ts`. Add tests for every invalid row case and every note rule. Verify with `npx vitest run tests/appfeed-repairs-validate.test.ts`.
- [x] 1.3 Add `validateRepairs`, `buildRoomRepairs`, and `buildPendingRepairs`. Apply pending-first order, the 20-request cap, admin oldest-first order, and cross-room exclusion. Add tests for each rule. Verify with `npx vitest run tests/appfeed-repairs-validate.test.ts`.
- [x] 1.4 Add tests for the fail-closed rules: one invalid row blocks only that room's repairs, an invalid room cell is dropped, empty rows are ignored, and a duplicate request ID invalidates both rows. Verify with `npx vitest run tests/appfeed-repairs-validate.test.ts`.

## 2. Google Sheets access and AppFeed docs

- [x] 2.1 Update the metadata guard and value reader in `lib/appfeed/google.ts` to accept exactly `Bills` and `Leases`, or exactly `Bills`, `Leases`, and `Repairs`. Reject any other or duplicate tab. Add `fetchRepairsSnapshot` for `Repairs!A:G`. Verify with `npx vitest run tests/appfeed-repairs-google.test.ts`.
- [x] 2.2 Add `appendRepairRow` with `values:append`, `RAW`, and `INSERT_ROWS` on `Repairs!A:G`. Add `writeRepairDone` with a two-cell PUT on `Repairs!F{row}:G{row}`. Verify the exact request bodies and ranges in `tests/appfeed-repairs-google.test.ts`.
- [x] 2.3 Add the failure tests for a missing tab, wrong tab set, wrong header, append failure, status write failure, and safe log fields. Verify with `npx vitest run tests/appfeed-repairs-google.test.ts`.
- [x] 2.4 Update `docs/appfeed-rules.md` with the `Repairs` header, categories, note rules, fixed range, append and status writes, deploy order, and rollback order. Update the AppFeed paragraph in `AGENTS.md`. Verify the documented commands and ranges against the code, and run `git diff --check`.

## 3. Repair rate limits

- [x] 3.1 Add `REPAIR_SUBMIT_RATE_BUCKET` at 10 attempts per 15 minutes with `ip:` and `room:` keys, and `REPAIR_DONE_RATE_BUCKET` at 60 attempts per 15 minutes with an `ip:` key to `lib/rate-limit.ts`. Add tests for the limits, key isolation, and fail-closed behavior. Verify with `npx vitest run tests/rate-limit.test.ts`.

## 4. Repair accessors and writes

- [x] 4.1 Add `getRoomRepairs(room)` to `lib/appfeed/repairs.ts` with `use cache`, the standard `cacheLife`, and tag `appfeed:repairs:room:<letter>`. Return only that room's projection and an unavailable result for a missing or invalid tab. Verify with `npx vitest run tests/appfeed-repairs-feed.test.ts`.
- [x] 4.2 Add `listPendingRepairs()` with an `isAdminSession()` check and a fresh read. Return only pending requests with room, request ID, category, note, and submitted date. Verify with `npx vitest run tests/appfeed-repairs-feed.test.ts`.
- [x] 4.3 Add `submitRepair(room, input)` with room and note validation, the submit rate limit, one append, and `revalidateTag` for the room. Verify success, invalid input, rate limit, append failure, and tag invalidation in `tests/appfeed-repairs-feed.test.ts`.
- [x] 4.4 Add `completeRepair(requestId)` with the admin check, the completion rate limit, a fresh read, a pending-only check, one two-cell write, and `revalidateTag` for the row's room. Verify success, already done, unknown ID, fresh read failure, write failure, and tag invalidation in `tests/appfeed-repairs-feed.test.ts`.
- [x] 4.5 Add tests that a repair submit and completion invalidate only the affected room's repair tag and never the feed tag or another room's tag. Verify with `npx vitest run tests/appfeed-repairs-feed.test.ts`.

## 5. Localized repair copy

- [x] 5.1 Extend `Dictionary` in `lib/i18n/types.ts` with `room.repairs` and `admin.repairs`. Include titles, captions, empty and unavailable text, form labels, the warning, categories, statuses, date labels, actions, pending text, and every error code. Verify with `npx tsc --noEmit`.
- [x] 5.2 Add the English and Traditional Chinese values to `lib/i18n/dictionaries/en.ts` and `lib/i18n/dictionaries/zh-TW.ts`. Add a test that both dictionaries have every repair key and no empty string. Verify with `npx vitest run tests/i18n-repairs.test.ts`.

## 6. Tenant repair action and form

- [x] 6.1 Add `app/[lang]/rooms/[room]/repair-state.ts` and `repair-actions.ts`. Validate the locale, room, tenant session, and session version before reading the form. Return locale-independent codes for category, note, unavailable, rate, and generic failures. Verify with `npx vitest run tests/repair-actions.test.ts`.
- [x] 6.2 Add `app/[lang]/rooms/[room]/repair-form.tsx` with a category select, a note input with `maxLength=200`, the localized warning, a submit control, and `useActionState`. Use a plain form action so it works without JavaScript. Add form rendering and error-mapping tests to `tests/repair-forms.test.ts`. Verify with `npx vitest run tests/repair-forms.test.ts`.
- [x] 6.3 Add action tests for anonymous access, another room, a stale session version, an invalid category, an invalid note, a missing tab, a rate limit, and an append failure. Verify each case appends no row. Verify with `npx vitest run tests/repair-actions.test.ts`.

## 7. Admin repair action and form

- [x] 7.1 Add `app/[lang]/admin/repair-state.ts` and `repair-actions.ts`. Require an admin session, consume the completion rate limit, validate the request ID, and call `completeRepair`. Return locale-independent codes for already done, not found, unavailable, rate, and generic failures. Verify with `npx vitest run tests/repair-actions.test.ts`.
- [x] 7.2 Add `app/[lang]/admin/repair-done-form.tsx` with a hidden request ID, a mark-done button, pending state, and localized errors. Use a plain form action so it works without JavaScript. Add rendering and error-mapping tests to `tests/repair-forms.test.ts`. Verify with `npx vitest run tests/repair-forms.test.ts`.
- [x] 7.3 Add action tests for anonymous access, tenant access, an already done request, an unknown ID, a missing tab, a rate limit, a fresh read failure, and a write failure. Verify the row keeps `pending` on every failure. Verify with `npx vitest run tests/repair-actions.test.ts`.

## 8. Tenant dashboard repair section

- [x] 8.1 Add a full-width repair `SectionCard` below the bills and side grid in `app/[lang]/rooms/[room]/page.tsx`. Call `getRoomRepairs` independently from `getRoomFeed`. Render the form and history with category, note, submitted date, status, and done date. Verify with new cases in `tests/room-page.test.ts`.
- [x] 8.2 Add page cases for the empty history, unavailable repairs, and pending-first order. Verify that a repair failure keeps bills, payments, and lease visible, and a feed failure keeps repairs visible. Verify with `npx vitest run tests/room-page.test.ts`.
- [x] 8.3 Add page cases for Traditional Chinese and English repair labels, statuses, and errors. Verify with `npx vitest run tests/room-page.test.ts`.

## 9. Admin console repair card

- [x] 9.1 Add a full-width repairs `SectionCard` below the claims card in `app/[lang]/admin/page.tsx`. Call `listPendingRepairs` independently from the claims list. Render room, category, note, submitted date, and one `RepairDoneForm` per row. Verify with new cases in `tests/admin-page.test.ts`.
- [x] 9.2 Add admin page cases for the empty queue, unavailable repairs, and a claims failure that leaves repairs usable. Add both locale cases. Verify with `npx vitest run tests/admin-page.test.ts`.

## 10. Integration and release checks

- [x] 10.1 Add boundary tests that a repair note never appears in logs or page metadata, no route or action returns a full Repairs snapshot, fixtures contain no personal data, and no code references the main rent file. Verify with `npx vitest run tests/appfeed-repairs-boundary.test.ts`.
- [x] 10.2 Run the manual no-JavaScript check on a test AppFeed: submit a repair as a tenant, confirm the row and history, then mark it done as the admin and confirm the queue and history. Record the result in the change notes.
- [x] 10.3 Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Verify all three pass.
- [x] 10.4 Verify the deploy and rollback order in `docs/appfeed-rules.md` matches the design: share `AppFeed` as Editor before the first read, deploy the app first, add the tab second, wait up to 15 minutes for the room repair cache or redeploy, remove the tab first on rollback, and never deploy the old app while the tab exists. Run `git diff --check`.
- [x] 10.5 Run `openspec validate add-repair-requests --strict`. Verify there are no errors or warnings.
- [x] 10.6 Verify the change adds no runtime dependency, route, or environment variable. Confirm `git diff -- package.json package-lock.json .env.example` is empty.

## Workflow follow-up

- Run the project review and archive the change after every task is verified.
- Run `openspec validate add-repair-requests --strict` again before archive.
- Verify the archived delta created the new `repair-requests` spec and updated the four existing specs.

## Verification notes

- 2026-11-01: The manual no-JavaScript check passed on the confirmed test AppFeed. The test sheet was prepared with the `Repairs` tab and the `Bills!H:I` claim headers. Tenant room A submitted the synthetic request `No-JS verification request qyre`; the room history showed `Pending`. The admin queue showed the request; marking it done removed it from the queue. The room history then showed `Done`.
- Evidence: `/tmp/opencode/repair-nojs-tenant-pending.png`, `/tmp/opencode/repair-nojs-admin-done.png`, `/tmp/opencode/repair-nojs-tenant-done.png`.
