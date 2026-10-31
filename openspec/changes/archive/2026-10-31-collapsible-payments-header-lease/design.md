# Design

## Context

See proposal.md for motivation. The authorized dashboard is one server component (`app/[lang]/rooms/[room]/page.tsx`) rendered from `getRoomFeed`, with copy from the locale dictionary. The lease values currently live in the final `<section>`; the payments section is a plain list. The page already renders without client JavaScript, and `instant = false` disables partial prefetching for it.

## Goals / Non-Goals

**Goals:**
- Collapse payment history on first render with no JavaScript and no new dependency.
- Surface lease facts in the header block that also holds the room heading.
- Keep all existing data, empty, unavailable, authorization, locale, and contrast behavior intact.

**Non-Goals:**
- Changing AppFeed reads, validation, caching, or any data shape.
- Adding new dictionary keys or changing the bank account, bills, or last-updated sections.
- Persisting the expanded state across visits or locales.

## Decisions

1. **Use native `<details>` / `<summary>` for the payments section.**
   The page is a Server Component and must work without client JavaScript. Native disclosure gives keyboard operation, focus, and expand/collapse semantics for free; absence of the `open` attribute makes it collapsed by default. A client component with `useState` was rejected because it adds a bundle and breaks the no-JS guarantee for a purely presentational toggle.

2. **Use the existing localized payments heading as the summary text.**
   Reusing `dictionary.room.payments` avoids new copy and keeps both locales correct. The heading is rendered inside `<summary>` (permitted heading content); the heading typography lives on `<summary>` and the nested `<h2>` inherits it, so there is one source of truth. The native disclosure marker stays visible as the affordance. No "show/hide" label is added. When there are no payments, the same collapsed disclosure still renders, so the empty-state copy becomes visible only after expanding; this keeps one consistent section shape.

3. **Place the lease facts in the header's title block, not as a separate section.**
   The header becomes a wrapping flex row: a left block containing the `<h1>` plus a compact `<dl>` of lease start, lease end, and renewal due, and the existing locale/logout controls on the right. The `<dl>` wraps on narrow screens. Lease labels keep `text-xs text-slate-700` and values `font-mono text-sm text-slate-900`, preserving AA contrast against the `slate-100` page background. The trailing lease `<section>` is deleted.

4. **Render the header lease block only when the feed loaded.**
   With `feed === null`, the header shows just the room heading; the existing unavailable notice remains the only feed-related content. With a loaded feed and `lease === null`, the header shows `dictionary.room.emptyLease`; a null `renewalDue` shows `dictionary.room.notAvailable`, matching today's copy.

5. **Leave list ordering and row markup unchanged.**
   Payments stay newest-first and capped at 12 by `getRoomFeed`; bills and the payment row markup move inside the disclosure untouched.

6. **Keep the native focus outline alongside the ring.**
   `focus-visible:ring-*` supplies the slate-700 ring, but box shadows are not painted in forced-colors modes. Leaving the native outline in place ensures the summary still has a focus indicator there; the ring remains the visible treatment in normal rendering.

## Risks / Trade-offs

- **Default disclosure marker looks different across browsers** → Keep the native marker rather than restyling it, so rendering and keyboard behavior stay standard.
- **Heading semantics inside `<summary>`** → `<summary>` explicitly allows heading content; the summary remains a single focusable control named by the payments label.
- **Payment rows stay in the HTML while collapsed** → Acceptable on a private, session-gated page; hiding them from the DOM would require client state or duplicate rendering.
- **Contrast of new header/summary text** → Use the existing slate-700/slate-800/slate-900 text classes on slate-100 and the established focus-ring classes; verify with the existing contrast checks during implementation.

## Migration Plan

No data or configuration migration. Deploy the single page change with its test updates; rollback is reverting the page and test edits.
