# Tasks

## 1. Shared dark base and shell

- [x] 1.1 Set the root background/foreground tokens in `app/globals.css` to fixed slate-950/slate-100 values, remove the `prefers-color-scheme` override, add `color-scheme: dark`, and add `bg-slate-950 text-slate-100` to the body in `app/[lang]/layout.tsx`; verify the file contains `#020617`/`#f1f5f9`, has no light/dark media query, and `npx vitest run tests/layout.test.ts` passes.
- [x] 1.2 Create `app/[lang]/portal-shell.tsx` with the brand link, optional room/admin context area, `LocaleSwitcher`, conditional logout form, max-width container, and centered-content option; verify `npx tsc --noEmit` passes and a new render test confirms brand href, locale link, and logout visibility.
- [x] 1.3 Create `app/[lang]/section-card.tsx` for the raised `slate-900` card, `border-slate-800`, `text-xl font-semibold` heading, optional caption, and consistent padding; verify the new render test confirms the heading, caption, and dark surface classes.
- [x] 1.4 Remove the unused `tone` prop and light-colour branch from `app/[lang]/locale-switcher.tsx` and update its call sites; verify `npx tsc --noEmit` passes and `grep -R 'tone="light"' app` returns no matches.
- [x] 1.5 Add `tests/portal-shell.test.ts` covering `PortalShell` with and without logout, the brand/locale links, and `SectionCard` heading/caption output; verify `npx vitest run tests/portal-shell.test.ts` passes.

## 2. Tenant dashboard layout

- [x] 2.1 Restructure `app/[lang]/rooms/[room]/page.tsx` into `PortalShell` plus a page `<header>` containing the room heading, last-updated caption, and three-cell lease stat strip; verify the existing room-page assertions for lease labels inside `<header>` and lease-before-bills still pass after updating the header markup.
- [x] 2.2 Build the main bills column with a `SectionCard`, individual bill cards, prominent total, due date, breakdown, and localized status badge; verify `tests/room-page.test.ts` still finds periods, amounts, due dates, breakdown labels, and `未付款`/`open`, and add an assertion for the badge text.
- [x] 2.3 Build the side column with the bank-account `SectionCard` and the native `<details>` payments card; keep the summary text exactly `付款`/`Payments`, no `open` attribute, and update the focus ring classes; verify the room-page disclosure, summary, focus, and bank assertions pass.
- [x] 2.4 Implement the dark empty/error/unavailable treatments and the centered denial card inside `PortalShell`, keeping the conditional logout and no room-data reads; verify the room-page state and denial tests pass, including no feed/bank calls on denial.
- [x] 2.5 Update `tests/room-page.test.ts` for the new shell/grid classes, dark logout hover/ring, stat strip, bill cards, and summary ring offset; verify `npx vitest run tests/room-page.test.ts` passes.
- [x] 2.6 Update the dashboard section of `tests/contrast.test.ts` with dark pairs (`slate-100`/`slate-300`/`slate-400` on `slate-950`/`slate-900`) and the badge pair (`amber-200` on `amber-950`), replacing the light `slate-100`/white exact-string assertions; verify `npx vitest run tests/contrast.test.ts` passes.

## 3. Sign-in pages

- [x] 3.1 Create `app/[lang]/auth-shell.tsx` with the brand/context panel, card slot, localized site name/description, and responsive split layout; verify `npx tsc --noEmit` passes and the panel renders the active locale's `meta.siteName` and `meta.description`.
- [x] 3.2 Convert `app/[lang]/login/page.tsx` and `app/[lang]/admin/login/page.tsx` to `AuthShell`, preserving each heading, subtitle, locale switcher, form, and footer/admin link; verify `npx vitest run tests/login-page.test.ts` passes.
- [x] 3.3 Add split-layout assertions to `tests/login-page.test.ts` and brand-panel contrast pairs to `tests/contrast.test.ts` for both locales; verify `npx vitest run tests/login-page.test.ts tests/contrast.test.ts` passes.

## 4. Admin console layout

- [x] 4.1 Wrap `app/[lang]/admin/page.tsx` in `PortalShell` with the admin page header, subtitle, and a `lg:grid-cols-2` grid for reset and bank/unavailable sections; keep the reset success panel inside the reset card and preserve all form props; verify `npx vitest run tests/admin-page.test.ts` passes.
- [x] 4.2 Add grid and two-column assertions to `tests/admin-page.test.ts`, update the unavailable heading assertion only if its classes change, and confirm the bank form still receives saved/null values; verify the admin-page test passes.
- [x] 4.3 Verify the dark admin section headings, inputs, success panel, and unavailable notice against `tests/contrast.test.ts`, adding any missing dark pairs; verify `npx vitest run tests/contrast.test.ts` passes.

## 5. Integration and visual verification

- [x] 5.1 Run the full suite with `npm test`; verify all tests pass, including the room, admin, login, layout, shell, and contrast tests.
- [x] 5.2 Run `npx tsc --noEmit` and `npm run build`; verify both complete without errors.
- [x] 5.3 Re-run the Playwright capture against the dev server on port 3001 for `/zh-TW/login`, `/en/login`, `/zh-TW/admin/login`, `/zh-TW/rooms/a`, `/zh-TW/rooms/b` (denied), and `/zh-TW/admin` at 390px and 1280px; verify the screenshots show the dark shell, two-column dashboard/admin layouts, no horizontal overflow, and the stat strip, then compare with `/tmp/opencode/tenant-portal-shots/before/`.
- [x] 5.4 Check the no-JavaScript path in a browser with JavaScript disabled: verify the payment disclosure opens, the locale switch navigates to the equivalent page, and logout submits.
- [x] 5.5 Confirm the success panel still shows the one-time code, copy control, warning, and reset-another control after a reset, and that the admin layout remains two columns in the idle state.

## Workflow follow-up

- Archive the change after review and a clean `openspec validate add-portal-layout-system --strict`.
- Verify the archived result and that the main `portal-layout` and `accessible-contrast` specs contain the new requirements.
