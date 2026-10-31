# Tasks

## 1. Move lease facts into the header

- [x] 1.1 In `app/[lang]/rooms/[room]/page.tsx`, replace the header title area with a wrapping block containing the `Room X` heading and a compact lease `<dl>` (start, end, renewal due), keeping the locale/logout controls on the right; verify a rendered dashboard test shows the lease labels and dates before the Bills section.
- [x] 1.2 Delete the trailing lease `<section>` and use `dictionary.room.emptyLease` in the header when `feed.lease` is null and `dictionary.room.notAvailable` when `renewalDue` is null; verify the missing-lease and missing-renewal tests pass in both locales.
- [x] 1.3 Render no header lease facts when the feed is unavailable; verify the unavailable-state test passes and the page still shows the localized unavailable notice.

## 2. Make payment history collapsible

- [x] 2.1 Wrap the payments list and its empty state in a native `<details>` with no `open` attribute, using the existing localized payments heading inside `<summary>`; verify a test asserts `<details>` renders without `open` and the summary contains the localized payments label.
- [x] 2.2 Keep the payment rows, order, and formatting unchanged inside the disclosure; verify the existing period, amount, and received-date assertions still pass in both locales.
- [x] 2.3 Add `focus-visible` ring classes to the summary control using the established slate-700/offset palette; verify `tests/contrast.test.ts` and the room page class assertions pass.

## 3. Integration verification

- [x] 3.1 Run `npx vitest run tests/room-page.test.ts tests/contrast.test.ts tests/i18n-dictionaries.test.ts` and confirm all assertions pass.
- [x] 3.2 Run `npm test` and `npx tsc --noEmit` and confirm both succeed.
- [x] 3.3 Run `npm run build` and confirm the production build succeeds.

## 4. Review follow-up

- [x] 4.1 Convert the `room-dashboard` delta to `MODIFIED` and add `MODIFIED` deltas for `appfeed-data-source`, `bank-account-info`, and `accessible-contrast`, so no spec still references a lease section or measures lease labels on white.
- [x] 4.2 Remove `focus-visible:outline-none` from the summary and keep heading typography on the summary only.
- [x] 4.3 Strengthen `tests/room-page.test.ts` to assert the exact summary label, the payment amount inside the disclosure, and no disclosure when the feed is unavailable.
- [x] 4.4 Re-run `openspec validate collapsible-payments-header-lease --strict`, the focused tests, `npm test`, `npx tsc --noEmit`, and `npm run build`.

## Workflow follow-up

- Run `openspec validate collapsible-payments-header-lease --strict` after implementation.
- Archive the change once review requirements are satisfied and sync the modified capability specs.
