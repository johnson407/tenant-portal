# Design

## Context

See `proposal.md` for the reason and scope. Repair rows now use `Repairs!A:H`. The sheet allows only the `Bills`, `Leases`, and optional `Repairs` tabs. Tenant repair data is room-scoped and cached. Admin repair data is read from a fresh sheet snapshot.

## Goals / Non-Goals

**Goals:**

- Keep each repair, visit window, and expense amount in one row.
- Let tenants see repair status and planned visit times for their room.
- Let the admin manage active repairs and add or update costs for completed repairs.
- Show the admin a total from validated expense amounts.
- Keep expense amounts out of every tenant projection and response.

**Non-Goals:**

- Send email, text, or push notifications.
- Store itemized labor, materials, receipts, or vendor details.
- Add a new sheet tab, database, or external service.
- Let the tenant change a repair request or view its expense.

## Decisions

### Extend the existing Repairs rows

Append three columns after the current `done_note` column:

| Column | Header | Value |
| --- | --- | --- |
| I | `visit_start` | Planned visit start time |
| J | `visit_end` | Planned visit end time |
| K | `expense_amount` | One whole NT$ amount, blank until recorded |

Keep the current A:H order. Store visit values as text in ISO 8601 format with the `+08:00` offset. Store expenses as whole, non-negative NT$ integers. Blank means not recorded. Zero means a recorded zero cost.

This keeps repair data together and supports the requested amount column. A new tab would break the allowed tab set and split one repair across rows. KV storage would also split the source of truth and make the total harder to audit.

### Use four repair statuses

Keep `pending` and `done`. Add `scheduled` and `in_progress`. An active repair can move between active statuses or to `done`. A `done` repair is final. A `scheduled` repair needs a complete visit window. Admins can change or clear the visit window while a repair is active. A cleared window is stored as two blank cells.

The admin repair view will show all active requests for status and visit updates. It will also show completed requests so the admin can add or correct an expense later. The tenant projection will include status and visit times only. The admin projection will include expense amounts.

### Store one expense amount per repair

Keep one amount in column K. The admin can add or update it on a completed repair. The admin total is the sum of all nonblank recorded amounts. A zero amount counts as recorded. The total uses a fresh, fully validated admin read. If the read fails or any repair row is invalid, show an unavailable state instead of a partial total.

An itemized expense table would need another tab or a separate store. It does not fit the requested one amount per repair.

### Protect row updates

Every admin write will require an admin session, read and validate the current sheet, locate one request by ID, and update only its allowed cells. Use one per request lock for status, visit, completion, and expense writes. Verify the saved row after each write. Do not change the original room, ID, category, tenant note, or submitted date.

After a successful write, invalidate only the affected room's repair cache. Read the admin total without a shared cache.

### Keep the tenant view private and current

Return a separate room-scoped projection for tenants. It will not include expense values. Show visit times with the active locale and the Asia/Taipei time zone. Show each status as localized text, so colour is not the only cue. The dashboard will show changes after its next page load; this change adds no notification channel.

### Migrate with trailing columns

Add `visit_start`, `visit_end`, and `expense_amount` to I1:K1. Set I:K to plain text. Old rows keep their existing status and completion data. Their new cells stay blank. The new app requires the full A:K header. The old app reads only A:H, so it can ignore the new trailing columns during rollback.

Deploy in this order:

1. Back up the `Repairs` tab.
2. Add the three headers in I:K and set those columns to plain text.
3. Confirm the released app still reads repair requests.
4. Deploy the new app.
5. Check a scheduled visit, a status update, a completed repair, and an expense update.
6. Confirm the tenant view has no expense amount and the admin total is correct.

For rollback, deploy the prior app. Leave I:K in place. The prior app reads A:H and ignores the added columns.

## Risks / Trade-offs

- **A partial or reordered header makes repair data unavailable.** Add only trailing columns in the listed order, then deploy the matching app.
- **A bad repair row can hide the admin total.** Validate the full tab and show an unavailable state instead of a partial sum.
- **Two admins can update the same request at once.** Lock by request ID, read again before writing, and verify the result.
- **A tenant may not see a new visit time until a page load.** Revalidate the room cache after every successful update. This design does not add outbound alerts.
- **Old rows have no visit times or expenses.** Treat both new fields as blank. Do not infer missing values.

## Open Questions

None.
