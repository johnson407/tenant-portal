# Design

## Context

See `proposal.md` for the motivation. The current state shapes the approach:

- `lib/appfeed/validate.ts` holds an exact 9-name `BILLS_HEADER`, parses each row, and projects one room. An invalid row makes its room unavailable.
- `lib/appfeed/google.ts` reads `Bills!A:I` and `Leases!A:D`, and writes claims only to `Bills!H:I`.
- The claim columns sit at H and I, so a new column placed before them would break claim writes and every existing row.
- The tenant dashboard renders the water and electricity amounts from `FeedBill`, and the payments disclosure shows only period, amount, and received date.
- The sheet rule is plain values and whole NT$ amounts. Readings are not currently present.

## Goals / Non-Goals

**Goals:**

- Let a tenant check a utility charge from the meter readings and the price per unit.
- Keep the existing amount authoritative. Reject a row whose breakdown does not reproduce its amount.
- Keep every existing row valid when the new cells are blank.
- Keep the claim write, the cache, and the service-account scope unchanged.

**Non-Goals:**

- No breakdown in payment history. A paid bill stays a period, amount, and received date.
- No fixed fee, minimum charge, or tiered-rate column. The full utility amount must equal units x rate.
- No fractional readings. The landlord enters the billing reading as a whole unit.
- No change to the sheet tabs, the app's PII boundary, or the rate limits.

## Decisions

### Put the six new columns after `bank_last5` (J to O)

`water_start, water_end, water_rate, electricity_start, electricity_end, electricity_rate` follow the claim columns. This keeps `Bills!H:I` stable for claim writes.

Alternative: place the meter columns after `electricity` (F to K). Rejected: it shifts `paid_on`, `claimed_on`, and `bank_last5`, so every existing row and the claim write would move. That is a much larger migration.

### Use one group of three cells per utility

A reading pair alone does not explain the amount. A rate alone does not show the usage. The group is `(start, end, rate)`.

The group is all blank or all set. A partial group cannot be checked, so it makes the row invalid.

Alternative: store only the readings and infer the rate from `amount / units`. Rejected: the inferred rate is misleading with a flat fee or a tiered total, and the division can repeat.

### Keep the sheet amount authoritative and check it

The existing `water` and `electricity` amounts stay in place. The app computes `units = end - start`, then `expected = round(units x rate)` to the nearest whole NT$ with a half rounded up, and requires `expected === amount`.

The check uses integer arithmetic to avoid floating-point drift:

- Parse the rate into ten-thousandths: `rateScaled = Math.round(rate * 10_000)`.
- `expected = Math.floor((units * rateScaled + 5_000) / 10_000)`.

The patterns keep the product inside the safe integer range: readings `^\d{1,7}$`, rate `^\d{1,4}(\.\d{1,4})?$`, amount `^\d{1,7}$`. The rate must be greater than zero. A blank amount with a complete group is invalid.

Alternative: compute the amount in the app from the rate and ignore the amount cell. Rejected: the landlord may need a fee or a rounding adjustment, and the amount is the number the tenant must pay. The user chose to keep the amount authoritative.

Alternative: show the values without a check. Rejected by the user.

### Treat a blank group as "no breakdown"

All six cells blank means the row is valid and the bill shows the amount only. This keeps every row that predates the change valid and removes any backfill.

The alternative, requiring the group on every row, would make every room unavailable until the landlord edits all rows.

### Project a small breakdown type

`FeedBill` gains `waterBreakdown` and `electricityBreakdown`, each `{ start, end, units, rate } | null`. The raw row type keeps the start, end, and rate, and the projection computes the units. The narrow projection stays server-only and inside the existing room cache entry. Payment entries do not change.

### Format the rate with a new locale helper

`formatTwd` rounds to whole NT$, so it cannot show `NT$8.5`. Add `formatCount` for readings and units (grouped whole numbers) and `formatRate` for the price per unit (currency with up to four fraction digits) in `lib/i18n/format.ts`.

The UI adds one line under the water and electricity amount, using one dictionary key, `room.billBreakdownTemplate`:

- en: `{start} - {end}: {units} x {rate}`
- zh-TW: `{start} - {end}：{units} 度 × {rate}`

The existing `water` and `electricity` labels prefix the line. The line uses `text-slate-300`, which already passes the contrast checks on the dark card.

### Keep the cache and the write paths unchanged

The breakdown is part of the existing room projection, so `appfeed:room:<letter>` still covers it. No new tag. Claims still write `Bills!H:I`. Repairs are untouched.

## Risks / Trade-offs

- **A fixed fee or a tiered total cannot be shown** because the amount must equal units x rate. → Leave the group blank and show the amount only. A later change can add a fee column. Document this limit in `docs/appfeed-rules.md`.
- **A rounded rate can miss the amount by one NT$** and make the room unavailable. → Document the half-up rule with a worked example, and tell the landlord to adjust the rate until the check passes.
- **A meter with a fractional dial needs a whole-number entry**. → Document that the landlord enters the billing reading as a whole unit. Both readings must use the same rounding.
- **The header must change before the app deploys**. → Deploy order in the migration plan. The released app reads only A:I, so the wider header does not break it.
- **A mismatch hides the whole room**, including claims and payments. → This matches the existing fail-closed rule. The log records only counts, tab, row number, and a reason code, so the landlord finds the bad row with the docs.

## Migration Plan

1. In AppFeed, set `J1` to `water_start`, `K1` to `water_end`, `L1` to `water_rate`, `M1` to `electricity_start`, `N1` to `electricity_end`, and `O1` to `electricity_rate`. Set `J:O` to plain text. Do not change `A:I`.
2. Check that the released app still renders a room. It reads `Bills!A:I`, so the new columns are outside its range.
3. Deploy the new app. It reads `Bills!A:O` and requires the fifteen-name header.
4. Fill a meter group on one test bill. Confirm the breakdown line and the amount.
5. Fill groups on later bills as they are issued. Old rows stay blank.

Rollback:

1. Deploy the previous app. It reads `Bills!A:I` and sees the original nine-name header.
2. Leave columns J to O in place. The previous app never reads them.

Do not insert the new columns before `bank_last5`. That would move the claim cells and break both versions.

Cache behavior after the header change: an old room entry can live for up to 15 minutes. Wait for the refresh, or restart the server, before judging the new app.
