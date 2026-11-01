# Tasks

## 1. Domain types and window rule

- [x] 1.1 Add `LeaseRenewal` (`{ room, end }`) and `AdminLeaseRenewalsResult` (`ok` with `renewals`, `denied`, `unavailable`) to `lib/appfeed/types.ts`; verify with `npx tsc --noEmit`.
- [x] 1.2 Add `isRenewalReminderDue(leaseEnd, today)` to `lib/appfeed/dates.ts`, using UTC day numbers built with `setUTCFullYear` so years below 100 are not remapped; verify the 60-day, 61-day, end-date, day-after, month-boundary, leap-day, and year-below-100 cases in `tests/appfeed-renewal.test.ts`.
- [x] 1.3 Add `buildLeaseRenewals(snapshot, today)` to `lib/appfeed/validate.ts`; it must reuse `validateSnapshot`, return `null` on a bad snapshot, return `null` only when a room has `counts.leases > 0`, ignore a room with only invalid `Bills` rows, ignore unattributable rows, filter the window, sort by `end` then `room`, and project only `room` and `end`; verify with `npx vitest run tests/appfeed-renewal.test.ts`.
- [x] 1.4 Add builder tests for a set `renewal_due`, an empty or missing lease row, an invalid lease row, and a valid lease with a separate invalid bill row; confirm the last case still returns the reminder; run `npx vitest run tests/appfeed-renewal.test.ts`.

## 2. Admin reminder accessor

- [x] 2.1 Add `lib/appfeed/renewal.ts` with `import "server-only"` and `listLeaseRenewals()`: check `isAdminSession()` before any read, call `fetchAppFeedSnapshot()` once, call `buildLeaseRenewals(snapshot, todayInTaipei())`, and return only the narrow result; import the types from `lib/appfeed/types.ts`; verify with `npx tsc --noEmit`.
- [x] 2.2 Add accessor tests for a denied tenant or anonymous caller, an unavailable snapshot, a successful sorted list, an invalid lease row, a valid lease with a separate invalid bill row, and logs that carry only a reason code and no lease date; mock `@/lib/appfeed/dates` with a fixed `todayInTaipei()` date; run `npx vitest run tests/appfeed-renewal.test.ts`.
- [x] 2.3 Confirm the accessor calls `fetchAppFeedSnapshot()` once, imports no write function, and adds no range; add the fixed-range assertion to `tests/appfeed-google.test.ts` and the client-boundary assertion for `@/lib/appfeed/renewal` to `tests/appfeed-boundary.test.ts`; run both files.

## 3. Localized banner component

- [x] 3.1 Add the top-level `renewal` dictionary block (`tenantHeading`, `tenantMessageTemplate`, `adminHeading`, `adminCaption`, `unavailable`) to `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, and `lib/i18n/dictionaries/zh-TW.ts`; verify with `npx vitest run tests/i18n-dictionaries.test.ts`, and add an assertion that every `tenantMessageTemplate` contains `{date}` and no other brace placeholder.
- [x] 3.2 Add `app/[lang]/renewal-banner.tsx` as a server component with `tenant` and `admin` variants, a `dictionary: Dictionary` prop, a labeled `<section>`, localized text, `formatDate()`, the amber panel classes, `flex flex-wrap`, `min-w-0 break-words`, no `whitespace-nowrap`, and no client state; verify with `npx tsc --noEmit`.
- [x] 3.3 Add a render test for the banner with both variants: no dismiss control, no form or button, no storage call, the localized heading and message, and the admin room and lease-end labels; run the focused test.

## 4. Tenant dashboard reminder

- [x] 4.1 In `app/[lang]/rooms/[room]/page.tsx`, compute the tenant reminder from `feed.lease.end` and `todayInTaipei()`, and render the banner after the room title row and before the latest-update line and lease facts; verify with `npx tsc --noEmit`.
- [x] 4.2 Mock `@/lib/appfeed/dates` in `tests/room-page.test.ts` and set a fixed `todayInTaipei()` date; add tests for a lease exactly 60 days before end, a lease 61 days before end, a lease on its end date, a lease one day past end, a set `renewal_due`, no lease, and an unavailable feed; run `npx vitest run tests/room-page.test.ts`.
- [x] 4.3 Add room-page tests for `zh-TW` and `en` copy and date formatting, the 390-pixel wrapping classes (`flex-wrap`, `break-words`, no `whitespace-nowrap`), and the absence of another room's reminder; run `npx vitest run tests/room-page.test.ts`.

## 5. Admin console reminder

- [x] 5.1 In `app/[lang]/admin/page.tsx`, call `listLeaseRenewals()` in a try/catch, redirect on `denied`, render the banner after the page header and before the card grid, render the unavailable notice on failure, and render nothing for an empty list; verify with `npx tsc --noEmit`.
- [x] 5.2 Update `tests/admin-page.test.ts` before the new cases: add `listLeaseRenewals` to the hoisted mocks, mock `@/lib/appfeed/renewal`, and set `{ kind: "ok", renewals: [] }` as the default in `beforeEach`; add cases for one room, several rooms sorted by date then room letter, two rooms with the same end date, an empty list, an unavailable read, and a denied session; assert the reset, bank, claims, and repairs cards still render on an unavailable read; run `npx vitest run tests/admin-page.test.ts`.
- [x] 5.3 Add admin-page tests for `zh-TW` and `en` copy and for the banner position before the reset, bank, claims, and repairs cards; run `npx vitest run tests/admin-page.test.ts`.

## 6. Contrast and integration verification

- [x] 6.1 Reuse the existing `amber-200` on `amber-950` contrast pair, comment that it is a conservative lower bound for the translucent banner surface, and add source assertions for the banner classes to `tests/contrast.test.ts`; run `npx vitest run tests/contrast.test.ts`.
- [x] 6.2 Run `npm test` and confirm every Vitest file passes.
- [x] 6.3 Run `npx tsc --noEmit` and confirm no type errors.
- [x] 6.4 Run `npm run build` and confirm the production build succeeds.
- [x] 6.5 Run the focused banner and page render tests for the 390-pixel class contract; when a browser is available, check both locales at 390 pixels with a synthetic in-window fixture and confirm no horizontal scroll. Do not commit fixture changes.

## Workflow follow-up

- The 390-pixel browser check was not run. The focused render tests cover the class contract; a manual browser check remains optional.
- Review the planning artifacts and start the apply workflow in a new request.
- After implementation, run `openspec validate lease-renewal-reminders --strict` before archiving.
- Archive the change only after the project's review and verification requirements are satisfied.
