# Design

## Context

See `proposal.md` for motivation. The portal is a Next.js App Router app whose pages use two different design shells:

- **Dark shell** — `/login`, `/admin/login`, `/admin`, and the `/rooms/[room]` "Not authorized" view: `bg-slate-950`/`bg-slate-900` with explicit `text-slate-100`/`text-slate-300`/`text-slate-400`.
- **Light shell** — the authorized `/rooms/[room]` view: `bg-slate-100` page with `bg-white` cards, but **no explicit foreground on the page wrapper or cards**.

`app/globals.css` sets `body { color: var(--foreground) }`, and `--foreground` becomes `#ededed` under `prefers-color-scheme: dark`. Because the light room page never overrides the inherited colour, every bill label, bill/payment amount, and lease `<dd>` can render `#ededed` on white (1.17:1) or slate-100 (1.07:1). That is the root cause reported by Johnson.

Constraints: Tailwind v4 with no `tailwind.config` (`app/globals.css` uses `@import "tailwindcss"` and `@theme inline`), no new dependencies, and no layout/copy/behaviour changes — colour utilities only.

## Goals / Non-Goals

**Goals:**

- Every text node on all five views meets 4.5:1 (normal) or 3:1 (large) in both OS colour schemes, with inherited text included.
- Every text input/select boundary and every focus indicator meets 3:1 (WCAG 1.4.11).
- A regression test that pins the final colour pairs and the source classes.
- A diff that is reviewable as colour-only.

**Non-Goals:**

- Redesigning the palette, introducing a design-token system, or restyling the dark shell.
- Changing disabled-button opacity (inactive controls are exempt from contrast).
- Touching layout, spacing, typography, copy, component structure, or behaviour.
- Deployment.

## Decisions

### 1. Keep `app/globals.css` unchanged; declare the foreground on the light page

The light room page gets `text-slate-900` on `<main>` and on each white card. Every descendant without its own text class then inherits slate-900 (17.85:1 on white, 16.30:1 on slate-100) instead of `--foreground`.

- **Alternative considered:** delete the `prefers-color-scheme: dark` block in `globals.css` so `--foreground` is always `#171717`. Rejected: `body` is the surface behind both light and dark shells; dropping its dark values would make the overscroll/background area flash white behind the dark pages in OS dark mode. The defect is the light page's reliance on inheritance, not the existence of a dark body default. Fixing it at the page boundary is narrower and has no cross-page side effects.
- **Dark pages:** `/login`, `/admin/login`, `/admin`, and the "Not authorized" view already set explicit foreground colours on a dark background, so they render correctly in both OS modes and need no inheritance fix.

### 2. Direct Tailwind class swaps, not new `@theme` tokens

The change touches ~15 class occurrences in 6 files. Introducing semantic tokens (`--color-text-muted`, etc.) in `@theme inline` would require editing `globals.css` and rewriting every consumer for no functional gain, and would turn a colour-only fix into a design-system refactor. Direct utility swaps keep the diff small and let the contrast test assert exact, visible pairs. This does not preclude a token layer later.

### 3. `border-slate-500` for controls, `ring-slate-300` for focus

- Inputs/selects change `border-slate-700` → `border-slate-500`. Against the field fill (`slate-950`) that is 4.24:1; against the surrounding card (`slate-900`) it is 3.75:1. Both clear 1.4.11's 3:1. `border-slate-400` (7.87/6.96) was considered but is a much heavier visual change for no compliance benefit.
- Focus: add `focus:ring-2 focus:ring-slate-300` and remove `focus:outline-none` (the ring is now the focus indicator). Ring contrast is 13.59:1 on slate-950 and 12.02:1 on slate-900. `focus:border-slate-400` stays as reinforcement. Keeping `outline-none` would also be valid, but removing it matches the intent that the new ring replaces the suppressed outline; if a browser also paints its own focus-visible outline, that only adds a second high-contrast indicator.

### 4. `text-slate-700` for secondary text on the light page

`text-slate-500` measured 4.34:1 on slate-100 (fail) and 4.76:1 on white (technically passes but with no margin at 12–14px). `text-slate-700` gives 9.45:1 and 10.35:1 — comfortably AA with room for anti-aliasing/subpixel effects. `text-slate-600` (6.92/7.58) was considered and also passes; slate-700 was chosen for margin and to keep secondary text clearly distinct from headings.

### 5. `placeholder:text-slate-400` rather than changing the browser default globally

The UA placeholder colour is ~4.38:1 on slate-950 and browser-dependent. An explicit `placeholder:text-slate-400` gives 7.87:1. A global `::placeholder` rule was rejected because it would apply to surfaces this change does not audit.

### 6. Light-card borders move one step darker, but are decorative

`border-slate-200`/`divide-slate-200` on white is 1.23:1; `slate-300` is 1.48:1. This is a modest visual definition, **not** a 1.4.11 claim: card containers are not interactive UI components, so their outline is exempt. The card fill (white on slate-100) and content already identify the group. `slate-400` (2.56:1) was considered but reads as a heavy rule and is unnecessary for compliance.
The admin form card's `border-slate-800` on `bg-slate-900` is likewise decorative and stays unchanged.

### 7. Contrast regression test: ratio math + source assertions

Add `tests/contrast.test.ts` (vitest, existing `tests/**/*.test.ts` include, no new dependency):

1. **Ratio table** — a small palette map of the Tailwind v4 hex values and a `contrastRatio()` helper implementing the WCAG relative-luminance formula. Assert each final pair from the table below against its threshold (4.5 text, 3 non-text).
2. **Source assertions** — read the six component files with `node:fs` and assert the required classes are present and the failing ones absent (e.g. no `text-slate-500` remains in `app/rooms/[room]/page.tsx`; `placeholder:text-slate-400` appears on both code inputs; `border-slate-700` no longer appears on inputs/selects; `text-slate-300` appears in the login footer). This catches a revert that the ratio table alone would miss.

A rendered-HTML test is not used for colour because the repo has no browser/CSSOM in the Node test environment; the existing `renderToStaticMarkup` tests cover structure, not computed styles.

## Colour change table

Ratios are WCAG 2.1 contrast ratios computed from Tailwind v4 palette hex values. "inherited" means the element had no text colour and took `body`'s `--foreground`.

| File:line | Element | Old class | New class | Old ratio | New ratio |
| --- | --- | --- | --- | --- | --- |
| `app/rooms/[room]/page.tsx:44` | page `<main>` | *(inherited)* | add `text-slate-900` | 1.07 on slate-100 (OS dark); 16.36 (OS light) | 16.30 |
| `app/rooms/[room]/page.tsx:57,73,89` | white card `ul`/`dl` | *(inherited)* | add `text-slate-900` | 1.17 on white (OS dark); 17.93 (OS light) | 17.85 |
| `app/rooms/[room]/page.tsx:55,71,87` | "(sample data)" spans | `text-slate-500` | `text-slate-700` | 4.34 on slate-100 | 9.45 |
| `app/rooms/[room]/page.tsx:91,95,99` | lease `<dt>` labels | `text-slate-500` | `text-slate-700` | 4.76 on white | 10.35 |
| `app/rooms/[room]/page.tsx:57,73` | row dividers | `divide-slate-200` | `divide-slate-300` | 1.23 on white | 1.48 (decorative) |
| `app/rooms/[room]/page.tsx:57,73,89` | card outline | `border-slate-200` | `border-slate-300` | 1.23 on white | 1.48 (decorative) |
| `app/login/page.tsx:18` | "Landlord?" footer | `text-slate-500` | `text-slate-300` | 3.75 on slate-900 | 12.02 |
| `app/login/page.tsx:19` | "Admin area" hover | `hover:text-slate-300` | `hover:text-white` | 12.02 | 17.85 |
| `app/login/login-form.tsx:20,41` | select/input border | `border-slate-700` | `border-slate-500` | 1.72 vs slate-900; 1.95 vs slate-950 | 3.75 vs slate-900; 4.24 vs slate-950 |
| `app/login/login-form.tsx:20,41` | focus indicator | `focus:outline-none` | `focus:ring-2 focus:ring-slate-300` | none (suppressed) | 12.02 vs slate-900; 13.59 vs slate-950 |
| `app/login/login-form.tsx:40-41` | "10-character code" placeholder | UA default | add `placeholder:text-slate-400` | ~4.38 on slate-950 | 7.87 |
| `app/admin/login/admin-login-form.tsx:21` | password input border | `border-slate-700` | `border-slate-500` | 1.72 vs slate-900; 1.95 vs slate-950 | 3.75; 4.24 |
| `app/admin/login/admin-login-form.tsx:21` | focus indicator | `focus:outline-none` | `focus:ring-2 focus:ring-slate-300` | none (suppressed) | 12.02; 13.59 |
| `app/admin/reset-form.tsx:38` | room select border | `border-slate-700` | `border-slate-500` | 1.72 vs slate-900; 1.95 vs slate-950 | 3.75; 4.24 |
| `app/admin/reset-form.tsx:38` | focus indicator | `focus:outline-none` | `focus:ring-2 focus:ring-slate-300` | none (suppressed) | 12.02; 13.59 |
| `app/admin/reset-form.tsx:57-58` | code input placeholder | UA default | add `placeholder:text-slate-400` | ~4.38 on slate-950 | 7.87 |
| `app/admin/reset-form.tsx:58` | code input border | `border-slate-700` | `border-slate-500` | 1.72 vs slate-900; 1.95 vs slate-950 | 3.75; 4.24 |
| `app/admin/reset-form.tsx:58` | focus indicator | `focus:outline-none` | `focus:ring-2 focus:ring-slate-300` | none (suppressed) | 12.02; 13.59 |
| `app/globals.css:15-20` | `--foreground` (dark) | unchanged | unchanged | 1.07–1.17 on the light page | page now overrides; no edit |

**Already compliant — no change:** `/rooms/[room]` "Not authorized" (slate-100 18.1:1, slate-400 7.87:1, slate-300 13.59:1), `/admin/login` headings/body/labels/errors/buttons (6.45–18.41:1), `/admin` reset-success panel (slate-900 17.22:1, red-700 6.24:1, slate-600 7.31:1, white 17.85:1, amber-900 badge 7.28:1), `slate-100` on `slate-900` (16.30:1), primary buttons `slate-950` on `slate-100` (18.41:1), and disabled buttons at `opacity-50` (inactive controls are exempt).

## Risks / Trade-offs

- [Dark-mode inheritance could recur on a future light page] → The spec makes explicit foreground a page contract; `tests/contrast.test.ts` asserts the room page's explicit classes. Any new light page must repeat the pattern.
- [Card borders at 1.48:1 are still subtle] → They are decorative, not a 1.4.11 boundary; if Johnson wants stronger card definition, `border-slate-400`/`divide-slate-400` (2.56:1) is a colour-only follow-up.
- [Removing `focus:outline-none` may show the UA outline alongside the ring in some browsers] → Both indicators are high-contrast; no accessibility loss. The ring alone already exceeds 3:1.
- [Placeholder colour is still not a substitute for a label] → All inputs keep their visible labels; placeholders remain examples only.
- [Class-string tests can be gamed by unrelated edits] → They are intentionally narrow; the ratio table independently encodes the numeric contract.

## Migration Plan

No data or API migration. Deploy is out of scope for this change and happens only when Johnson approves; rollback would be reverting the colour-only commit.

## Open Questions

None.
