# Proposal

## Why

The room dashboard currently renders the lease dates as the last section, so the most stable, at-a-glance information requires scrolling past bills and a payment history that can grow to 12 rows. Payment history also pushes the sections below it further down. Moving lease dates next to the room title and collapsing payment history by default keeps the page compact and surfaces the information tenants check first.

## What Changes

- Make the payments section a collapsible disclosure that is collapsed by default, so its rows do not occupy the page until the tenant opens it.
- Move the lease start, lease end, and renewal-decision-due values from the bottom section into the page header next to the room title, and remove the now-empty bottom lease section.
- Keep the existing localized empty states: a missing lease shows the missing-lease copy in the header; a null renewal date shows "not available" among the header lease facts.
- When AppFeed is unavailable, render no lease facts in the header; the existing unavailable notice remains the only feed-related content.
- Preserve all existing dashboard content and behavior: bank account reference, bills, last-updated caption, payment empty state (visible after expanding), unavailable state, authorization, and locale handling.
- No new dependencies, environment variables, storage, or client-side JavaScript are required.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `room-dashboard`: The dashboard must render lease facts adjacent to the room heading instead of in a trailing section, and must present payment history in a disclosure that is collapsed by default.
- `appfeed-data-source`: The missing-lease scenarios must refer to the dashboard header rather than the removed lease section.
- `bank-account-info`: The bank read-failure scenario must refer to the header lease facts rather than a lease section.
- `accessible-contrast`: Lease labels and values are now measured against the `slate-100` header background.

## Impact

- `app/[lang]/rooms/[room]/page.tsx`: header markup, lease section relocation, payments section wrapper.
- `lib/i18n/`: no new copy is required if the disclosure reuses the existing localized payments heading; dictionaries and types are expected to stay unchanged.
- `tests/room-page.test.ts`: assertions for lease placement, disclosure markup/default state, empty states, and unavailable state.
- Existing accessible contrast and localization guarantees continue to apply to the moved lease facts and the new disclosure control.
