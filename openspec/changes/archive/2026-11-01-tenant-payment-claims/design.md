# Design

## Context

See `proposal.md` for motivation and `specs/` for the required behavior.

The app reads AppFeed through `lib/appfeed/google.ts`. That module signs a service-account JWT with the `spreadsheets.readonly` scope, checks the file title and tab set, and reads the fixed ranges `Bills!A:G` and `Leases!A:D`. `lib/appfeed/validate.ts` checks the exact header, validates every row, and projects one room. `lib/appfeed/feed.ts` wraps the read in `use cache` with the tag `appfeed:room:<letter>` and a 15-minute revalidate.

The dashboard is a server component. It calls `getRoomFeed(sessionRoom)` and renders open bills, payments, and lease facts. The admin page is also a server component. Server Actions are POST-only and use `useActionState` client forms.

Constraints:

- AppFeed must stay free of names, phone numbers, emails, IDs, addresses, and full account numbers.
- The landlord's main rent file must never be referenced or shared.
- Every write must fail closed and must not log cell values.
- The tenant sees only their own room.

## Goals / Non-Goals

**Goals:**

- Report a payment without giving the tenant write access to any other cell.
- Keep the confirmed payment date (`paid_on`) under landlord control.
- Show pending claims to the owning tenant and to the admin.
- Reuse the existing validation, caching, rate-limit, and i18n patterns.

**Non-Goals:**

- No automatic matching or reconciliation of transfers.
- No payment gateway, receipt upload, or bank API integration.
- No tenant edit of `paid_on`, rent, utilities, lease dates, or headers.
- No history of replaced claims. Only the latest claim is kept.
- No notification email or message when a claim is written.

## Decisions

### 1. Claims live in two Bills columns

Add `claimed_on` and `bank_last5` to the end of the Bills header. The pair is the claim state: both blank means no claim, both set with a blank `paid_on` means pending, and a set `paid_on` means confirmed. No status column and no second tab.

Alternatives rejected:

- A separate `Claims` tab needs a second range, a second schema, a join, and cleanup after confirmation.
- KV storage splits the truth between Redis and the sheet. The landlord confirms in the sheet, so the claim must sit next to the bill.

`claimed_on` is a separate column from `paid_on` because only the landlord may confirm a payment. A claim must never move a bill into payment history.

### 2. The write path reads fresh data, not the cache

`getRoomFeed` can be 15 minutes old. `submitClaim` calls `fetchAppFeedSnapshot()` directly. The function is not cached; only `getRoomFeed` is cached. This gives the current `paid_on`, the current file title, and the current tab set.

Row mapping: `batchGet` returns values aligned to the range start, so `snapshot.bills[i]` is sheet row `i + 1`. The header is row 1 and data starts at row 2. Blank rows are not removed by the validator, so the index stays correct.

The write targets `Bills!H{row}:I{row}` only. Duplicate `(room, period)` rows make the room invalid, so the claim is rejected before any write.

### 3. Least-privilege sheet write

Change `SCOPE` to `https://www.googleapis.com/auth/spreadsheets`. Keep the existing JWT, token cache, timeout, `redirect: "error"`, and `cache: "no-store"` behavior. Add one helper that sends `PUT /values/Bills!H{row}:I{row}?valueInputOption=RAW` with `{ values: [[claimedOn, bankLast5]] }`.

Use `RAW` so Sheets does not parse the `claimed_on` date and does not evaluate the suffix as a formula. Do not call `spreadsheets.batchUpdate`, so no tab, row, or column structure can change.

The token cache is per process. A deploy starts a new process with a new token request and the new scope. No manual token purge is needed.

### 4. Pending state is derived, and the tenant sees a masked suffix

Extend `FeedBill` with `claim: { claimedOn: string; bankLast5: string } | null`. `toFeedBill` sets it only when both cells are set. Open bills carry the claim; payments never do.

The tenant page renders the claim as `•••` plus the last two digits. The admin list renders all five digits. The tenant does not need the full value to confirm a claim, and the masked form limits shoulder-surfing. The full value stays in the sheet.

### 5. Validation and row lookup stay in `validate.ts`

Add `claimedOn` and `bankLast5` to `BillRow`. Extend the Bills row checks:

- both blank, or both set;
- `claimed_on` a real `YYYY-MM-DD` date;
- `bank_last5` matches `^\d{5}$`.

Add `findBillRow(snapshot, room, period)`. It returns the sheet row number and the parsed row, or a typed reason. `submitClaim` uses it after a fresh read.

For "today" in Taiwan, format a `Date` with `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" })` and compare ISO strings. Do not use the server's local time zone.

### 6. Claim logic in a new server-only module

Create `lib/appfeed/claims.ts` with `server-only` at the top:

- `parseClaimInput(input)` returns the date and suffix or a field error. It does not touch the network.
- `submitClaim(room, period, input)` runs in this order: rate limit, fresh snapshot, file and header checks, row lookup, `paid_on` check, write, `revalidateTag`.
- `listPendingClaims()` calls `isAdminSession()` itself and throws when the session is not admin. It reads fresh and projects only room, period, claimed date, and suffix.

The admin guard inside the accessor is deliberate. A future caller cannot read all rooms' claims by forgetting a page check. The tenant projection stays separate and room-scoped.

### 7. Write failures are generic and never partial

One PUT sets both cells. A failure leaves both cells unchanged, so no half claim exists. Map the failure to the existing generic unavailable copy and log only `{ reason, room, period }`. Never log the suffix, the date, or a response body.

The action returns a typed state for `useActionState`: validation field errors, a generic failure, or success.

### 8. Rate limit with a new bucket

Add `CLAIM_RATE_BUCKET` to `lib/rate-limit.ts` with a prefix `ratelimit:claim`, 10 attempts, and a 15-minute window. Consume two keys: `room:<letter>` and the client IP key from `lib/client-ip.ts`. Missing KV fails closed, as the current limiter does.

The limiter runs after field validation. An invalid date or suffix returns a field error and never reads the sheet, so the form cannot probe the sheet. Valid but repeated submissions still count toward the limit.

### 9. Cache invalidation after a successful write

Call `revalidateTag(`appfeed:room:${room}`)` after a successful update. The next dashboard render reads the fresh row and shows the pending state. If invalidation fails, the pending state appears after the normal 15-minute revalidate; the bill never shows a false paid state.

The admin claim list is not cached. It reads fresh on each admin page load. Admin traffic is low, and a stale pending list would make the landlord open the sheet to check.

### 10. UI composition

Tenant dashboard: each open bill gets a small server-rendered form inside the open-bills card. The form stays visible when a pending claim exists, so the tenant can replace the date and suffix. A client component `claim-form.tsx` uses `useActionState` for pending and error state. The form holds a hidden `period`, a `type="date"` field, and a `maxLength=5` text field with `inputMode="numeric"`. A no-JS submit still posts the action and re-renders the page; the pending state comes from the re-rendered data.

Admin console: a full-width claims card below the existing two cards. It renders a table with room, period, claimed date, and suffix, plus an empty state and an unavailable notice. The card does not block reset or bank editing.

### 11. Localized copy only

Add keys under `room.claim` and `admin.claims` in `lib/i18n/types.ts`, `dictionaries/zh-TW.ts`, and `dictionaries/en.ts`. Use `formatDate` for the claimed date. Do not hard-code English.

### 12. Setup documentation

Update `docs/appfeed-rules.md` with the header edit, the plain-text format for H:I, and the Editor share. The operator must do this before the new code runs. The old code will fail its 7-column header check against a 9-column row, so the sheet edit and the deploy are one step.

## Risks / Trade-offs

- **Header change takes the whole feed down if the sheet is not ready** → Document the setup as a deploy precondition. Run `npm run build` and the tests first. Verify the header before deploy.
- **Editor share widens the blast radius** → The app writes only H and I, uses one narrow scope, and keeps credentials server-only. The service account still has no access to the main file.
- **Leading zeros in the suffix** → Format H:I as plain text in the setup steps. Add a manual check with a `00123` claim.
- **Concurrent claim writes** → Both target the same two cells, so the last write wins. Both come from the same tenant and room. `paid_on` sits in another column and is never touched.
- **A claim write races a landlord confirmation** → The write reads `paid_on` fresh, then writes H and I. If the landlord confirms between the read and the write, the claim cells change but `paid_on` stays. The bill shows confirmed, and the stale claim cells are harmless. The tenant cannot change a confirmed bill because the next submit sees `paid_on`.
- **Extra Sheets quota** → Each claim costs one metadata read, one values read, and one update. The rate limit caps writes.
- **Rollback with the new columns still present** → The old code rejects a 9-column header. Roll back by removing H:I headers first, or deploy a version that accepts both headers.
- **Timezone** → Use Asia/Taipei for "today". A claim at 00:30 local time is not rejected as "tomorrow".
- **Masked suffix and disputes** → The tenant sees only the last two digits. The landlord sees all five and can compare them with the bank statement.

## Migration Plan

1. Pause claim work. Confirm the current `npm test` and `npm run build` pass.
2. Edit AppFeed: set `H1` to `claimed_on`, `I1` to `bank_last5`, and format H:I as plain text. Leave all data cells empty.
3. Share AppFeed with the service account as Editor. Remove the Viewer share.
4. Deploy the new code with the `spreadsheets` scope.
5. Check a test claim: submit from a room, read the two cells, load the admin console, and confirm the bill stays open.
6. Set `paid_on` in the sheet for that test bill and confirm the claim leaves the admin list and the bill enters payment history.
7. Rollback: remove the two headers, then redeploy the previous version. Removing the headers first keeps the old header check valid.

## Open Questions

None. The remaining choices are visual detail and test naming, and neither changes the specs or the task order.
