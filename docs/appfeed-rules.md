# AppFeed sheet rules

The tenant dashboard reads one separate, PII-free Google Sheet titled exactly
`AppFeed`. Never point the app at the landlord's main rent file or any copy of
it, and never share that file with the service account.

## File and tabs

- Keep the file title exactly `AppFeed`.
- Keep exactly two tabs: `Bills` and `Leases`. Remove every extra tab, including
  hidden tabs.
- Keep the `Bills` header row exactly:
  `room, period, rent, water, electricity, due_date, paid_on`
- Keep the `Leases` header row exactly:
  `room, lease_start, lease_end, renewal_due`
- Do not rename, reorder, or insert columns. Extra columns are never read.

## Cell rules

- Store `room`, `period`, and every date as plain text, not as a Google date.
- Use `YYYY-MM` for periods and `YYYY-MM-DD` for dates.
- Use whole NT$ integers only: no `$`, commas, decimals, negative numbers, or
  Chinese numerals.
- Blank `water` or `electricity` means no charge. `0` means a real zero charge.
- Use one Bills row per room per billing period.
- Use one Leases row per room.
- Leave `paid_on` blank until payment is received, then enter the received date.
  A row with `paid_on` moves to Payments.
- Do not use formulas that reference the main rent file. Enter values only.
- Do not add names, phone numbers, emails, ID numbers, addresses, LINE IDs,
  notes, or deposit columns. Those fields do not exist in the schema.

## Sharing

- Share only `AppFeed` with the service-account email as **Viewer**.
- Never share the main rent file, a copy of it, or any other sheet with the
  service account.

## If a room shows unavailable

The dashboard fails closed for the whole room when any row for that room is
invalid. Other rooms are unaffected. Check that room's Bills and Leases rows
against the rules above, fix the bad row, and wait for the next refresh (up to
15 minutes) or restart the local server to clear the cache.
