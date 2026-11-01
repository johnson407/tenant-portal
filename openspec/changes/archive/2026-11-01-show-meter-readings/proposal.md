# Proposal

## Why

Tenants see the water and electricity amounts on an open bill, but not how the amount was worked out. They cannot check the meter or the price per unit, so they ask the landlord "why is it this much". Each question costs the landlord time.

## What Changes

- Add six columns at the end of the `Bills` header: `water_start`, `water_end`, `water_rate`, `electricity_start`, `electricity_end`, and `electricity_rate`.
- **BREAKING** for the sheet contract: the required `Bills` header grows from nine to fifteen names, and the app reads `Bills!A:O`. The landlord must add the header row before the new app deploys.
- Validate each utility's three new cells as one group. All blank means no breakdown. All set means start and end are whole readings, rate is an NT$ price per unit with up to four decimal places, end is not less than start, and `round((end - start) x rate)` equals the existing water or electricity amount.
- Reject a row with a partial group or a mismatch. The row makes that room unavailable, as other invalid Bills rows do.
- Project a narrow `waterBreakdown` and `electricityBreakdown` for each open bill. Each holds start, end, units, and rate.
- Show the breakdown under each open bill: the start reading, the end reading, the units, the price per unit, and the cost. Use localized copy in `zh-TW` and `en`.
- Leave payment history, claims, repairs, and lease data unchanged.
- Update `docs/appfeed-rules.md` with the new header, the row rules, and the deploy order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `appfeed-data-source`: the Bills schema, fixed read range, strict validation, and room-scoped projection gain optional meter readings and a unit price per utility.
- `room-dashboard`: each open bill shows the meter reading breakdown for water and electricity when the row holds one.

## Impact

- `lib/appfeed/types.ts`: add the breakdown type and fields on `FeedBill`.
- `lib/appfeed/validate.ts`: extend `BILLS_HEADER`, parse and check the six cells, and project the breakdown.
- `lib/appfeed/google.ts`: change the Bills read range from `Bills!A:I` to `Bills!A:O`. Claim writes stay at `Bills!H:I`.
- `app/[lang]/rooms/[room]/page.tsx`: render the breakdown on each open bill.
- `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/zh-TW.ts`: add the breakdown labels.
- `docs/appfeed-rules.md`: document the header, cell rules, and deploy order.
- Tests: `tests/appfeed-validate.test.ts`, `tests/appfeed-google.test.ts`, `tests/appfeed-feed.test.ts`, `tests/appfeed-boundary.test.ts`, `tests/room-page.test.ts`, `tests/i18n-dictionaries.test.ts`.
- No new dependency. No new environment value. No change to the cache key or the service-account scope.
