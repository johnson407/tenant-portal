# Proposal

## Why

Tenants pay rent but cannot tell the landlord which bill they paid. The landlord must match each transfer to a room by hand. Tenants need a way to report a payment date and the last five digits of the sending bank account.

## What Changes

- Add two required Bills columns after `paid_on`: `claimed_on` and `bank_last5`.
- Let a tenant report a payment for one open bill. The tenant enters the paid date and the last five digits of the sending bank account.
- Keep the bill open until the landlord confirms it. A reported claim shows a pending state and does not change `paid_on`.
- Let the tenant replace a pending claim for the same bill before the landlord confirms it.
- Let an admin see all pending claims in the admin console: room, period, claimed date, and last five digits.
- **BREAKING**: change the Google service account scope from `spreadsheets.readonly` to `spreadsheets`. The app now updates two cells in Bills.
- **BREAKING**: change the Bills header and read range from `A:G` to `A:I`.
- **BREAKING**: the service account must have Editor access to AppFeed.

## Capabilities

### New Capabilities
- `payment-claims`: tenant payment claim submission, pending claim state, validation, write failure handling, and admin claim review.

### Modified Capabilities
- `appfeed-data-source`: Bills schema, fixed range, validation, and Google access level change from read-only to read-write.
- `room-dashboard`: show the claim form and pending claim state on open bills.
- `portal-layout`: add a claims card to the admin console layout.

## Impact

- `lib/appfeed/validate.ts`: header list, row parsing, claim field projection.
- `lib/appfeed/google.ts`: OAuth scope, write helper, fresh read before write.
- `lib/appfeed/feed.ts`: include claim fields in the room projection.
- `app/[lang]/rooms/[room]/page.tsx`: open-bill claim form and pending state.
- `app/[lang]/rooms/[room]/actions.ts`: new POST-only claim Server Action.
- `app/[lang]/admin/page.tsx` and admin actions: pending claim list.
- `lib/i18n/dictionaries/*`: new copy in `zh-TW` and `en`.
- `lib/rate-limit.ts`: limit claim writes per session.
- `docs/appfeed-rules.md`: sheet setup steps.
- Environment and Google Drive: Editor share, write scope.
