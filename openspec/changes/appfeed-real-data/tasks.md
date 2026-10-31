# Tasks

## 0. Manual prerequisites (Johnson-owned, not agent code tasks)

- [ ] 0.1 (Johnson) Create a new Google Sheet titled exactly `AppFeed` with exactly two tabs, `Bills` and `Leases`; verify by reading the title and tab names. The app never creates or edits this sheet.
- [ ] 0.2 (Johnson) Enter the exact header rows from `proposal.md` (`Bills`: `room, period, rent, water, electricity, due_date, paid_on`; `Leases`: `room, lease_start, lease_end, renewal_due`) and format `room`, `period`, and all date cells as plain text; verify no header is renamed or reordered.
- [ ] 0.3 (Johnson) Using the personal gmail.com account, create a Google Cloud project, enable the Google Sheets API, create a service account, and download one JSON key; verify the service-account email and key exist and the key is stored outside the repo.
- [ ] 0.4 (Johnson) Share **only** `AppFeed` with the service-account email as Viewer; verify in the Google Drive Share dialog that the service account does not appear on the main rent file or any copy of it.
- [ ] 0.5 (Johnson) Approve or change the numbered "Open decisions for Johnson" in `proposal.md`; if no answer is recorded, the recommended defaults in that section apply.

## 1. Feed types and validators

- [ ] 1.1 Add `lib/appfeed/types.ts` with `FeedBill`, `FeedPayment`, `FeedLease`, `RoomFeed`, `FeedResult`, `AppFeedSnapshot`, `SnapshotResult`, and `SnapshotFailure`; verify `npx tsc --noEmit` accepts the module.
- [ ] 1.2 Add `lib/appfeed/validate.ts` with the exact Bills and Leases header constants and the regexes `^\d{4}-(0[1-9]|1[0-2])$`, `^\d{1,7}$`, and `^\d{4}-\d{2}-\d{2}$`; verify by exporting and asserting the literal strings in tests.
- [ ] 1.3 Implement `isRealIsoDate()` using `setUTCFullYear` (not `Date.UTC` alone) so leap days work and `2026-02-30`, `2026-13-01`, and `2026-04-31` fail; verify with unit tests.
- [ ] 1.4 Implement `parseRoomCell()` (trim, uppercase, A-E) and `parseWholeTwd()` (trim, digits only, 1-7 digits, blank handling for optional utilities); verify with unit tests.
- [ ] 1.5 Implement Bills row validation: required rent, optional water/electricity, required due_date, optional paid_on, duplicate `(room, period)` detection, and row length checks; verify with unit tests.
- [ ] 1.6 Implement Leases row validation: required start/end, `lease_end >= lease_start`, optional renewal_due, duplicate room detection; verify with unit tests.
- [ ] 1.7 Implement `buildRoomFeed(snapshot, room, fetchedAt)` with open-bill sorting by due_date, payment sorting by paid_on newest first and limit 12, lease projection, fail-closed per room, invalid-room drop/count, and empty-row ignoring; verify with unit tests.
- [ ] 1.8 Add `tests/appfeed-validate.test.ts` covering exact headers, each regex, impossible dates, leap day, negative and formatted amounts (`$1,000`, `1,000`, `-1`), `#DIV/0!`, blank vs `0`, duplicate `(room, period)`, `lease_end < lease_start`, duplicate lease room, empty rows, lowercase/padded room, invalid room dropped, and fail-closed per room; verify with `npx vitest run tests/appfeed-validate.test.ts`.
- [ ] 1.9 Add PII-pattern cases to `tests/appfeed-validate.test.ts`: email-like, phone-like, and ID-number-like strings in every Bills and Leases column are rejected and never appear in the output; verify the test passes.
- [ ] 1.10 Ensure validator and projection logs contain only fixed reasons, tab names, row numbers, and counts; verify with a `console.warn` spy that no cell content is logged.

## 2. Google client and wrong-file guard

- [ ] 2.1 Add `lib/appfeed/google.ts` with `import "server-only"`, a credential reader for `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `APPFEED_SPREADSHEET_ID`, private-key `\n` normalization, and a module-level token cache; verify `npx tsc --noEmit`.
- [ ] 2.2 Implement the service-account JWT with `jose` (`RS256`, `iss`, `scope=https://www.googleapis.com/auth/spreadsheets.readonly`, `aud=https://oauth2.googleapis.com/token`, `iat`, `exp=iat+3600`) and the token POST; verify with `tests/appfeed-google.test.ts` decoding the assertion.
- [ ] 2.3 Create one `AbortSignal.timeout(8000)` deadline per snapshot, pass it to every Google `fetch`, and add `redirect: "error"` and `cache: "no-store"`; verify by asserting the request options in the mocked-fetch test.
- [ ] 2.4 Implement the metadata guard with `fields=properties.title,sheets.properties.title`, exact title `AppFeed`, and exact tab set `{Bills, Leases}` before any values request; verify the fetch call order and refusal cases.
- [ ] 2.5 Implement the values `batchGet` with only `Bills!A:G` and `Leases!A:D`, `UNFORMATTED_VALUE`, exactly two ranges in order, and exact header validation; verify only those ranges appear in the request.
- [ ] 2.6 Map failures to `SnapshotResult`: missing env = config; token/metadata/values 401/403 = auth; 429 = quota; 5xx = server; timeout = timeout; network = network; wrong title/tabs = wrong-file; header mismatch = headers. Mark only 429, 5xx, timeout, and network as `transient`; verify each mapping.
- [ ] 2.7 Add `tests/appfeed-google.test.ts` with mocked `global.fetch` and an RS256 key pair generated in the test; assert JWT claims, metadata-before-values order, fixed ranges, all failure mappings, missing env, and that `APPFEED_SPREADSHEET_ID` never appears in a result or thrown message; verify with `npx vitest run tests/appfeed-google.test.ts`.
- [ ] 2.8 Add a test that a single-line private key with literal `\n` works and a real multi-line key works; verify both token requests are attempted.

## 3. Cached room-scoped accessor

- [ ] 3.1 Add `lib/appfeed/feed.ts` with `import "server-only"`, `getRoomFeed(room: RoomLetter)`, `"use cache"`, `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`, and `cacheTag(\`appfeed:room:${room}\`)`; verify `npx tsc --noEmit`.
- [ ] 3.2 Validate the runtime room argument with `isRoomLetter()` and throw `AppFeedUnavailableError` for an invalid argument; verify with `getRoomFeed("f" as RoomLetter)`.
- [ ] 3.3 Throw `AppFeedUnavailableError` for transient snapshot failures and return `{ kind: "unavailable" }` for structural failures; verify both branches.
- [ ] 3.4 Ensure `feed.ts` exports only `getRoomFeed` and `AppFeedUnavailableError`, and that no export returns `AppFeedSnapshot` or raw rows; verify with a static test.
- [ ] 3.5 Add `tests/appfeed-feed.test.ts` with sentinel values for rooms A-E: every room's serialized result contains only its own sentinels; assert room A contains none of B-E's values anywhere; verify with `npx vitest run tests/appfeed-feed.test.ts`.
- [ ] 3.6 Add tests that the room argument is the only way to select a room, an invalid room throws, transient failures throw, structural failures return unavailable, and no export returns the full feed; verify they pass.
- [ ] 3.7 Confirm no API route, route handler, or Server Action imports `lib/appfeed/feed.ts` or returns feed data; verify with a source scan test.

## 4. Dashboard wiring, localization, and placeholder removal

- [ ] 4.1 Change `lib/i18n/format.ts`: `formatTwd` formats whole NT$ with `minimumFractionDigits: 0` and `maximumFractionDigits: 0`; add `formatDateTime(isoTimestamp, locale)` using `Asia/Taipei`; verify `750` -> `NT$750` (en) and `$750` (zh-TW), and the timestamp examples in `design.md`.
- [ ] 4.2 Update `lib/i18n/types.ts` and both dictionaries with the new `room` keys (`period`, `rent`, `water`, `electricity`, `total`, `lastUpdatedTemplate`, `unavailableHeading`, `unavailableMessage`, `emptyBills`, `emptyPayments`, `emptyLease`, `notAvailable`); remove `placeholderBadge`, `sampleDataCaption`, `labels`, and unused `common.sampleData`; verify key parity with `tests/i18n-dictionaries.test.ts`.
- [ ] 4.3 Rewrite `app/[lang]/rooms/[room]/page.tsx` to call `getRoomFeed(claims.room)` only after the existing tenant/room/session-version checks, catch any thrown error as `{ kind: "unavailable" }`, and keep `export const instant = false`; verify the auth tests still pass.
- [ ] 4.4 Render the last-updated caption, open bills with period/total/due/open status and rent/water/electricity breakdown, payments with period/amount/received date, and lease start/end/renewal; verify both locales render from the dictionary.
- [ ] 4.5 Render the generic unavailable card for structural or caught failures, the no-bills-yet and no-payments-yet empty states, and the missing-lease state; verify no raw error text, stack trace, or cell value reaches the HTML.
- [ ] 4.6 Remove the amber placeholder badge and the three "(sample data)" captions; verify the rendered HTML contains no placeholder/sample text in either locale.
- [ ] 4.7 Delete `lib/placeholder-data.ts` and remove every import and test reference; verify with `grep -rn "placeholder-data\\|PLACEHOLDER_ROOM_DATA" app lib tests` returning no matches.
- [ ] 4.8 Update `tests/room-page.test.ts` with mocked `@/lib/appfeed/feed`: room A normal, room B normal (no room A values), empty, room-unavailable, feed-unavailable (rejected promise), missing lease, zh-TW and en copy, no placeholder/sample text; verify with `npx vitest run tests/room-page.test.ts`.
- [ ] 4.9 Update `tests/i18n-format.test.ts` for whole-NT$ amounts and `formatDateTime`; verify with `npx vitest run tests/i18n-format.test.ts`.
- [ ] 4.10 Update `tests/contrast.test.ts` for the removed sample-data captions, the last-updated caption (`text-xs text-slate-700` on slate-100), and the breakdown labels (`text-xs text-slate-700` on white); verify with `npx vitest run tests/contrast.test.ts`.

## 5. Cross-cutting boundary, PII, and build verification

- [ ] 5.1 Add `tests/appfeed-boundary.test.ts`: no `"use client"` file imports `@/lib/appfeed/feed`, `@/lib/appfeed/google`, or `@/lib/appfeed/validate`; no `NEXT_PUBLIC_` variable contains `GOOGLE_` or `APPFEED_`; `lib/placeholder-data.ts` does not exist and is not imported; `feed.ts` and `google.ts` contain `import "server-only"`; verify the test passes.
- [ ] 5.2 Add a static test that `app/`, `lib/`, and `.env.example` contain no `spreadsheets/d/` URL and no reference to the main rent file's ID or name (build the name from fragments inside the test so the test file itself does not trip the scan; do not scan `docs/`, `openspec/`, or `AGENTS.md`, which must describe the rule); verify the test passes.
- [ ] 5.3 Add a PII fixture check: all AppFeed test fixtures are synthetic and no fixture contains a real-looking email, phone, ID number, address, or tenant name; verify the test passes.
- [ ] 5.4 Run the complete unit suite with `npm test`; verify all tests pass.
- [ ] 5.5 Run `npx tsc --noEmit`; verify no type errors.
- [ ] 5.6 Run `npm run build`; verify the production build succeeds with `cacheComponents` and `partialPrefetching` enabled.
- [ ] 5.7 Run `npx vitest run tests/appfeed-*.test.ts`; verify the feed, Google, validator, boundary, and PII tests pass together.

## 6. Documentation

- [ ] 6.1 Update `.env.example` with `GOOGLE_SERVICE_ACCOUNT_EMAIL=`, `GOOGLE_PRIVATE_KEY=`, and `APPFEED_SPREADSHEET_ID=`, empty values, and comments that they are server-only, sensitive, and never `NEXT_PUBLIC_`; verify no real values or IDs are present.
- [ ] 6.2 Update `AGENTS.md`: replace the placeholder-dashboard sentence, add the three env vars to the Environment section, describe `lib/appfeed` and the AppFeed-only rule in Architecture, and add the new test files to Testing; verify the file reads consistently.
- [ ] 6.3 Add `docs/appfeed-rules.md` with the human checklist: exact title, exactly two tabs, exact headers, plain-text ISO dates, whole-NT$ integers, blank vs `0`, `paid_on` meaning, no formulas from the main file, no notes/names/phones/emails/IDs/addresses/LINE IDs/deposit, share only AppFeed with the service account as Viewer, and fix a bad row to restore a room.
- [ ] 6.4 Add a short pointer to `docs/appfeed-rules.md` from `README.md` and `AGENTS.md`; verify the link path exists.
- [ ] 6.5 Add an AGENTS.md rule that the landlord's main rent file, any copy of it, and its ID/name/URL must never appear in code, env, logs, fixtures, or URLs; verify by reading the final paragraph.

## 7. Verification against the real AppFeed sheet (only after group 0 is complete)

- [ ] 7.1 With the real sheet shared and local env vars set, open each room's dashboard and compare every open bill, payment, and lease date against the sheet; verify the totals and ordering.
- [ ] 7.2 Make a **copy** of AppFeed, add one malformed row for room A (for example `$1,000` rent), point the local `APPFEED_SPREADSHEET_ID` at the copy, and verify only room A is unavailable while rooms B-E still render; restore the original ID afterward.
- [ ] 7.3 Unshare AppFeed from the service account locally and verify the generic unavailable state appears for every room; re-share as Viewer and verify recovery.
- [ ] 7.4 Create a throwaway synthetic sheet (fake values only, never a copy of the main rent file) with the wrong title and an extra tab, share it with the service account as Viewer, point the local `APPFEED_SPREADSHEET_ID` at it, and verify the wrong-file guard refuses before any cell read; unshare, delete the sheet, and restore the real ID afterward. Never share the main rent file or a copy of it with the service account for this test.
- [ ] 7.5 Change one `paid_on` cell, wait for the 15-minute revalidate (or restart the local server to clear the in-memory cache), and verify the bill moves to payments and the last-updated time changes.
- [ ] 7.6 Inspect the server logs after a deliberate bad row and a Google failure; verify only reason codes, tab names, row numbers, and counts appear, with no cell values, IDs, tokens, or PII.
- [ ] 7.7 Open one room in `zh-TW` and `en`; verify `$750`/`NT$750`, localized dates, the last-updated caption, and all unavailable/empty/not-available copy.
- [ ] 7.8 Search the rendered HTML and the source for "sample", "placeholder", "範例", and the old placeholder values; verify no matches.

## 8. Deploy (unchecked until Johnson explicitly says to deploy)

- [ ] 8.1 Add `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `APPFEED_SPREADSHEET_ID` to the Vercel project as sensitive environment variables; verify they are not `NEXT_PUBLIC_` and not visible in the repository.
- [ ] 8.2 Deploy the change; verify each room's dashboard against AppFeed, both locales, and the unavailable state after unsharing. The wrong-file guard is verified locally in 7.4 only, never in production.
- [ ] 8.3 Verify the rollback plan: redeploying the previous build restores placeholder data, so prefer roll-forward; record the chosen action in the deployment notes.
- [ ] 8.4 Keep this group unchecked until Johnson explicitly authorizes the production deploy and env-var setup.

## Workflow follow-up

- Run `openspec validate appfeed-real-data --strict` before archiving.
- Archive only after implementation, group 7 verification, and Johnson's review are complete.
- Do not deploy or set production env vars as part of the planning or implementation workflow without Johnson's explicit instruction.
