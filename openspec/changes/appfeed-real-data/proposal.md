# Proposal

## Why

The tenant dashboard currently shows clearly labelled placeholder bills, payments, and lease dates. Tenants need their real amounts and dates, and the landlord needs one clean, low-risk place to maintain them. The only real source today is the landlord's main rent file (`房租2022-2032`, a Google Sheet, plus a legacy xlsx copy), which contains tenant personal information (names, ID numbers, phone numbers, addresses), so the app must never read it. This change defines a separate, PII-free Google Sheet named **AppFeed** as the sole data source and replaces placeholder content with room-scoped data from it.

**Verified constraint:** an AppFeed spreadsheet does not exist in Johnson's Drive yet (searched by title). This change therefore defines the exact schema and app contract; creating and filling the sheet is a Johnson-owned prerequisite, not a code task. Until the sheet exists and is shared, the dashboard shows the generic unavailable state, never placeholder data.

## What Changes

- Add a new capability, `appfeed-data-source`, that owns the AppFeed schema, Google authentication, the wrong-file guard, validation, caching, failure states, and the no-PII guarantee.
- Define AppFeed as exactly two tabs, `Bills` and `Leases`, with exact header rows. No names, phones, emails, ID numbers, addresses, LINE IDs, notes, free text, or deposit.
- Authenticate with a Google service account that can read only AppFeed (shared as Viewer). Sign the service-account JWT with the existing `jose` dependency and call the Sheets REST API with `fetch`; no new runtime dependency.
- Add a wrong-file guard: read spreadsheet metadata first (title and tab names only) and refuse unless the title is exactly `AppFeed` and the tabs are exactly `{Bills, Leases}`. Read cells only from fixed ranges `Bills!A:G` and `Leases!A:D`.
- Replace placeholder bills, payments, and lease dates with real data from AppFeed through a server-only, room-keyed cached accessor (`"use cache"` + `cacheLife` + `cacheTag`, 15-minute revalidate).
- Show generic unavailable, empty-bills, empty-payments, missing-lease, and last-updated states; never fall back to placeholder data in production.
- Remove `lib/placeholder-data.ts` and the placeholder/sample-data copy.
- Add hand-written validators (regex + calendar checks, no new dependency), tests, documentation, and three new environment variable names.
- **BREAKING (internal only):** dashboard amounts change from `amountCents` to whole New Taiwan dollar integers. Taiwan dollars have no cents; display uses `Intl.NumberFormat` with zero fraction digits. No external API changes.

## AppFeed schema (canonical)

Exactly two tabs, with these exact names, header rows, and column order. AppFeed must not copy the main sheet's formats: no Taiwan-calendar year strings, no `$1,000` text, no `2025年4月1日` dates, and no `#DIV/0!` placeholder formulas. Dates are ISO and amounts are plain integers.

### Tab `Bills`

Header row (row 1): `room | period | rent | water | electricity | due_date | paid_on` (range `Bills!A:G`).

| Column | Required | Format | Meaning |
| --- | --- | --- | --- |
| `room` | yes | `A`–`E` after trim + uppercase | One room per row. |
| `period` | yes | `YYYY-MM`, regex `^\d{4}-(0[1-9]\|1[0-2])$` | Billing month. |
| `rent` | yes | Whole NT$, regex `^\d{1,7}$` | Rent for the period. |
| `water` | no | Whole NT$, regex `^\d{1,7}$`; blank = no charge | Water is billed on an alternating two-month cycle, so blank is normal. `0` is a real zero charge. |
| `electricity` | no | Whole NT$, regex `^\d{1,7}$`; blank = no charge | Same two-month cycle rule as water. |
| `due_date` | yes | `YYYY-MM-DD`, real calendar date | Payment due date. |
| `paid_on` | no | `YYYY-MM-DD`, real calendar date; blank = unpaid | Payment received date. |

One row per room per billing period. Duplicate `(room, period)` rows are invalid.

### Tab `Leases`

Header row (row 1): `room | lease_start | lease_end | renewal_due` (range `Leases!A:D`).

| Column | Required | Format | Meaning |
| --- | --- | --- | --- |
| `room` | yes | `A`–`E` after trim + uppercase | One room per row. |
| `lease_start` | yes | `YYYY-MM-DD`, real calendar date | Lease start. |
| `lease_end` | yes | `YYYY-MM-DD`, real calendar date, `>= lease_start` | Lease end. |
| `renewal_due` | no | `YYYY-MM-DD`, real calendar date; blank = not set | Renewal decision date. |

One row per room. Duplicate room rows are invalid.

**Formatting rule:** `room`, `period`, and every date cell must be stored as **plain text**, not as a Google date/number value. Amounts may be numeric or plain text, but must contain digits only (no `$`, commas, or Chinese date text). The app requests `UNFORMATTED_VALUE`; a real Google date therefore comes back as a serial number and is rejected rather than guessed.

## Authentication decision

| Criterion | A. Service account (recommended) | B. "Publish to web" CSV |
| --- | --- | --- |
| Setup | Create a Google Cloud project, enable Sheets API, create a service-account key, set 3 env vars | File → Share → Publish to web → CSV; copy the URL |
| Credential exposure | Private key in Vercel sensitive env vars; never `NEXT_PUBLIC_`, never in the repo, never logged | URL is public to anyone who has it: unguessable is not secret |
| Scope | OAuth scope `spreadsheets.readonly` is account-wide, so isolation comes from **sharing only AppFeed**; the service account must never be shared with the main rent file | No per-room scoping; one URL exposes every room's amounts |
| Revocation | Unshare AppFeed or rotate the key | Unpublish and re-publish (new URL); already-copied URLs and caches may persist |
| Leak paths | Env/log access only; code never prints the key or ID | URL can leak through logs, referrers, browser history, or a forwarded link |
| Freshness | Google may cache; the app caches for 15 minutes | Google caches published output for a few minutes; the app cannot force a refresh |
| Failure modes | 401/403/429/5xx/timeout map to unavailable | 404/network map to unavailable; silent stale CSV is possible |
| Cost | Free within the Sheets quota | Free |

**Decision: Option A.** The service account is read-only, the key stays on the server, and the file is shared with exactly one identity. The OAuth scope cannot be limited to one file, so the design states the isolation rule explicitly: the service account must only ever be shared with AppFeed. The private key is long-lived and must be rotated by creating a new key, updating Vercel, redeploying, then deleting the old key. Newlines in `GOOGLE_PRIVATE_KEY` are normalized (literal `\n` → newline) before import.

**Rejected:** an API key on a link-shared sheet (a link-shared sheet is public to anyone with the link, and API keys identify a project, not a user); OAuth with Johnson's own Google account (refresh-token expiry, broad access to his whole Drive); an Apps Script web app (an extra deployed service and credential to operate). Option B remains a fallback only if Johnson refuses to set up a service account; it is not the default.

## Open decisions for Johnson

1. **Authentication method: service account vs published CSV.**
   - Options: A, service account (recommended); B, publish-to-web CSV.
   - Recommended default: A.
   - If unanswered: the code targets A and the deploy stays blocked until the service account exists. No CSV fallback is silently enabled.

2. **Who creates AppFeed and approves the two-tab schema.**
   - Options: Johnson creates it; Chief creates it; Johnson creates it and Chief fills it.
   - Recommended default: Johnson (or Chief with Johnson's approval) creates a new sheet titled exactly `AppFeed` with exactly the tabs, headers, and column order above. The app never creates or edits the sheet.
   - If unanswered: no AppFeed exists, so every room shows the unavailable state. Placeholder data is not restored.

3. **Who fills the rows in v1 and how.**
   - Options: manual entry (recommended for v1); a later step in the existing 房租帳單 bot (the plan's phase 3); formulas in AppFeed that pull from the main file.
   - Recommended default: manual entry of values only. **No formulas that reference the main rent file**, so the PII boundary stays visible and auditable.
   - If unanswered: manual, values-only entry. Formula cells are not specifically detected in v1; the recommendation is a human rule in the AppFeed checklist.

4. **Payment status source.**
   - Options: a hand-maintained `paid_on` column in AppFeed (recommended for v1); a later admin "mark paid" feature backed by a database.
   - Recommended default: `paid_on`. There is no payments store today and no Postgres yet.
   - If unanswered: `paid_on` remains the only payment-status source; no mark-paid UI is built.

5. **Freshness and stale-serving policy.**
   - Options: 15-minute revalidate (recommended); longer (for example 1 hour); an admin "refresh now" button; serve stale with a last-updated time vs show unavailable when a refresh fails.
   - Recommended default: `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`; serve the last successful cache entry and show its last-updated time while a transient refresh fails; after 1 hour without a successful refresh, show unavailable. No admin refresh button in v1.
   - If unanswered: the recommended default ships; the refresh button stays deferred.

6. **Error policy for a bad row.**
   - Options: fail closed for the whole room (recommended); skip the bad row and show the rest.
   - Recommended default: fail closed per room. Silently hiding a bill could make a tenant think nothing is owed; other rooms are unaffected.
   - If unanswered: fail closed per room.

7. **Placeholder data.**
   - Options: delete `lib/placeholder-data.ts` and its copy (recommended); keep it for local development behind an explicit dev-only switch.
   - Recommended default: delete it. A dev-only switch is easy to misconfigure and risks production fallback.
   - If unanswered: delete it and keep the unavailable state as the only failure state.

8. **Payment history depth and deposit.**
   - Options: most recent 12 paid periods (recommended); a different limit; show the deposit.
   - Recommended default: 12 most recent payments, newest first. Deposit is deliberately excluded from the schema and UI.
   - If unanswered: 12 payments, no deposit.

9. **Vercel Hobby non-commercial question (carried from the original plan).**
   - The original MVP recorded that Vercel Hobby is non-commercial only. This change does not resolve that question and does not depend on it technically.
   - If unanswered: treat the current deployment as a prototype and revisit the plan/commercial-use question before charging rent through the portal.

## Capabilities

### New Capabilities

- `appfeed-data-source`: AppFeed is the only dashboard data source; read-only Google service-account access; wrong-file guard; exact schema and strict validation; room-scoped caching; failure/empty states; no-PII guarantee.

### Modified Capabilities

- `room-dashboard`: the dashboard shows real AppFeed data scoped to the session's room; the placeholder-data requirement is removed and replaced by unavailable/empty-state behavior.
- `localization`: whole-NT$ formatting, new dashboard state copy, and removal of placeholder labels.
- `session-logout`: the header reference to the placeholder-data badge is removed; the logout control remains.
- `accessible-contrast`: the room-dashboard contrast scenario no longer refers to "(sample data)" captions; it refers to the last-updated caption and lease labels.

## Impact

- **New code:** `lib/appfeed/types.ts`, `lib/appfeed/validate.ts`, `lib/appfeed/google.ts`, `lib/appfeed/feed.ts`; tests under `tests/appfeed-*.test.ts`; `docs/appfeed-rules.md`.
- **Changed code:** `app/[lang]/rooms/[room]/page.tsx`, `lib/i18n/format.ts`, `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/zh-TW.ts`, `tests/room-page.test.ts`, `tests/i18n-format.test.ts`, `AGENTS.md`, `.env.example`.
- **Deleted code:** `lib/placeholder-data.ts` and the placeholder/sample-data dictionary keys.
- **New environment variables:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `APPFEED_SPREADSHEET_ID`. All server-only, never `NEXT_PUBLIC_`, never committed, marked sensitive in Vercel.
- **Dependencies:** none. `jose` is already installed; `fetch` is built in; `server-only` is handled by Next.js.
- **Data/storage:** no database, no Postgres, no new Upstash keys. AppFeed is the only new external system. The existing Upstash Redis remains auth/rate-limit/session-version storage only.
- **Privacy:** the main rent file is never shared with the service account and is never referenced by the app's code, env, or URLs. AppFeed contains no free-text fields.
- **Operations:** Johnson must create the sheet, create the service account, share only AppFeed as Viewer, and add the env vars later. Until then, the app fails closed.
