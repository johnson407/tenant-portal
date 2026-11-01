# Proposal

## Why

Three leases end between January and March 2027. A tenant can see the lease end date, but the page gives no timely warning. The landlord also has no single view of the leases that need a renewal decision. A reminder shown in the 60 days before the end date helps both sides act before the lease ends.

## What Changes

- Add a lease renewal window: a lease is due for a reminder when today in Asia/Taipei is on or after 60 days before `lease_end` and on or before `lease_end`. Both ends are inclusive.
- Show a localized renewal banner on the tenant's own dashboard when the lease is inside the window.
- Show one localized renewal banner on the admin console that lists every room inside the window, sorted by lease end date and then room letter.
- Derive reminders from the existing `Leases` data through a new narrow admin accessor. The accessor reuses the existing fixed `Bills!A:Q` and `Leases!A:D` snapshot read and returns only `room` and `lease_end`.
- Keep the reminder visible when `renewal_due` is set. That date records a decision deadline, not a completed renewal.
- Add no dismissal control and store no reminder state. The banner is computed on each render.
- Add no new sheet columns, ranges, environment variables, routes, or dependencies.

## Capabilities

### New Capabilities

- `lease-renewal-reminders`: Defines the 60-day window, the tenant and admin banner behavior, the narrow read boundary, and the localized presentation.

### Modified Capabilities

None. Existing capabilities keep their requirements. The new behavior is additive and derives reminders only from the existing `Leases` data.

## Impact

- `lib/appfeed/validate.ts`: add a lease-window projection from the existing validated snapshot.
- `lib/appfeed/types.ts`: add the narrow reminder type and the admin result type.
- `lib/appfeed/renewal.ts` (new): add the admin-only, server-only reminder accessor.
- `app/[lang]/renewal-banner.tsx` (new): shared server-rendered banner for both views.
- `app/[lang]/rooms/[room]/page.tsx`: show the tenant banner from the loaded room feed.
- `app/[lang]/admin/page.tsx`: load and show the admin reminder list.
- `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/zh-TW.ts`: add localized reminder copy.
- `tests/appfeed-renewal.test.ts` (new), `tests/room-page.test.ts`, `tests/admin-page.test.ts`, `tests/appfeed-boundary.test.ts`, `tests/i18n-dictionaries.test.ts`, `tests/contrast.test.ts`: cover the window, both views, the read boundary, localization, and contrast.
