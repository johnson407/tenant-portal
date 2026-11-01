# Design

## Context

See `proposal.md` for the motivation. The current app reads `Bills!A:O` and `Repairs!A:G` from the PII-free `AppFeed` sheet. It has no database. Claims become confirmed only when an admin edits `paid_on` in the sheet, and repairs become done through an admin console action that writes `Repairs!F:G`. The dashboard already shows a data-freshness timestamp from the feed cache. The new feature needs two new admin actions, new sheet fields, and a tenant-facing line that uses the existing room caches.

The relevant requirements are in `specs/tenant-updates/spec.md`, `specs/appfeed-data-source/spec.md`, `specs/payment-claims/spec.md`, `specs/repair-requests/spec.md`, `specs/room-dashboard/spec.md`, `specs/portal-layout/spec.md`, and `specs/localization/spec.md`.

## Goals / Non-Goals

**Goals:**

- Add a latest-update line that shows the most recent completed repair or confirmed claim for the tenant's room.
- Let an admin add an optional note when marking a repair done or confirming a claim.
- Add an in-app claim confirmation action so the landlord does not need to edit the sheet.
- Keep the change sheet-first and reversible, with no new dependency and no new environment variable.
- Keep notes, dates, and row values inside the existing room and admin boundaries.

**Non-Goals:**

- No email, LINE, push, or other out-of-app notification.
- No read receipts or "tenant has seen this" state.
- No edit or delete of a note after it is written.
- No change to the payment history cap, repair history cap, or claim replacement rules.
- No new tab, no new database, and no new API route.
- No display of the completion or confirmation note in the repair history or the pending admin tables.

## Decisions

### Store the event date and note in trailing AppFeed columns

Add `confirmed_on` and `confirm_note` to `Bills` at P and Q. Add `done_note` to `Repairs` at H. The app reads `Bills!A:Q` and `Repairs!A:H`.

**Why:** AppFeed is the only data source. The note must survive cache expiry and be visible to the landlord. A trailing column keeps existing columns stable and lets the current app ignore the new fields during the sheet-first step.

**Alternatives considered:**

- Store the events in Redis. Rejected: Redis is not the source of truth, entries expire, and the landlord cannot audit notes there.
- Add a separate `Updates` tab. Rejected: the tab allow-list is exact, a new tab expands the data surface, and the event is already tied to a bill or repair row.
- Put the note in the existing repair `note` column. Rejected: that column is the tenant's request text and must not change.

### Use `confirmed_on` as the claim event date

The admin confirmation writes `confirmed_on = todayInTaipei()` and `confirm_note`, then writes `paid_on`. The tenant line uses `confirmed_on` when both `paid_on` and `confirmed_on` are set.

**Why:** The line reports a landlord action. A backfilled `paid_on` can be an old date. Using it would hide a confirmation that happened today behind an older repair. A separate confirmation date also lets the app distinguish an app confirmation from a manual `paid_on` edit.

**Alternatives considered:**

- Use `paid_on` as the event date. Rejected: an old payment date may not become the latest event, so the tenant can miss the confirmation.
- Add a single `confirmed` flag. Rejected: the line needs a date, and a flag cannot order events.

### Write the confirmation in two safe steps

First write `Bills!P{row}:Q{row}` with `[confirmedOn, note]`. Then write `Bills!G{row}` with `[paidOn]`.

**Why:** A single range from G to Q would write unrelated cells and break the write boundary. If the first write fails, the tenant sees no change. If the second write fails, `paid_on` stays blank, so the claim stays pending and the line stays hidden. The hidden confirmation cells are harmless and the next attempt overwrites them.

**Alternatives considered:**

- One `batchUpdate` with two ranges. Rejected: it is still two cell updates, and the sequential PUT path is simpler to test and reason about.
- Write `paid_on` first. Rejected: a failure after that would show a confirmed payment with no confirmation date or note, and the line would not update.

### Write repair completion as one contiguous range

Change the completion write from `Repairs!F:G` to `Repairs!F:H` with `["done", doneOn, doneNote]`.

**Why:** The status, date, and note belong to one row update. A contiguous range avoids a partial completion state and keeps the write boundary small.

### Project the latest event through the existing room caches

Add `lastConfirmation: { date, note } | null` to the tenant feed projection. Add `lastDone: { date, note } | null` to the successful repair projection. Compute each from all room rows before the 12-payment and 20-repair caps.

**Why:** The line must show an event even when its row is outside the display cap. Computing it during the existing read adds no sheet call and no cache. The line then reads two already-cached values.

**Alternatives considered:**

- Add a separate `getLastUpdate(room)` accessor. Rejected: it adds a third cache and a third sheet read for the same data.
- Derive the line from the capped payment and repair arrays. Rejected: the latest event can fall outside the caps.
- Add a new cache tag. Rejected: existing tags already invalidate on the relevant writes.

### Put event selection in one pure helper

Add a small server-only helper that receives the feed result and the repair result and returns one `LatestUpdate | null`. It handles the latest-date choice, the claim tie-break, and the one-source-unavailable cases. The room page formats the result.

**Why:** The selection rules are easy to test without rendering. The page stays a presentation layer, and the helper cannot leak another room because it receives room-scoped inputs only.

### Add an admin claim confirmation form and Server Action

Add a client form beside each pending claim. It posts `room`, `period`, `paidOn`, and `note` to a new POST-only Server Action. The action validates the admin session, locale, room, period, date, note, rate limit, and lock. It reads fresh, confirms the claim, verifies the row, and invalidates `appfeed:room:<room>` with `{ expire: 0 }`.

The form follows the existing repair form pattern: `useActionState`, a pending label, a localized error, and a plain HTML form that works without JavaScript.

**Why:** The current sheet-only confirmation is the gap the feature closes. The existing admin console already hosts the pending claims table, so a form per row needs no new page or route.

**Alternatives considered:**

- Keep sheet-only confirmation and ask the landlord to edit `confirmed_on`. Rejected: it is error-prone and does not validate the date or note.
- Add a separate confirmation page. Rejected: more navigation and no benefit for one action per claim.

### Use a short claim-confirm lock

Add a Redis lock keyed by `claim:confirm:<room>:<period>` with a 30-second TTL, following `repair-lock.ts`. If Redis is not configured or the lock is held, the action fails closed with a generic error.

**Why:** Two admins or a double submit can both read a pending claim and both write. The lock makes the second request wait or fail instead of overwriting the first confirmation. The lock stores no claim data.

**Alternatives considered:**

- No lock and last-write-wins. Rejected: a second confirmation could replace a correct paid date with a different one.
- A database transaction. Rejected: there is no database.

### Share one note validator

Extract the content checks from `isValidRepairNote` into a shared pure validator. Keep `isValidRepairNote` as the repair-note entry point and add validators for the optional completion and confirmation notes. All notes use the same length, control-character, email, URL, and long-digit-run checks. Optional notes allow a blank value; a non-blank value must pass the checks.

**Why:** Three notes with three copies of the rule would drift. A shared validator keeps the PII checks identical.

### Keep the line in the header, separate from the timestamp

Render the line in the room header, before the bills and payment sections. Keep the existing data-freshness timestamp in its current place with its current label. Use `formatDate` for the event date, not `formatDateTime`, because the stored value is a date.

**Why:** The tenant must see the event without opening a section. Two dates with different meanings need different labels. A date-only value must not shift or show a misleading time.

## Risks / Trade-offs

- **Partial confirmation after the second write fails** → `paid_on` stays blank, so the claim remains pending and the line stays hidden. The next attempt overwrites `P:Q`. The admin sees a generic failure.
- **A manual sheet edit can bypass the line** → A manual `paid_on` edit does not create a confirmation. Document that the admin must use the console to update the tenant line. The payment still appears in history.
- **A concurrent row insert can move the target row** → The action reads fresh and verifies the row after the writes. The existing claim write has the same exposure. The admin docs will say not to insert or delete rows during a confirmation.
- **A stale or failed cache invalidation delays the line** → The existing cache revalidates within 15 minutes. A successful confirmation invalidates the room tag immediately. A failed invalidation is no worse than a normal cache refresh.
- **A wrong or missing header makes a tab unavailable** → The sheet-first deploy order prevents this. Add the headers before the new app. The old app ignores the extra columns.
- **A note can contain personal data** → Server validation rejects emails, URLs, long digit runs, control characters, and overlong text. The admin form warns. Logs never include notes.
- **The line can be older than a new bill or payment** → Only the two landlord actions count, by design. The line is not a general activity feed.
- **Two admins can still race before the lock is acquired** → The lock is taken before the fresh read. A failed lock acquisition returns a generic error. The rate limit also reduces repeated attempts.
- **The line adds height to the header at 390px** → The line wraps, uses text, and sits before the cards. The layout must keep the header free of horizontal scroll.

## Migration Plan

1. In `AppFeed`, set `Bills!P1` to `confirmed_on` and `Bills!Q1` to `confirm_note`. Set `Repairs!H1` to `done_note`. Format the new columns as plain text.
2. Verify the current app still reads and renders the room dashboards. The current ranges end at O and G, so the new columns are outside them.
3. Deploy the new app. The new header checks require the new columns.
4. Confirm one test claim and complete one test repair in the admin console. Check the tenant line in both locales and at 390px.
5. Update `docs/appfeed-rules.md` with the new headers, ranges, writes, note rules, and deploy order.

**Rollback:** Deploy the previous app. It reads `Bills!A:O` and `Repairs!A:G` and ignores the new columns. Leave the new columns and their values in place. Do not delete columns during an incident. A confirmed claim still has `paid_on`, so the old app shows it as paid. A done repair still has `status` and `done_on`, so the old app shows it as done.

## Open Questions

None.
