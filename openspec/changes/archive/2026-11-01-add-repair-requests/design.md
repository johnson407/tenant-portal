# Design

## Context

See `proposal.md` for the motivation and `specs/` for the required behavior.

The current AppFeed reader accepts exactly two tabs, `Bills` and `Leases`. It reads `Bills!A:I` and `Leases!A:D`, validates the exact headers, and caches one room projection under `appfeed:room:<letter>`. Claims already show the write pattern: a fresh read, a two-cell update, a rate limit, and tag invalidation.

The repair feature adds a third data set and a second write path. It must not make bills, payments, or lease data depend on the repair tab. It must also deploy without a window where the current app rejects the sheet.

Redis is available for rate limits. AppFeed is the only source for dashboard data. The app has no database and must not store tenant personal information.

## Goals / Non-Goals

**Goals:**

- Let a tenant submit a category and a short note for their own room.
- Show the room its own request history with `pending` and `done` state.
- Show the admin a pending queue across all rooms and let the admin mark one request done.
- Keep repairs, bills, payments, and lease data independent in availability and caching.
- Add no new runtime dependency and no new environment variable.
- Deploy the app before the sheet change, with a safe rollback.

**Non-Goals:**

- No request edit, delete, reopen, or reassignment.
- No photo, file, or attachment upload.
- No tenant or admin notification, email, or chat.
- No repair analytics, reporting, or service-level targets.
- No new auth role or per-admin account.
- No storage of repairs in Redis.
- No locale beyond `zh-TW` and `en`.

## Decisions

### 1. Store repairs in the AppFeed `Repairs` tab

The tenant and admin already trust AppFeed as the record. A tab keeps one source, lets the landlord inspect and correct data, and follows the claim pattern. The user selected this option.

Alternative: store requests in Redis. This would split the record, add a second data store to back up, and hide the queue from the sheet. Rejected.

### 2. Make `Repairs` optional during deployment

The tab set is valid when it is exactly `Bills` and `Leases`, or exactly `Bills`, `Leases`, and `Repairs`. Any other tab, duplicate, or missing required tab is invalid.

The new app accepts either set. The current app accepts only the two-tab set. If the landlord adds the tab before the new app is live, every room becomes unavailable. The safe order is:

1. Deploy the new app. Bills and lease data keep working. The repair section shows unavailable.
2. Add the `Repairs` tab and its header.
3. Wait for the repair cache to revalidate, or redeploy to clear it.

Alternative: require exactly three tabs and deploy in one window. This creates avoidable downtime and a hard rollback. Rejected.

### 3. Use a fixed seven-column schema

The exact header is:

```text
room, request_id, category, note, submitted_on, status, done_on
```

The fixed range is `Repairs!A:G`.

| Column | Rule |
| --- | --- |
| `room` | `A` to `E`, after trim and uppercase |
| `request_id` | 16 lowercase hex characters |
| `category` | `plumbing`, `electrical`, `appliance`, or `other` |
| `note` | 1 to 200 printable characters after trim |
| `submitted_on` | Real ISO date, set by the server |
| `status` | `pending` or `done` |
| `done_on` | Blank for `pending`; real ISO date for `done` |

The tab holds one row per request. The app never fetches a column outside `A:G`.

### 4. Generate a stable request ID on the server

Use eight random bytes from `crypto.getRandomValues` and encode them as 16 lowercase hex characters. The tenant cannot set the ID.

The ID is the completion key. The admin action reads the tab fresh, finds the row by ID, and updates that row. A row number is not a safe key because an append or a manual sheet edit can move rows.

Alternative: pass the row number from the admin page. Rejected because the page and the write can see different sheet states.

Alternative: use a UUID. It works, but it is longer than needed for this volume. The 16-hex value has a negligible collision chance for a few hundred requests.

### 5. Store category keys, not localized labels

The sheet stores `plumbing`, `electrical`, `appliance`, or `other`. The dictionary maps each key to a `zh-TW` or `en` label. A locale switch never changes stored data, and validation stays simple.

Alternative: store the visible label. Rejected because the same request would have a different value in each locale.

### 6. Generate both dates on the server in Asia/Taipei

Reuse the existing `todayInTaipei()` helper. Move it to a shared module if both claims and repairs need it. Set `submitted_on` on submit and `done_on` on completion.

The tenant does not choose a date. The admin does not choose a completion date. This removes date input errors and keeps the clock consistent.

A done row is valid only when `done_on` is not earlier than `submitted_on`. The server date normally meets this rule. A manually edited future date can fail it, and the row then fails closed.

Alternative: store full timestamps. Rejected to keep the sheet simple and match the existing date style.

### 7. Limit the note and reject detectable personal data

The note is trimmed. It must contain 1 to 200 printable characters and no control character. The parser rejects:

- An email address, such as `name@example.com`.
- A URL, such as `https://example.com` or `www.example.com`.
- A run of seven or more digits, such as a phone number, ID number, or account number.

The form shows a localized warning: do not enter names, phone numbers, emails, ID numbers, addresses, or account numbers.

The app never logs the note. The note is visible only to the owning tenant and an admin session.

Residual risk: a name or a written address can pass these checks. The warning, the length limit, the admin-only view, and the no-log rule reduce the risk. A strict word list would reject valid repair descriptions. The trade-off is recorded below.

Alternative: allow only predefined issue codes. This avoids free text, but the user asked for a short note. Rejected.

### 8. Validate each tab in isolation and fail closed by section

`validateRepairs` checks the header, row width, room, ID, category, note, both dates, status, and duplicate IDs. Completely empty rows are ignored. A row whose room cell is not `A` to `E` is dropped and counted.

If any invalid row belongs to room X, only room X's repair section is unavailable. Bills, payments, and lease data for room X still render. Other rooms are unaffected.

The admin queue fails closed if any Repairs row is invalid. A partial queue could hide a pending request. The admin must fix the sheet before the queue returns.

A missing tab is not an empty history. It is unavailable. A header-only tab is valid and gives an empty history.

Alternative: show valid rows and a warning for invalid rows. Rejected for the admin queue because a hidden pending request is worse than a blocked queue. Rejected for the tenant because the spec requires no partial result.

### 9. Use separate repair accessors

Keep `fetchAppFeedSnapshot()` for `Bills` and `Leases`. Add `fetchRepairsSnapshot()` for `Repairs!A:G`. Both use the same metadata guard and token cache.

Why separate:

- A repair failure must not make bills unavailable.
- A bills failure must not make repairs unavailable.
- The room feed cache must not read repair data it does not show.
- The repair cache can be invalidated without touching the feed cache.

The dashboard makes two metadata calls and two value calls on a cold render. The token cache avoids repeated auth. This cost is acceptable for a small portal.

Alternative: one snapshot for all three tabs. Rejected because it couples the availability and cache of independent sections.

### 10. Cache repairs under a separate room tag

`getRoomRepairs(room)` uses `"use cache"`, the same `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`, and tag `appfeed:repairs:room:<letter>`. The cached value is the already-filtered room projection. No entry holds all rooms.

A successful submit invalidates `appfeed:repairs:room:<room>` for the session room. A successful completion reads the row fresh, learns its room, and invalidates that room's tag.

The admin queue reads fresh on every request. It has no cache.

If the tab is missing, the section returns unavailable. That state can stay in the cache until the 15-minute revalidate. The migration plan tells the operator to wait or redeploy after adding the tab.

Alternative: cache an empty list when the tab is missing. Rejected because an empty history would look like a working feature with no requests.

### 11. Append one row on submit; update two cells on completion

Submit:

```text
POST values:append
range: Repairs!A:G
valueInputOption: RAW
insertDataOption: INSERT_ROWS
body: [[room, requestId, category, note, submittedOn, "pending", ""]]
```

`INSERT_ROWS` avoids overwriting a stray row below the table. It can shift rows, so completion never trusts a saved row number.

Completion:

1. Read the metadata and `Repairs!A:G` fresh.
2. Validate the tab.
3. Find the row by `request_id`.
4. Require status `pending` and a blank `done_on`.
5. PUT `Repairs!F{row}:G{row}` with `[[ "done", doneOn ]]` and `valueInputOption=RAW`.

Only `status` and `done_on` change. The app never changes `room`, `request_id`, `category`, `note`, or `submitted_on`.

A failed append writes no partial row. A failed status update leaves both cells unchanged.

Alternative: `values.update` with a saved row number. Rejected because the row can move.

Alternative: a batch find-and-replace on the request ID. Rejected because it can touch other cells and is harder to keep inside the fixed range.

### 12. Rate-limit both writes and fail closed

Add two buckets in `lib/rate-limit.ts`:

- `REPAIR_SUBMIT_RATE_BUCKET`: 10 attempts per 15 minutes. Keys: `ip:<clientIp>` and `room:<letter>`.
- `REPAIR_DONE_RATE_BUCKET`: 60 attempts per 15 minutes. Key: `ip:<clientIp>`.

The submit limit matches the claim limit. The completion limit is higher so the landlord can clear a backlog. Both use the existing escalating lockout.

If Redis is unavailable, both writes fail with a generic error. The app does not bypass the check.

Alternative: no completion limit. Rejected because a stolen admin session could script many writes. The shared password already limits accountability; the rate limit adds a bound.

### 13. Use server actions with progressive-enhancement forms

Tenant action:

- Validate the locale with `isLocale()`.
- Validate the room and the tenant session.
- Compare the Redis session version.
- Read `category` and `note` from `FormData`.
- Consume the submit rate limit.
- Append the row.
- Invalidate the room repair tag.
- Return a locale-independent code: `category`, `note`, `unavailable`, `rate`, or `generic`.

Admin action:

- Require `isAdminSession()`.
- Consume the completion rate limit.
- Validate the request ID shape.
- Read fresh, find the row, require `pending`.
- Write the two cells.
- Invalidate the room repair tag.
- Return `already-done`, `not-found`, `unavailable`, `rate`, or `generic`.

The `RepairForm` and `RepairDoneForm` client components use `useActionState`. Each admin row has its own form state, so one failure does not affect the other rows. The forms use a plain `<form action={formAction}>`, so they work without client JavaScript.

No redirect is needed. The tag invalidation refreshes the history and queue on the next render.

Alternative: one client component for the whole admin queue. Rejected because per-row pending and error state is simpler and clearer.

### 14. Place the repair cards without changing existing sections

Tenant dashboard:

- Keep the existing bills main column and bank/payments side column.
- Add a full-width repair `SectionCard` below that grid.
- The card holds the form and the room history. Pending requests come first, then done requests. Show at most 20.
- If the repair accessor is unavailable, show the unavailable state and no form. The other cards keep their own state.

Admin console:

- Keep the reset and bank cards in the two-column grid.
- Keep the claims card full width below.
- Add the repairs card full width below the claims card.
- Each pending row shows room, category, note, submitted date, and a mark-done button.
- If the queue is unavailable, show the unavailable state. The other cards stay usable.

The forms use the existing slate palette, `border-slate-500` field borders, `focus-visible` rings, and text labels. Status uses localized text, not colour alone.

Alternative: put repairs in the side column. Rejected because the form and history need width, especially on mobile.

### 15. Extend the dictionaries, not the page copy

Add `room.repairs` and `admin.repairs` sections to the typed `Dictionary`. Each holds:

- Titles, captions, empty and unavailable text.
- Form labels, the note hint, the warning, submit and submitting text.
- Category labels for the four keys.
- Pending and done labels.
- Submitted and done date labels.
- Error text for each action code.

Both `en.ts` and `zh-TW.ts` must satisfy the type. Dates use `formatDate`. The forms map action codes to dictionary entries, so the action stays locale-independent.

### 16. Test the boundaries, not only the happy path

- Parser tests: exact header, valid row, bad ID, bad category, impossible date, done without date, pending with date, done before submitted, duplicate ID, valid leap day.
- Note tests: blank, long, control character, email, URL, long digit run, valid note.
- Google tests: two-tab and three-tab metadata, extra tab, missing Bills or Leases, absent Repairs, fixed ranges, append body and range, status PUT body and range, failure mapping.
- Accessor tests: room projection, no cross-room data, pending-first order, 20 cap, invalid row isolation, missing tab unavailable, cache tags, submit and completion invalidation.
- Action tests: anonymous, wrong room, stale session version, invalid category and note, rate limit, append failure, admin auth, already done, unknown ID, fresh read failure, status write failure.
- Page tests: tenant form and history, admin queue and done form, unavailable states in both locales, no other room's data.
- Boundary tests: no note in logs, no full snapshot to the client, no PII fixtures, no main rent file reference.

## Risks / Trade-offs

- **A repair note can contain a name or address that the pattern checks miss.** → Show the warning, limit the length, keep the note admin-only, never log it, and let the landlord correct the sheet. Accept the residual risk.

- **A timeout after a successful append can make the tenant retry and create a duplicate.** → Show success only after the response, rate-limit submissions, and treat each row as a separate request. A future change can add an idempotency token; this change does not.

- **The optional tab makes the guard slightly weaker.** → Still reject any tab outside the allowed set and any duplicate. A bad Repairs tab only affects repairs.

- **An invalid Repairs row blocks the admin queue and the affected room's repair section.** → This is deliberate fail-closed behavior. The operator fixes the sheet; bills and lease data keep working.

- **A missing tab can stay unavailable in cache for up to 15 minutes after it is added.** → The migration plan says to wait for revalidation or redeploy.

- **`INSERT_ROWS` can shift row numbers.** → Completion reads fresh and finds the row by request ID. A saved row number is never used.

- **The repair cache adds one metadata and one values call on a cold dashboard render.** → The token cache avoids repeated auth, and the result is cached per room.

- **The history is capped at 20.** → Older requests stay in the sheet. This keeps the dashboard readable; the admin queue has no cap.

- **The admin password is shared, so the sheet cannot show which admin marked a request done.** → This is an existing constraint. The change does not add per-admin accounts.

## Migration Plan

1. Deploy the new app. It accepts two or three tabs. Bills, payments, and lease data keep working. The repair section shows unavailable.
2. In AppFeed, add a tab named exactly `Repairs`. Add the exact header `room, request_id, category, note, submitted_on, status, done_on`. Set `A:G` to plain text.
3. Wait for the repair cache to revalidate, up to 15 minutes, or redeploy to clear it.
4. Open a room dashboard. Confirm the repair form appears. Submit one test request.
5. Open the admin console. Confirm the test request is pending. Mark it done. Confirm it leaves the queue and shows as done in the room history.
6. Update the operator runbook and `docs/appfeed-rules.md` with the new tab, header, writes, and order.

Rollback:

1. Export or copy the `Repairs` tab if its data must be kept. Removing the tab deletes its data.
2. Remove the `Repairs` tab. This restores the two-tab set that the current app accepts.
3. Deploy the previous app if needed.

Do not deploy the previous app while the `Repairs` tab exists. It will treat the file as the wrong file and take every room down.
