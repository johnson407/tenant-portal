# AppFeed sheet rules

The tenant dashboard reads one separate, PII-free Google Sheet titled exactly
`AppFeed`. Never point the app at the landlord's main rent file or any copy of
it, and never share that file with the service account.

## File and tabs

- Keep the file title exactly `AppFeed`.
- Keep exactly these tabs: `Bills` and `Leases`, plus the optional `Repairs`
  tab. No other tab is allowed. Remove hidden tabs.
- Keep the `Bills` header row exactly:
  `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5, water_start, water_end, water_rate, electricity_start, electricity_end, electricity_rate, confirmed_on, confirm_note`
- Keep the `Leases` header row exactly:
  `room, lease_start, lease_end, renewal_due`
- Keep the `Repairs` header row exactly:
  `room, request_id, category, note, submitted_on, status, done_on, done_note, visit_start, visit_end, expense_amount`
- Do not rename, reorder, or insert columns. The app reads only `Bills!A:Q`,
  `Leases!A:D`, and `Repairs!A:K`.

## Bills and Leases cells

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
- A claim write changes only columns `H` and `I` of an existing Bills row. It
  never adds a row or changes the sheet structure.
- Set the `H` and `I` columns to plain text before tenants use the form. A
  leading zero in `bank_last5` is lost when Sheets treats the cell as a number.
- Enter `claimed_on` as `YYYY-MM-DD`. Enter `bank_last5` as exactly five digits;
  never enter a full account number.
- `confirmed_on` and `confirm_note` hold the admin confirmation. The app writes
  them from the admin console. Leave both blank for a claim that is not confirmed.
- To confirm a claim, the app first writes `Bills!P:Q` with the confirmation date
  and note. It then writes `Bills!G` with the paid date. This order keeps the
  claim pending if the second write fails. The admin can then retry.
- A manual `paid_on` edit does not set `confirmed_on`. The tenant latest-update
  line does not change.
- `confirmed_on` is a real `YYYY-MM-DD` date. It needs both claim cells. It must
  not be earlier than `claimed_on` or `paid_on`. A blank `paid_on` is allowed
  during the two-step confirmation write.
- `confirm_note` is optional. It needs `confirmed_on`. It follows the same note
  rules as the repair note.
- Do not use formulas that reference the main rent file. Enter values only.

## Meter readings

- Columns `J` to `O` hold the optional water and electricity breakdown. Set
  `Bills!J:O` to plain text before the landlord enters values.
- Leave all three cells of a utility blank when the bill has no breakdown. Old
  rows with blank `J:O` stay valid.
- Enter a group in full or leave it blank. The water group is `water_start`,
  `water_end`, and `water_rate`. The electricity group is `electricity_start`,
  `electricity_end`, and `electricity_rate`. A partial group makes the room
  unavailable.
- Enter readings as whole numbers from 0 to 9,999,999. Enter a rate as NT$ per
  unit with up to four decimal places, for example `8.5`. The rate must be above
  zero.
- The end reading must be equal to or above the start reading. The units are
  `end - start`.
- The app checks the amount. It multiplies the units by the rate and rounds half
  up to a whole NT$. The result must equal the water or electricity amount. For
  example, 5 units at NT$0.50 is NT$2.50, which rounds up to NT$3. Also, 33
  units at NT$2.6253 is 86.6349, so the amount must be NT$87.
- A group with a blank amount is invalid. A bill with no group is still valid.
- Leave the group blank when the bill uses a fixed fee, a minimum charge, or a
  tiered rate. The app cannot show that breakdown.
- A paid bill can keep its group. The app shows the breakdown only on open
  bills.
- Do not use formulas in `J:O`. Enter values only.

## Repairs cells

- Set `Repairs!A:K` to plain text before tenants use the form. This keeps the
  request ID, dates, visit times, and expense values as text.
- Use one row per repair request.
- `room` holds `A` to `E`.
- `request_id` holds 16 lowercase hex characters. The app generates it. Do not
  edit it.
- `category` holds one English key: `plumbing`, `electrical`, `appliance`, or
  `other`. Do not enter a localized label.
- `note` holds 1 to 200 printable characters. Do not use line breaks or tabs.
  Do not enter an email address, a URL, or a run of seven or more digits.
- Do not enter names, phone numbers, emails, ID numbers, addresses, LINE IDs, or
  account numbers. The app rejects data it can detect, but it cannot detect
  every name or written address.
- `submitted_on` holds `YYYY-MM-DD`. The app writes it.
- `status` holds `pending`, `scheduled`, `in_progress`, or `done`. A done
  request cannot return to an active status.
- `done_on` is blank unless status is `done`. It holds `YYYY-MM-DD` for a done
  request. The app writes it.
- `done_note` is blank unless status is `done`. It is optional for a done
  request. The admin can write it when the request is marked done.
- `visit_start` and `visit_end` hold a planned visit window. Use
  `YYYY-MM-DDTHH:mm+08:00`. Both cells must be blank or both must hold valid
  times. The end must be later than the start. A `scheduled` request needs a
  complete visit window. The admin can change or clear the window while the
  request is active.
- `expense_amount` is blank until the admin records a repair cost. Enter a
  whole, non-negative NT$ amount without a currency sign, commas, or decimals.
  `0` is a recorded amount. The admin can add or update the amount after the
  repair is complete. Tenants do not see this value.
- A note holds 1 to 200 printable characters. Do not use line breaks or tabs.
  Do not enter an email address, a URL, or a run of seven or more digits.
- When a tenant submits a request, the app appends one complete row to
  `Repairs!A:K`. An admin status update changes `F` and, when needed, `I:J`.
  Completion changes `F:H`. An expense update changes only `K`. The app never
  changes `A:E`, deletes a row, or changes the sheet structure.
- Do not use formulas in the `Repairs` tab. Enter values only.

## Meter reading deploy order

The current released app reads only `Bills!A:I`. It ignores `J:O`, so the sheet
can hold the new headers before the new app deploys. Do these steps in order:

1. Add the six new names to `Bills!J1:O1`, in this order: `water_start`,
   `water_end`, `water_rate`, `electricity_start`, `electricity_end`,
   `electricity_rate`.
2. Set `Bills!J:O` to plain text.
3. Open a room dashboard on the released app and confirm that the room still
   shows its bills. The released app reads only `Bills!A:I`.
4. Deploy the new app.
5. Fill one test bill with a water or electricity group. Open that room and
   confirm the breakdown line under the amount.
6. Fill the other old rows over time. A blank group stays valid.

Never insert the new columns before `bank_last5`, and never reorder the header.

To roll back:

1. Deploy the previous app version.
2. Leave `Bills!J:O` in place. The previous app ignores these columns, so no
   sheet edit is necessary.

## Repair schedule and expense deploy order

Back up the `Repairs` tab before changing its header. Keep the existing columns
`A:H` in their current order. Do not change the `Bills` or `Leases` tabs.

If the current app already uses a `Repairs` tab:

1. Add `visit_start`, `visit_end`, and `expense_amount` to `Repairs!I1:K1` in
   that order.
2. Set `Repairs!I:K` to plain text. The current app reads only `A:H` and ignores
   the new columns.
3. Open a room dashboard on the current app and confirm that repair history
   still works.
4. Deploy the new app.

If the `Repairs` tab does not exist:

1. Deploy the new app. The repair section stays unavailable until the tab exists.
2. Add the `Repairs` tab with the exact eleven headers above.
3. Set `Repairs!A:K` to plain text.

After deployment:

1. Set one request to `scheduled` with a valid visit window. Confirm the tenant
   sees the localized status and time.
2. Set a request to `in_progress`, then `done`. Confirm the tenant sees each
   status and the completion date.
3. Add or change an expense amount on a completed request. Confirm the admin
   total changes and the tenant sees no expense value.

To roll back, deploy the previous app version that supports the `Repairs` tab
and reads `Repairs!A:H`. Leave columns `I:K` in place. That app ignores them.

Never insert the new columns before `done_note` or reorder the header.

## Sharing

- Share only `AppFeed` with the service-account email as **Editor**. The write
  scope lets the app update claim cells in `Bills`, append repair rows, update
  repair status and visit cells, and update repair expense cells.
- Never share the main rent file, a copy of it, or any other sheet with the
  service account.

## If a room shows unavailable

A Bills or Leases row with an invalid value makes the whole room unavailable.
Other rooms are unaffected. Check that room's Bills and Leases rows against the
rules above, fix the bad row, and wait for the next refresh (up to 15 minutes)
or restart the local server to clear the cache.

An invalid `Repairs` row makes only that room's repair section unavailable. The
bills, payments, and lease still show. The admin repair queue also becomes
unavailable when any `Repairs` row is invalid. Fix the row, then wait for the
next refresh.

If the `Repairs` tab is missing, the repair section shows unavailable. It does
not show an empty history.
