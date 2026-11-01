# Proposal

## Why

Tenants have no in-portal way to report a repair. They must use a side channel, so requests are easy to lose and the landlord has no single queue. The landlord also needs a record that shows when a repair was completed.

## What Changes

- Add a `Repairs` tab to AppFeed. Its exact header is `room, request_id, category, note, submitted_on, status, done_on`.
- Add a repair form to the room dashboard. A tenant selects a category and writes a short note. The dashboard lists that room's requests and their `pending` or `done` state.
- Add a pending-repairs section to the admin console. The admin sees every room's pending request and can mark one as done.
- Change the AppFeed guard from exactly two tabs to `Bills` and `Leases` plus an optional `Repairs` tab. No other tab is allowed.
- Add `Repairs!A:G` to the fixed ranges. Read and validate the tab. Append one new row when a tenant submits. Update only `status` and `done_on` when the admin marks a request done.
- Add a room-scoped repair cache with its own tag. Invalidate the affected room after a submit or a completion.
- Add localized copy for the tenant form, request history, admin queue, categories, statuses, and errors.
- Keep the data free of tenant personal information. The note is short and the system rejects detectable personal data.

**BREAKING**: The sheet guard and fixed ranges change. Deploy the new app before adding the `Repairs` tab. The current app treats a third tab as the wrong file and makes every room unavailable.

## Capabilities

### New Capabilities

- `repair-requests`: tenant repair submission, room request history, admin pending queue, and the pending-to-done transition.

### Modified Capabilities

- `appfeed-data-source`: optional `Repairs` tab, exact header, fixed range, validation, append and status write boundaries, room projection, cache, and deploy order.
- `room-dashboard`: repair form and request history on the room dashboard, with availability independent from bills and payments.
- `portal-layout`: repair sections on the tenant dashboard and admin console, including responsive placement.
- `localization`: repair form, history, queue, category, status, and error copy in both locales.

## Impact

- AppFeed: add one tab, set `A:G` to plain text, and keep the header exact.
- Code: `lib/appfeed/` (types, Google access, validation, feed accessors, new repair accessors), room dashboard page and actions, admin page and actions, new form components, and both dictionaries.
- Tests: synthetic fixtures for valid and invalid repair rows, append and status writes, cache tags, access control, rate limits, and both locales.
- Docs: update `docs/appfeed-rules.md` with the new tab, write rules, and deploy and rollback order.
- Dependencies and environment: no new dependency and no new environment variable. Redis remains required for rate limits only.
