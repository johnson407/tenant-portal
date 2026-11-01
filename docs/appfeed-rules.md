# AppFeed sheet rules

The tenant dashboard reads one separate, PII-free Google Sheet titled exactly
`AppFeed`. Never point the app at the landlord's main rent file or any copy of
it, and never share that file with the service account.

## File and tabs

- Keep the file title exactly `AppFeed`.
- Keep exactly two tabs: `Bills` and `Leases`. Remove every extra tab, including
  hidden tabs.
- Keep the `Bills` header row exactly:
  `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5`
- Keep the `Leases` header row exactly:
  `room, lease_start, lease_end, renewal_due`
- Do not rename, reorder, or insert columns. The app reads only these columns.

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
- `claimed_on` and `bank_last5` hold a tenant payment claim. The app writes them
  when a tenant reports a transfer. Leave both blank when there is no claim.
- The app writes only columns `H` and `I` of an existing Bills row. It never
  adds a row or changes the sheet structure.
- Set the `H` and `I` columns to plain text before tenants use the form. A
  leading zero in `bank_last5` is lost when Sheets treats the cell as a number.
- Enter `claimed_on` as `YYYY-MM-DD`. Enter `bank_last5` as exactly five digits;
  never enter a full account number.
- To confirm a claim, enter the received date in `paid_on`. The claim leaves the
  admin list, and the bill moves to Payments.
- Do not use formulas that reference the main rent file. Enter values only.
- Do not add names, phone numbers, emails, ID numbers, addresses, LINE IDs,
  notes, or deposit columns. Those fields do not exist in the schema.

## Deploy order

The two-column header and the app deploy depend on each other. Do these steps
together:

1. Add `claimed_on` and `bank_last5` to `Bills!H1:I1` and set `H:I` to plain
   text.
2. Share `AppFeed` with the service account as **Editor**.
3. Deploy the new app in the same change window.

Do not deploy the app before the header exists. Do not leave the header in place
while the old app runs. Either mismatch makes every room show the unavailable
state.

To roll back, remove `H1:I1` first, then deploy the previous app version. The old
app rejects a nine-column header. Keep the claim cells until the rollback is
complete, or copy them if the landlord needs the data.

## Sharing

- Share only `AppFeed` with the service-account email as **Editor**. The write
  scope lets the app update columns `H` and `I` in the `Bills` tab.
- Never share the main rent file, a copy of it, or any other sheet with the
  service account.

## If a room shows unavailable

The dashboard fails closed for the whole room when any row for that room is
invalid. Other rooms are unaffected. Check that room's Bills and Leases rows
against the rules above, fix the bad row, and wait for the next refresh (up to
15 minutes) or restart the local server to clear the cache.
