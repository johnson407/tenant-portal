# Proposal

## Why

Every authenticated view now renders as a narrow single column on a large screen, with sections separated only by spacing and thin borders. The tenant dashboard floats a short card in a wide empty page, the admin console stacks two unrelated forms, and the sign-in pages have no shared sense of product or place. The portal is functionally complete but visually under-structured, which makes it harder to scan and weakens trust in a page that handles rent and bank details.

This change adds a shared layout system and a stronger visual hierarchy, using the existing sign-in page's dark tone as the portal-wide base.

## What Changes

- Introduce a shared dark portal shell: brand header, room or admin context, locale switcher, logout control, page container widths, and reusable section-card, stat, badge, and empty-state treatments.
- **BREAKING (visual only):** Replace the tenant dashboard's light `slate-100` page with the dark `slate-950`/`slate-900` palette used by sign-in, so the portal reads as one product. No data, routes, or user flows change.
- Restructure the tenant dashboard into:
  - a page header with room identity and last-updated caption,
  - a three-cell lease stat strip (start, end, renewal decision due),
  - a responsive two-column content grid on large screens: open bills in the main column, bank details and the payment disclosure in the side column,
  - individual bill cards with a prominent total and status badge, and a deliberate empty/unavailable card state.
- Redesign both sign-in screens as a split layout on large screens: a brand/context panel beside the existing form card. On small screens the panel stacks above the form card.
- Widen the admin console and place the room-code reset card and bank-account card side by side on large screens, with the one-time reset result remaining prominent inside the reset card.
- Restyle the not-authorized view as a centered card within the same shell instead of loose centered text.
- Preserve every existing behavior: AppFeed reads and ordering, bank account visibility rules, authorization, localized copy, locale-preserving redirects, collapsed-by-default payment disclosure, keyboard focus, and no-JavaScript operation.
- No new dependencies, routes, environment variables, stored data, or user-facing copy. Layout components reuse existing dictionary strings and the existing slate palette.
- Update the contrast guarantees and tests for the new dark surfaces, and replace the obsolete "change is colour-only" constraint with a durable "layout revisions preserve contrast" guarantee.

## Capabilities

### New Capabilities

- `portal-layout`: Shared dark shell, responsive page structure, section/card hierarchy, sign-in split layout, and admin two-column layout across all portal views.

### Modified Capabilities

- `accessible-contrast`: The audited surfaces move from `slate-100`/white to the portal's dark palette, and the historical "change is colour-only" requirement is replaced so future layout work is judged on contrast rather than forbidden.

`room-dashboard` keeps its existing data, ordering, disclosure, and authorization requirements; the new shell and responsive dashboard structure are specified by `portal-layout`.

## Impact

- `app/[lang]/layout.tsx`, `app/globals.css`: page background and shared typography tokens for the dark base.
- `app/[lang]/rooms/[room]/page.tsx`: dashboard shell, header, stat strip, grid, bill cards, bank and payment cards, unavailable/empty states, denial view.
- `app/[lang]/login/page.tsx`, `app/[lang]/admin/login/page.tsx`: split auth layout using existing copy.
- `app/[lang]/admin/page.tsx` and the reset/bank form shells: wider two-column admin layout.
- New colocated layout components under `app/[lang]/` for the shell, brand header, section card, stat, and badge; `locale-switcher.tsx` gains any tone variant the dark shell needs.
- `tests/room-page.test.ts`, `tests/admin-page.test.ts`, `tests/login-page.test.ts`, `tests/contrast.test.ts`, and possibly `tests/layout.test.ts`: class/markup assertions updated for the new structure and dark palette.
- No changes to `lib/appfeed/`, `lib/session*`, `lib/bank-account.ts`, auth actions, or rate limiting.
