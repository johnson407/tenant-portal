# Tasks

## 1. Bills schema and validation

- [x] 1.1 Extend `BILLS_HEADER` in `lib/appfeed/validate.ts` to nine columns and add `claimedOn` and `bankLast5` to `BillRow`. Verify `npx vitest run tests/appfeed-validate.test.ts` passes after the fixtures use the new header.
- [x] 1.2 Add the claim pair checks: both blank or both set, `claimed_on` a real ISO date, `bank_last5` matching `^\d{5}$`. Add cases for a partial pair, a bad date, and four, five, and six digits. Verify `npx vitest run tests/appfeed-validate.test.ts`.
- [x] 1.3 Change `BILLS_RANGE` to `Bills!A:I` in `lib/appfeed/google.ts` and update the fake Sheets responses in `tests/appfeed-google.test.ts`. Verify the header check rejects a seven-column row and accepts nine columns.
- [x] 1.4 Update `docs/appfeed-rules.md` with the two new headers, the plain-text format for H:I, and the Editor share. Verify the document names `claimed_on`, `bank_last5`, and every setup step in design.md.

## 2. Google write access

- [x] 2.1 Change `SCOPE` to `https://www.googleapis.com/auth/spreadsheets`. Verify `npx vitest run tests/appfeed-google.test.ts` asserts the new scope in the signed JWT claim.
- [x] 2.2 Add a write helper that sends `PUT /values/Bills!H{row}:I{row}?valueInputOption=RAW` with `{ values: [[claimedOn, bankLast5]] }`. Verify the test checks the method, the exact range, the body, and that no `batchUpdate` call is made.
- [x] 2.3 Map write failures to the existing fixed reason codes and log only `{ reason, room, period }`. Verify a test with a 500, 403, and timeout sees the generic result and no suffix or date in the captured log.

## 3. Claim domain logic

- [x] 3.1 Export a `findBillRow(snapshot, room, period)` helper from `lib/appfeed/validate.ts` that returns the sheet row number and the parsed row, or a typed reason. Verify tests cover the header offset, a paid bill, an unknown period, and a duplicate `(room, period)`.
- [x] 3.2 Create `lib/appfeed/claims.ts` with `parseClaimInput`: real date, not later than today in Asia/Taipei, suffix exactly five digits after trim. Verify unit tests cover a formatted date, an impossible date, a future date, a four- and six-digit suffix, letters, and surrounding whitespace.
- [x] 3.3 Add `CLAIM_RATE_BUCKET` to `lib/rate-limit.ts` and call `consumeAttempt` with the room key and the client IP key before the sheet read. Verify a test rejects the write when the limiter denies and when KV is unavailable.
- [x] 3.4 Add `submitClaim(room, period, input)`: fresh snapshot, row lookup, `paid_on` check, write, then `revalidateTag(`appfeed:room:${room}`)`. Verify tests cover a successful write, a rejected cross-room request, a paid bill, a write failure with no partial claim, and that only the owning room's tag is invalidated.
- [x] 3.5 Add `listPendingClaims()` guarded by `isAdminSession()`, returning only room, period, claimed date, and suffix for rows with a claim and no `paid_on`. Verify tests cover the admin case, a tenant and anonymous caller, confirmed rows being excluded, and the narrow field set.

## 4. Tenant dashboard

- [x] 4.1 Extend `FeedBill` with `claim` and set it in `buildRoomFeed` only for open bills with both cells. Verify `npx vitest run tests/appfeed-feed.test.ts` covers a pending claim, no claim, and a confirmed bill with leftover claim cells.
- [x] 4.2 Add the POST-only Server Action in `app/[lang]/rooms/[room]/actions.ts` that checks the session room, calls `submitClaim`, and returns typed state. Verify `tests/room-claim-action.test.ts` covers success, a field error, a generic failure, a wrong room, and an unauthenticated request.
- [x] 4.3 Add the client claim form `app/[lang]/rooms/[room]/claim-form.tsx` with a hidden `period`, a `type="date"` input, and a five-digit suffix input, and render it for each open bill. Verify `tests/room-page.test.ts` finds the form on an open bill, the pending state with a masked suffix, and no form on a paid bill.
- [x] 4.4 Add `room.claim` copy to `lib/i18n/types.ts`, `dictionaries/zh-TW.ts`, and `dictionaries/en.ts`. Verify `npx vitest run tests/i18n-dictionaries.test.ts` passes and no English string is hard-coded in the page.
- [x] 4.5 Add a masking helper for the tenant view (`•••` plus the last two digits) and use it in the pending state. Verify a unit test shows five digits in the admin projection and only the last two on the tenant page.

## 5. Admin console

- [x] 5.1 Add the pending claims card to `app/[lang]/admin/page.tsx` with room, period, claimed date, and full suffix, plus empty and unavailable states. Verify `tests/admin-page.test.ts` covers a populated list, the empty state, and a read failure that leaves reset and bank cards usable.
- [x] 5.2 Add `admin.claims` copy to `lib/i18n/types.ts` and both dictionaries. Verify `npx vitest run tests/i18n-dictionaries.test.ts` passes and the card uses only dictionary values.
- [x] 5.3 Place the claims card full width below the reset and bank cards, stacking last on mobile. Verify `tests/admin-page.test.ts` checks the order, the full-width class at large viewports, and the single-column order at 390 pixels.

## 6. Boundary and integration

- [x] 6.1 Extend `tests/appfeed-boundary.test.ts` with a claim sentinel for room A and check that room B's feed and cache entry contain no claim value, no full account number is accepted, and no suffix or date reaches a log or page metadata.
- [x] 6.2 Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Verify all three exit zero.
- [ ] 6.3 Run the manual sheet check from design.md: add the headers, share as Editor, submit a test claim, confirm the two cells, check the admin list, then set `paid_on` and confirm the bill leaves the open list.

## Workflow follow-up

- Run `openspec validate tenant-payment-claims --strict` before archive.
- Archive the change after all tasks pass and the manual sheet check succeeds.
