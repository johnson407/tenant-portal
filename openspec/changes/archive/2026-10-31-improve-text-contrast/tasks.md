# Tasks

## 1. Shared decisions and contrast test harness

- [x] 1.1 Confirm the inheritance policy: keep `app/globals.css` unchanged, keep the dark shell pages as-is, and require the light `/rooms/[room]` view to declare its own foreground. Verify by grepping all page files for explicit `text-slate-*` on the outermost `<main>`; the only page missing one must be `app/rooms/[room]/page.tsx:44`.
- [x] 1.2 Create `tests/contrast.test.ts` with the Tailwind v4 palette hex map (slate-50…950, amber-50/200/500/900, red-400/700, white), a `relativeLuminance()`/`contrastRatio()` implementation of WCAG 2.1, and one sanity assertion (`white` vs `slate-950` = 20.17). Verify with `npx vitest run tests/contrast.test.ts`.
- [x] 1.3 Add a `sourceHas(file, snippet)` / `sourceLacks(file, snippet)` helper to `tests/contrast.test.ts` that reads files with `node:fs`. Verify the helper's own test asserts a known present and known absent string.

## 2. Tenant sign-in (`/login`)

- [x] 2.1 `app/login/page.tsx:18`: change footer `text-xs text-slate-500` to `text-xs text-slate-300` (3.75:1 → 12.02:1 on slate-900). Verify the source assertion and the ratio assertion (≥4.5) pass.
- [x] 2.2 `app/login/page.tsx:19`: change the "Admin area" link hover from `hover:text-slate-300` to `hover:text-white` (12.02:1 → 17.85:1), keeping `underline`. Verify only the hover colour utility changed by inspecting `git diff app/login/page.tsx`.
- [x] 2.3 `app/login/login-form.tsx:20,41`: change both `border-slate-700` to `border-slate-500` (1.72:1 vs slate-900 / 1.95:1 vs slate-950 → 3.75:1 / 4.24:1). Verify both inputs have ≥3:1 against slate-950 and slate-900 in the ratio test.
- [x] 2.4 `app/login/login-form.tsx:20,41`: remove `focus:outline-none` and add `focus:ring-2 focus:ring-slate-300` (indicator 12.02:1 on slate-900, 13.59:1 on slate-950), keeping `focus:border-slate-400`. Verify the focused select/input shows a visible ring in the browser and the ratio test passes ≥3:1.
- [x] 2.5 `app/login/login-form.tsx:41`: add `placeholder:text-slate-400` to the access-code input (~4.38:1 UA default → 7.87:1 on slate-950). Verify the source assertion and the ratio test (≥4.5) pass.
- [x] 2.6 Add the login rows from `design.md`'s colour table to `tests/contrast.test.ts` and run `npx vitest run tests/contrast.test.ts`; all login assertions must pass.

## 3. Room dashboard (`/rooms/[room]`)

- [x] 3.1 `app/rooms/[room]/page.tsx:44`: add `text-slate-900` to the `<main>` so inherited text is 16.30:1 on slate-100 instead of `#ededed` at 1.07:1 in OS dark mode. Verify by asserting the class in the source test and by rendering with OS dark-mode emulation (no light-on-light text).
- [x] 3.2 `app/rooms/[room]/page.tsx:57,73,89`: add `text-slate-900` to both `<ul>` cards and the `<dl>` card (17.85:1 on white instead of inherited 1.17:1 on white in OS dark mode). Verify bill/payment labels and lease `<dd>` values have an explicit ancestor foreground in the source assertions.
- [x] 3.3 `app/rooms/[room]/page.tsx:55,71,87`: change the three "(sample data)" spans from `text-slate-500` to `text-slate-700` (4.34:1 → 9.45:1 on slate-100). Verify the ratio assertion (≥4.5) and that `text-slate-500` no longer appears in the file.
- [x] 3.4 `app/rooms/[room]/page.tsx:91,95,99`: change the three lease `<dt>` labels from `text-slate-500` to `text-slate-700` (4.76:1 → 10.35:1 on white). Verify the ratio assertion (≥4.5) and the source assertion.
- [x] 3.5 `app/rooms/[room]/page.tsx:57,73,89`: change `border-slate-200` to `border-slate-300` and `divide-slate-200` to `divide-slate-300` (1.23:1 → 1.48:1, decorative only). Verify the cards remain visibly delimited in a screenshot and that no layout class changed.
- [x] 3.6 Add the room-page rows from `design.md`'s colour table to `tests/contrast.test.ts`, including the OS-dark inherited pair, and run `npx vitest run tests/contrast.test.ts`; all room-page assertions must pass.

## 4. Admin sign-in (`/admin/login`)

- [x] 4.1 `app/admin/login/admin-login-form.tsx:21`: change `border-slate-700` to `border-slate-500` (1.72:1 / 1.95:1 → 3.75:1 / 4.24:1). Verify the ratio assertion (≥3:1) passes.
- [x] 4.2 `app/admin/login/admin-login-form.tsx:21`: remove `focus:outline-none` and add `focus:ring-2 focus:ring-slate-300` (12.02:1 / 13.59:1). Verify the focused password input shows a visible ring and the ratio assertion passes.
- [x] 4.3 Add the admin-login rows from `design.md`'s colour table to `tests/contrast.test.ts` and run `npx vitest run tests/contrast.test.ts`; the heading, subtitle, label, error, and button ratios must all be asserted ≥4.5.

## 5. Admin reset (`/admin`)

- [x] 5.1 `app/admin/reset-form.tsx:38`: room select — change `border-slate-700` to `border-slate-500` (3.75:1 / 4.24:1) and replace `focus:outline-none` with `focus:ring-2 focus:ring-slate-300` (12.02:1 / 13.59:1). Verify the ratio assertions and the visible focus ring.
- [x] 5.2 `app/admin/reset-form.tsx:58`: code input — same border and focus swap as 5.1. Verify the ratio assertions.
- [x] 5.3 `app/admin/reset-form.tsx:57-58`: add `placeholder:text-slate-400` to the code input (~4.38:1 UA default → 7.87:1 on slate-950). Verify the source assertion and the ratio assertion (≥4.5).
- [x] 5.4 Confirm the reset-success panel (`app/admin/reset-form.tsx:74-100`) is unchanged and still meets AA: slate-900 on amber-50 17.22:1, red-700 6.24:1, slate-600 7.31:1, white on slate-900 17.85:1. Verify these pairs are asserted in `tests/contrast.test.ts`.
- [x] 5.5 Add the admin rows from `design.md`'s colour table to `tests/contrast.test.ts` and run `npx vitest run tests/contrast.test.ts`; all admin assertions must pass.

## 6. Verification

- [x] 6.1 Cross-check `tests/contrast.test.ts` against every row of `design.md`'s colour table; every old→new pair and both threshold classes (4.5 text, 3 non-text) are covered. Verify by reading the test names and confirming each design-table row has a matching test.
- [x] 6.2 Run `npx vitest run` and confirm the existing suites (`room-page`, auth/action/session/rate-limit tests) plus the new contrast suite pass with no failures.
- [x] 6.3 Run `npm run build` and confirm the production build succeeds with no Tailwind/class errors.
- [x] 6.4 Manual check in OS light and dark: in DevTools → Rendering → "Emulate CSS media feature prefers-color-scheme", load `/login`, `/rooms/<room>` (authorized), `/rooms/<other>` ("Not authorized"), `/admin/login`, and `/admin` (idle and reset-success). Confirm footer, "(sample data)", `<dt>`, bill/payment rows, placeholders, input borders, and focus rings are all readable in both modes; specifically confirm no `#ededed`-on-white text on the room page in dark mode.
- [x] 6.5 Confirm the diff is colour-only: `git diff --stat` touches only the six app files plus `tests/contrast.test.ts`, and `git diff` contains no changes to element structure, copy, spacing/layout classes, or `app/globals.css`. Existing behaviour tests must still pass.

## Workflow follow-up

- Archive the change after review and a green `npx vitest run` + `npm run build`.
- Deploy only when Johnson approves; then verify the five views in production in OS light and dark mode.
