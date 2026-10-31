# Proposal

## Why

Johnson reports that text across the portal is hard to read: several labels, placeholders, and inherited text colours are light grey on light backgrounds, and the room dashboard becomes effectively invisible when the OS is in dark mode because it inherits `--foreground: #ededed` from `body` onto a light page (as low as 1.07:1). The portal should meet WCAG 2.1 AA contrast everywhere it currently does not.

## What Changes

- Eliminate inherited light-on-light text on the light room dashboard by giving the page wrapper and each white card an explicit dark foreground (and explicit secondary text colours), so `prefers-color-scheme: dark` can never produce `#ededed` text on white/slate-100.
- Raise the tenant login footer from `text-slate-500` to `text-slate-300` on `bg-slate-900` (3.75:1 → 12.02:1) and flip the link hover from `hover:text-slate-300` to `hover:text-white`.
- Raise the room dashboard "(sample data)" captions and `<dt>` labels from `text-slate-500` to `text-slate-700` (4.34:1 → 9.45:1 on slate-100; 4.76:1 → 10.35:1 on white).
- Add explicit `placeholder:text-slate-400` to the tenant access-code and admin code inputs (browser-default placeholders are ~4.38:1 on `bg-slate-950`, below 4.5:1 and browser-dependent).
- Strengthen form control boundaries from `border-slate-700` to `border-slate-500` on all inputs/selects and add a visible focus ring (`focus:ring-2 focus:ring-slate-300`) so both the boundary and focus indicator clear WCAG 1.4.11's 3:1.
- Give the light dashboard cards a visible outline (`border-slate-300`, `divide-slate-300`) instead of the near-invisible `slate-200` on white/slate-100.
- Add a vitest contrast test that computes ratios for the final class pairs so regressions fail CI.
- No layout, copy, behavior, dependency, or component-structure changes. Colour utilities only.

## Capabilities

### New Capabilities

- `accessible-contrast`: WCAG 2.1 AA contrast guarantees (4.5:1 normal text, 3:1 large text and UI boundaries/focus indicators) for every rendered page, including OS dark-mode inheritance behaviour.

### Modified Capabilities

(none — `accessible-contrast` is added as a new, standalone capability. The archived `tenant-portal-mvp` specs (`tenant-auth`, `admin-reset`, `room-dashboard`) describe behaviour and are unchanged because this change is colour-only.)

## Impact

- `app/globals.css` (theme-consistency decision only — no token redesign required)
- `app/login/page.tsx`, `app/login/login-form.tsx`
- `app/rooms/[room]/page.tsx` (authorized and "Not authorized" views)
- `app/admin/login/admin-login-form.tsx`
- `app/admin/reset-form.tsx` (form controls and reset-success panel)
- `tests/` (new contrast regression test)
- No new dependencies; Tailwind v4 utilities and `app/globals.css` `@theme inline` only
