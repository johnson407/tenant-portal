# Design

## Context

The portal already has a dark visual language on the sign-in pages and admin console, but the tenant dashboard is still a light `slate-100` page built as one narrow `max-w-2xl` column. Navigation, brand, locale switching, and logout are duplicated per page rather than provided by a shell. The admin page is one `max-w-xl` column that stacks reset and bank forms.

Constraints that shape the approach:

- Pages stay under `app/[lang]/`, with `export const instant = false` on protected routes; no route moves or route groups.
- Server rendering must keep working without client-side JavaScript, including the native payment `<details>` disclosure.
- Existing data reads, authorization, rate limits, locale-prefixed links, and dictionary copy must not change.
- `tests/contrast.test.ts` asserts exact class strings and counts, and `tests/room-page.test.ts` asserts lease labels remain inside `<header>` and the payment summary text stays exactly `付款` / `Payments`.
- The admin reset success panel is an intentional light amber alert on a dark page; it remains inside the reset card so the existing client form and focus order stay intact.

See `proposal.md` for motivation and the two delta specs for observable requirements.

## Goals / Non-Goals

**Goals:**

- One shared dark shell for brand, locale switcher, and logout across dashboard, admin, and denial views.
- A dashboard hierarchy that makes room identity, lease facts, open bills, bank details, and payment history scannable at desktop and mobile widths.
- A split sign-in layout and a wider two-column admin console that reuse existing cards and forms.
- Preserve every behavioral and accessibility guarantee while making the dark palette explicit in both OS colour schemes.

**Non-Goals:**

- No new routes, route groups, data reads, server actions, dependencies, environment variables, or user-facing copy.
- No animation, icon library, custom JavaScript disclosure, or client-side theming.
- No redesign of form fields, validation, error copy, or the one-time reset result.
- No change to AppFeed ordering/caps, bank-account rules, or session/authorization behavior.

## Decisions

### 1. Shared presentational components, not a route-group layout

Add three colocated server components under `app/[lang]/`:

- `portal-shell.tsx` exports `PortalShell`, which renders a skip-free top bar (brand link, locale switcher, optional logout form) and a `<main>` container. Props: `locale`, `path`, `brandHref`, `showLogout`, `centerContent`, `children`. It uses `logoutAction.bind(null, locale)` and the existing `LocaleSwitcher`.
- `auth-shell.tsx` exports `AuthShell`, which renders the split brand/context panel and the existing form card slot for the two sign-in pages. Props: `locale`, `path`, `heading`, `subtitle`, `footer`, `children`.
- `section-card.tsx` exports `SectionCard`, a raised `slate-900` card with `border-slate-800`, a `text-xl font-semibold` `h2`, optional caption, and consistent padding. The root sets `text-slate-100` so the heading inherits it.

Dashboard-specific composition (stat strip, bill cards, status badge) stays in the room page rather than becoming generic abstractions used once.

**Alternative considered:** an `app/[lang]/(portal)/layout.tsx` route group. Rejected because the shell would need tenant/admin session context that differs per route, would force moving pages, and would risk changing the `instant = false` behavior.

### 2. Explicit dark base in the global layout

Change `app/globals.css` so the root tokens are fixed dark values rather than switching with `prefers-color-scheme`:

- `--background: #020617` (slate-950) and `--foreground: #f1f5f9` (slate-100).
- Remove the light/dark media query and set `color-scheme: dark` so native details markers and form widgets match.
- Keep the existing font variables.

Add `bg-slate-950 text-slate-100` to the `body` in `app/[lang]/layout.tsx`. This prevents a white flash and makes both OS schemes render identically, which the contrast delta requires.

**Alternative considered:** keeping theme tokens and adding `dark:` classes. Rejected because the portal is intentionally dark regardless of OS preference, and `dark:` variants would still depend on the OS setting.

### 3. Dashboard composition

The authorized dashboard becomes:

```text
PortalShell (brand + locale + logout)
  header
    h1 "Room A" + last-updated caption
    lease stat strip: start | end | renewal due
  lg grid: minmax(0, 1.65fr) / minmax(20rem, 1fr)
    main: Bills section card
      bill card(s): period, total, due date, status badge, breakdown
    aside:
      Bank account section card
      Payments disclosure card (collapsed)
```

- Keep the lease labels and values inside the page `<header>`, directly under the heading, so the existing `room-dashboard` presentation requirement and its regex tests remain valid. The stat strip is a `<dl>` with three cells; at `sm` it is three columns with vertical dividers, and it stacks below that.
- Put the last-updated caption in the header, right-aligned on wide screens. It stays server-rendered from `feed.fetchedAt`.
- Use a `lg` breakpoint for the main/side grid. Mobile DOM order is header, bills/unavailable, bank, payments; CSS does not reorder. This keeps reading and focus order aligned.
- Bill cards use `rounded-md border border-slate-800 bg-slate-950/50 p-4` inside the bills card, with a prominent `font-mono text-xl` total and a status badge: `rounded-full bg-amber-950 px-2.5 py-1 text-xs font-medium text-amber-200`. The badge includes the localized status text, so colour is not the only cue.
- The payments disclosure stays a native `<details>` with no `open` attribute. Its `<summary>` contains only the `<h2>` text so the summary text assertion remains exact. Update the summary ring to `focus-visible:ring-slate-300` with `ring-offset-slate-900`; no `outline-none`.
- Bank and unavailable states use `SectionCard`. The unavailable card replaces lease/bills/payments content but the bank card still renders in the side column when a bank record exists. If the bank read fails or no record exists, the bank card is omitted, matching current behavior.
- Empty bills/payments use a dashed `border-slate-700` panel with `text-slate-300`; no placeholder values.

Class anchors for test updates: page container `mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8`; bills grid `grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]`; cards `rounded-lg border border-slate-800 bg-slate-900`; secondary text `text-slate-300` / `text-slate-400`; dividers `divide-slate-800`.

### 4. Sign-in split layout

Both sign-in pages use `AuthShell`:

- Large screens: a brand panel on the left and the existing `max-w-sm` form card on the right, inside a `max-w-5xl` centered container.
- Mobile: the panel stacks above the card; the form stays in normal DOM order and every control remains reachable.
- The panel uses `dictionary.meta.siteName` and `dictionary.meta.description`; the card keeps the existing heading, subtitle, locale switcher, form, and footer/admin link. No new dictionary keys.
- The panel uses only slate surfaces and typography, no gradient, so contrast remains easy to verify.

The admin sign-in page shares the same panel copy; its card heading and subtitle still identify the admin flow.

### 5. Admin console two-column layout

Keep the existing `AdminResetForm` and `AdminBankForm` client components. Change the page shell and grid:

- `PortalShell` top bar, then a page header with `dictionary.admin.heading` and subtitle.
- `grid gap-6 lg:grid-cols-2 lg:items-start` with the reset section first and the bank section (or unavailable section) second.
- The reset success panel stays inside the reset card, below the form, exactly where the current component renders it. The grid does not move or span it, so the existing one-time-code focus/scroll behavior and contrast panel remain unchanged.
- The bank unavailable section keeps its exact `h2` classes (`text-xl font-semibold`) and becomes the second grid item.
- Both sections keep their current labels, inputs, actions, pending states, and error handling.

**Alternative considered:** lifting reset state into a parent workspace to render the success panel full-width below the grid. Rejected because it would add a client wrapper, complicate the server/client boundary, and make DOM focus order disagree with the visual row order.

### 6. Denial view as a centered card

The denial branch renders `PortalShell` with `centerContent`, no context heading, and `showLogout={claims?.role === "tenant"}`. The logout control lives only in the shared header, so the page never renders duplicate logout buttons. Inside, a `max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 text-center` card contains the existing heading, message, and back link. Authorization checks and the early return stay before any feed or bank read, so the denial path still loads no room data.

### 7. Locale switcher cleanup

Remove the now-unused `tone` prop and light-tone branch from `locale-switcher.tsx`; every call site is on a dark surface. The link keeps `focus-visible:ring-2 focus-visible:ring-slate-300`, its accessible label, and locale-prefixed href. This is a small internal cleanup with no behavioral change.

### 8. Test and contrast updates

- `tests/room-page.test.ts`: update the logout hover/ring classes and the payment summary ring/offset assertions; keep all text, ordering, collapsed-disclosure, bank, unavailable, and denial assertions. Add checks for the stat strip and `lg:grid-cols` container.
- `tests/admin-page.test.ts`: add a grid-class assertion and keep the exact unavailable `<h2>` assertion and form prop assertions.
- `tests/login-page.test.ts`: keep copy/link assertions and add a split-layout class assertion.
- `tests/contrast.test.ts`: replace the light dashboard pairs with dark pairs (`slate-100` on `slate-950`/`slate-900`, `slate-300`/`slate-400` on those surfaces), add `amber-950` and `amber-700` to the palette map, add the badge pair (`amber-200` on `amber-950`), and replace exact light class/count assertions with the new dark classes. Keep the helper tests and the historical contrast-ratio documentation.
- No new test framework or dependency. All page tests continue to use `renderToStaticMarkup` and mocks.

## Risks / Trade-offs

- **Exact class-string tests break broadly** → Update them in the same change, preserving the behavioral assertions rather than weakening them; run `npx vitest run tests/contrast.test.ts tests/room-page.test.ts tests/admin-page.test.ts tests/login-page.test.ts`.
- **Dark badge contrast is new** → Use the documented `amber-200` on `amber-950` pair and add it to `tests/contrast.test.ts`; keep localized status text so colour is not the only cue.
- **Mobile header crowding at 390px** → Allow wrapping, keep the locale switcher and logout in the flow, and verify no horizontal overflow in Playwright.
- **Native `<details>` marker on dark** → Set `color-scheme: dark` and verify the marker remains visible; do not hide it without an accessible replacement.
- **White flash from the old OS-dependent root tokens** → Fix the root tokens and body classes together; verify both `prefers-color-scheme` values.
- **Bank card and unavailable ordering** → Keep the bank section in the side column and the unavailable card in the main column; verify the bank details still appear when the feed fails.
- **Light amber success panel on a dark page** → Treat it as an intentional alert surface, keep its existing contrast tests, and do not turn it into a dark card.

## Migration Plan

1. Add the shared components and dark global tokens.
2. Convert the dashboard, sign-in pages, admin console, and denial view in that order, keeping existing data/auth code untouched.
3. Update the exact-string tests and add the new layout assertions.
4. Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
5. Re-run the Playwright capture against the existing dev server on port 3001 and compare with `/tmp/opencode/tenant-portal-shots/before/` at 390px and 1280px.

No data migration, env changes, or session invalidation. Rollback is a revert of the visual commit; stored data and auth versions are unaffected.

## Open Questions

None. The dark-tone scope, dashboard structure, admin result placement, and breakpoint choices are resolved above.
