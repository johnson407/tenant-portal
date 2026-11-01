# Proposal

## Why

A tenant cannot see that the landlord finished a repair or confirmed a claim. The tenant must open the page and compare the old values. This silence causes repeat questions and makes the portal feel out of date. A latest-update line with an optional note closes that loop.

## What Changes

- Add a latest-update line to each room dashboard. It shows the most recent tenant-visible admin event: a completed repair or a confirmed payment claim. It shows the event date, a localized event label, and the admin's optional note.
- Add an optional admin note to repair completion. The admin can write a short note when marking a request done. The note appears on the tenant's latest-update line.
- Add an in-app claim confirmation action to the admin console. The admin enters the received date (prefilled with the tenant's claimed date) and an optional note. The action writes `paid_on`, `confirmed_on`, and `confirm_note` for that bill.
- Extend the `Repairs` header to `room, request_id, category, note, submitted_on, status, done_on, done_note` and read `Repairs!A:H`.
- Extend the `Bills` header to `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5, water_start, water_end, water_rate, electricity_start, electricity_end, electricity_rate, confirmed_on, confirm_note` and read `Bills!A:Q`.
- Keep the existing data-freshness timestamp. The new line is a separate "latest update" line, so the two dates cannot be confused.
- Add localized copy for the line, both event labels, the optional note fields, and the new admin action.
- **BREAKING**: The exact `Bills` and `Repairs` headers and fixed ranges change. The current released app ignores columns outside `Bills!A:O` and `Repairs!A:G`, so the sheet can change before the deploy. The new app requires the new headers.

## Capabilities

### New Capabilities

- `tenant-updates`: the room latest-update line, the selection of the most recent qualifying event, the optional note display, and its behavior when a source is unavailable.

### Modified Capabilities

- `appfeed-data-source`: the new `Bills` and `Repairs` columns, fixed ranges, strict validation, room projections, write boundaries, and cache invalidation for confirmation and completion.
- `payment-claims`: the admin confirmation action, the received-date write, the confirmation date and note cells, validation, rate limit, and the tenant-visible confirmation result.
- `repair-requests`: the optional completion note, the admin form field, the `Repairs!F:H` write, and validation.
- `room-dashboard`: the latest-update line in the room header and its availability rules.
- `portal-layout`: the latest-update line as a status element that is readable and not colour-only.
- `localization`: the latest-update line, event labels, note labels and errors, and the claim confirmation form in both locales.

## Impact

- AppFeed: add two `Bills` columns, one `Repairs` column, and set them to plain text. Update the human checklist and the deploy order.
- Code: `lib/appfeed/` types, Google ranges and writes, validation, feed and repair projections; the room page; the admin page, actions, and forms; the dictionaries; a new small update-line helper.
- Tests: synthetic fixtures for the new headers, valid and invalid confirmation and completion rows, write order, cache tags, admin authorization, rate limits, note validation, both locales, and the line's availability rules.
- Docs: update `docs/appfeed-rules.md` with the new headers, the note rules, and the deploy and rollback order.
- Dependencies and environment: no new dependency and no new environment variable. Redis remains required for rate limits.
- Data boundary: both notes are short, optional, validated, never logged, and visible only to the owning tenant and an admin session. The line holds no tenant personal information.
