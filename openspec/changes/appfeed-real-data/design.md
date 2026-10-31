# Design

## Context

See `proposal.md` for motivation and the canonical AppFeed schema. Current state that shapes the approach:

- `app/[lang]/rooms/[room]/page.tsx` is a Server Component. It parses the URL room, reads `getSessionClaims()`, requires `claims.role === "tenant"` and `claims.room === room`, and compares the claim's `v` against the Redis session version. On success it renders `PLACEHOLDER_ROOM_DATA[room]`.
- `next.config.ts` enables `cacheComponents: true` and `partialPrefetching: true`. The room page sets `export const instant = false`, so it blocks on the server and streams no partial shell today.
- Hosting is Vercel Hobby. Storage is Upstash Redis only (auth codes, session versions, rate limits). There is no Postgres and no payments store.
- `lib/rooms.ts` already exposes `ROOM_LETTERS`, `RoomLetter`, `isRoomLetter()`, and `parseRoomLetter()`. `lib/i18n/format.ts` exposes `formatTwd(amountCents, locale)` and `formatDate(isoDate, locale)`.
- `jose` is already a dependency. No Google client library is installed.
- The AppFeed spreadsheet does not exist yet. The app must fail closed until Johnson creates and shares it.

Next.js 16 behavior used here, read from the bundled docs before designing:

- `cacheComponents` makes data dynamic by default and enables `use cache`, `cacheLife`, and `cacheTag` (`03-api-reference/05-config/01-next-config-js/cacheComponents.md`).
- A plain `use cache` scope cannot read `cookies()` or `headers()`; runtime values must be read outside and passed as arguments, and arguments become part of the cache key (`04-functions/use-cache.md`, `02-guides/authentication-with-cache-components.md`).
- `cacheLife({ stale, revalidate, expire })` controls client stale time, background revalidation, and the maximum stale window (`04-functions/cacheLife.md`).
- On serverless, the default `use cache` handler is in-memory and best effort: entries may not persist across requests or instances. `use cache: remote` or a `cacheHandlers` implementation is the durable option (`04-functions/use-cache.md`, `01-directives/use-cache-remote.md`).
- `revalidateTag` now takes a profile, for example `revalidateTag(tag, "max")`; `updateTag` is for read-your-own-writes in Server Actions (`04-functions/revalidateTag.md`, `04-functions/cacheTag.md`).
- `server-only` is handled by Next.js; importing it in a module makes a client import a build error (`02-guides/data-security.md`, `01-getting-started/05-server-and-client-components.md`).

## Goals / Non-Goals

**Goals:**

- One server-side data path from a read-only Google Sheet to a narrow, room-filtered projection.
- Fail-closed behavior at every layer: wrong file, wrong tabs, wrong headers, bad rows, missing credentials, Google outage.
- Cache only per-room, already-filtered data, with a predictable freshness window.
- No tenant PII anywhere in the feed, cache, logs, fixtures, or rendered output.
- A dashboard that is honest about unavailable, empty, and stale data.

**Non-Goals:**

- Creating, editing, or migrating the AppFeed sheet. That is a Johnson-owned prerequisite.
- A Postgres schema, a payments table, an admin "mark paid" feature, or an admin feed editor.
- An admin "refresh now" button in v1 (described as an open decision).
- A published-CSV fallback in code. The design documents it only as an option Johnson can choose.
- Deposit tracking, receipts, PDF bills, notifications, or multi-landlord support.
- Deploying or setting production env vars as part of this change.

## Decisions

### 1. Google authentication: service account + `jose` + Sheets REST

Use a Google Cloud service account with the `https://www.googleapis.com/auth/spreadsheets.readonly` scope. Only AppFeed is shared with the service-account email as Viewer. Credentials live in three server-only env vars:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `APPFEED_SPREADSHEET_ID`

No `NEXT_PUBLIC_` prefix. No credential in the repo, a client bundle, a URL, a log line, an error message, or a test fixture.

**Token flow** (`lib/appfeed/google.ts`):

1. Read the three env vars. If any is missing or blank, return `{ kind: "unavailable", reason: "config", transient: false }`.
2. Normalize the private key: `process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").trim()`. Vercel preserves real newlines; this also accepts a single-line value with literal `\n`.
3. Sign a JWT with `jose`:
   - `alg: "RS256"`, `typ: "JWT"`
   - `iss` = service-account email
   - `scope` = `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `aud` = `https://oauth2.googleapis.com/token`
   - `iat` = now, `exp` = now + 3600 seconds
4. POST the assertion to `https://oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`. Parse `access_token` and `expires_in`.
5. Keep the token in a module-level `{ token, expiresAt }` value and reuse it until 60 seconds before expiry. It is process memory only, never persisted, never logged.
6. Create one `AbortSignal.timeout(8000)` deadline per snapshot and pass it to every Google request, so the whole token + metadata + values sequence is bounded to 8 seconds. Every `fetch` also uses `redirect: "error"` and `cache: "no-store"`. `cache: "no-store"` avoids a second, unintended fetch cache inside the `use cache` scope.

**Why `jose` + `fetch` instead of `googleapis`:** `jose` already signs the app's session cookie, so the service-account assertion uses an audited, installed library. The Sheets REST calls are two GETs; `googleapis` adds a large dependency, its own auth stack, and a second token cache for no benefit. A hand-written JWT is a small, testable surface.

**Why not other options:**

- **Published CSV (fallback only):** no Google Cloud setup and no secrets, but the URL is public to anyone who has it, cannot be scoped per room, exposes every room's amounts, can leak through logs/referrers/browser history, and is revoked only by unpublishing and re-publishing (a new URL). Google also caches published output for a few minutes. Use only if Johnson explicitly refuses a service account.
- **API key on a link-shared sheet:** a link-shared sheet is public to anyone with the link, and an API key identifies the project, not a user. Rejected.
- **OAuth with Johnson's own Google account:** the refresh token can expire, the grant covers his whole Drive, and it couples the app to a personal login. Rejected.
- **Apps Script web app:** another deployed service, another credential, and another failure mode. Rejected.

**Scope caveat (important):** the OAuth scope is account-wide, not file-scoped. Isolation comes from **sharing only AppFeed** with the service account. If the service account were also shared the main rent file, the app could read it if given its ID. The design therefore treats "never share the main file with the service account" as a hard operational rule, adds the wrong-file guard below, and repeats the rule in `docs/appfeed-rules.md`.

**Key handling and rotation:** the service-account key is long-lived (no automatic expiry). Rotate by creating a new key in Google Cloud, updating `GOOGLE_PRIVATE_KEY` in Vercel as a sensitive value, redeploying, verifying, then deleting the old key. A leaked key must be revoked immediately. The app never logs the key, the token, the spreadsheet ID, or Google's error body.

### 2. Wrong-file guard, fixed ranges, and header allow-list

The client performs three calls in this exact order:

1. **Token** (unless a cached token is still valid).
2. **Metadata:** `GET https://sheets.googleapis.com/v4/spreadsheets/{id}?fields=properties.title,sheets.properties.title`.
   - Refuse unless `properties.title === "AppFeed"` (exact).
   - Refuse unless the tab title set is exactly `{"Bills", "Leases"}`. Hidden tabs count; an extra tab such as `現住戶資料` fails. Missing either tab fails.
   - This call returns no cell values. It runs **before** the values call, and a test asserts the call order.
3. **Values:** `GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values:batchGet?ranges=Bills!A:G&ranges=Leases!A:D&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`.
   - Only these two fixed ranges are requested. Extra columns (H onward) are never fetched.
   - Verify the response has exactly two `valueRanges`, in order, with ranges beginning `Bills!` and `Leases!`.
   - Validate row 1 against the exact header allow-lists before interpreting any data row.
   - `UNFORMATTED_VALUE` avoids display formats and locale surprises. Because a real Google date comes back as a serial number, the AppFeed rules require plain-text ISO dates; a serial number fails the date regex and is rejected rather than guessed.

The guard makes an accidental paste of the main file's ID (or a copy with tabs such as `現住戶資料`) fail closed even if the service account somehow has access. It does not defend against a deliberate copy renamed `AppFeed` with exactly `Bills`/`Leases`; the no-free-text schema and strict parsers still prevent names/phones/emails from being displayed.

### 3. Schema projection, whole-NT$ amounts, and ordering

New files:

- `lib/appfeed/types.ts` - exported public types and internal snapshot types.
- `lib/appfeed/validate.ts` - pure header/row validation and `buildRoomFeed()`.
- `lib/appfeed/google.ts` - credentials, JWT, token cache, metadata guard, values fetch.
- `lib/appfeed/feed.ts` - `server-only` cached `getRoomFeed(room)`.

Public projection:

```ts
export type FeedBill = {
  period: string;          // YYYY-MM
  rent: number;            // whole NT$
  water: number | null;    // null = blank = no charge
  electricity: number | null;
  total: number;           // rent + water + electricity
  dueDate: string;         // YYYY-MM-DD
};

export type FeedPayment = {
  period: string;
  amount: number;          // rent + water + electricity for the paid row
  receivedOn: string;      // paid_on
};

export type FeedLease = {
  start: string;
  end: string;
  renewalDue: string | null;
};

export type RoomFeed = {
  room: RoomLetter;
  openBills: FeedBill[];
  payments: FeedPayment[];
  lease: FeedLease | null;
  fetchedAt: string;       // ISO timestamp of the successful read
};

export type FeedResult =
  | { kind: "ok"; feed: RoomFeed }
  | { kind: "unavailable" };
```

**Amounts:** whole NT$ integers, not cents. Taiwan dollars have no cents, and the source sheet stores whole amounts. `formatTwd` changes from `amountCents / 100` to formatting the value directly with `minimumFractionDigits: 0, maximumFractionDigits: 0`. The type is `number`, validated by `^\d{1,7}$` (maximum 9,999,999). Negative values, decimals, commas, and currency symbols are invalid.

**Payment history:** a Bills row with `paid_on` set is a payment. Its amount is `rent + (water ?? 0) + (electricity ?? 0)`; the UI shows the period and the received date, not a guessed label. Sort by `paid_on` descending, then `period` descending; keep the first 12.

**Open bills:** Bills rows with blank `paid_on`. Sort by `due_date` ascending, then `period` ascending. No limit.

**Lease:** the one Leases row for the room, or `null` if absent. `renewal_due` blank becomes `null`.

`buildRoomFeed(snapshot, room, fetchedAt)` is a pure function. It validates every row once, then projects only the requested room. It never returns raw rows. `fetchedAt` is the time of the successful snapshot, so it remains the last-updated time when the cache later serves stale data.

### 4. Validation and fail-closed policy

Exact checks:

- Room: `String(cell).trim().toUpperCase()` must be one of `A`-`E`. A row whose room does not match is **unattributable**: dropped and counted, and it does not affect any room. A lowercase or padded valid room is accepted.
- Period: `^\d{4}-(0[1-9]|1[0-2])$`.
- Amounts: `^\d{1,7}$` after trim. `rent` required; `water`/`electricity` blank allowed. `0` is valid. No `$`, `,`, `NT$`, Chinese numerals, or minus sign.
- Dates: `^\d{4}-\d{2}-\d{2}$` and a real calendar check. Implement with `Date` + `setUTCFullYear` so years below 100 are not remapped by `Date.UTC`'s 1900 offset. `2024-02-29` is valid; `2026-02-30`, `2026-13-01`, and `2026-04-31` are invalid.
- Lease order: `lease_end >= lease_start` (ISO strings compare correctly after validation, or compare parsed timestamps).
- Uniqueness: duplicate `(room, period)` in Bills and duplicate `room` in Leases are invalid.
- Empty rows: a row whose cells all trim to `""` is ignored. A row with one blank optional cell is not empty.
- Header mismatch, missing range, wrong range order, or a row with more cells than the range allows: the whole feed is unavailable.

**Policy:** if any row attributed to room X fails, room X's result is `{ kind: "unavailable" }`; no partial list is shown. Other rooms are unaffected because validation is per row and projection is per room. Rows with an invalid room cell are counted but not attributed. This is deliberately fail-closed: silently hiding a bill could make a tenant think nothing is owed.

**Alternative considered:** skip bad rows and show the rest. Rejected as the default because it hides a possibly owed bill. It remains open decision #6.

### 5. Server-only, room-scoped access

`lib/appfeed/feed.ts` starts with `import "server-only"`. It exports `getRoomFeed(room: RoomLetter): Promise<FeedResult>` and `AppFeedUnavailableError`. It does not export the snapshot or the raw rows.

```ts
export async function getRoomFeed(room: RoomLetter): Promise<FeedResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(`appfeed:room:${room}`);

  if (!isRoomLetter(room)) throw new AppFeedUnavailableError();

  const snapshot = await fetchAppFeedSnapshot();
  if (snapshot.kind === "unavailable") {
    if (snapshot.transient) throw new AppFeedUnavailableError();
    return { kind: "unavailable" };
  }

  return buildRoomFeed(snapshot, room, new Date().toISOString());
}
```

**Room source:** the page calls `getRoomFeed(claims.room)`, not `params.room`. By that point the page has already checked `claims.role === "tenant"`, `claims.room === room`, and the Redis session version. The URL room is only used for that check and for metadata. The cached function cannot read cookies, so the room cannot be influenced by a request body, header, or query string.

**No client path:** there is no API route, route handler, Server Action, or client component that returns feed data. The page is a Server Component and passes only the narrow projection into JSX. `lib/appfeed/feed.ts` and `lib/appfeed/google.ts` are server-only; a client import fails the build. A static test also scans `app/**` for `"use client"` files importing the feed modules.

**Whole-sheet isolation:** each call fetches the sheet, filters on the server, and returns only the room's projection. The raw snapshot exists only in the function's local scope; it is never a cache value, a component prop, or a serialized response. There is deliberately no shared "all rooms snapshot" cache, because that would put other rooms' rows in one cache entry.

### 6. Caching, freshness, and stale-serving

`cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`:

- `stale: 300` - the client router may reuse the entry for 5 minutes without checking the server (Next enforces a 30-second minimum).
- `revalidate: 900` - after 15 minutes, the next request serves the entry and triggers a background refresh.
- `expire: 3600` - after 1 hour without a successful refresh, the next request must wait for a fresh read; if that fails, the page shows unavailable.

**Why 15 minutes:** rent data changes at most monthly; utility rows and `paid_on` change occasionally. The Sheets API quota is 300 reads per minute per project. A full refresh is metadata + values = 2 reads per room, so 5 rooms = 10 reads; even refreshing every minute would use about 3% of the quota. A 15-minute window is far below the quota and keeps tenants from waiting on Google for routine views. Longer windows would make a `paid_on` update feel stale; shorter windows add latency without a benefit.

**What tenants see in between:** on a warm cache, the last successful values and their `fetchedAt` timestamp. After 15 minutes they still see those values while Next refreshes in the background; the next request sees the new values. On a cold instance (Vercel serverless memory is ephemeral), they wait for the read, up to the 8-second timeout, then see the values or the unavailable state. Because the page keeps `export const instant = false`, it blocks on the server rather than streaming a partial shell.

**Vercel serverless caveat:** a plain `use cache` entry is in-memory and best effort. The 15-minute revalidate is a per-instance upper bound, not a global guarantee; different instances may each read Google. At 5 rooms and 10 reads per refresh this is still negligible against the quota. If Johnson later wants shared cache hits and lower latency, the upgrade path is a `cacheHandlers` implementation backed by Upstash Redis or `use cache: remote`; neither is in v1 because it adds a cache format/cost and Upstash is not a Next cache handler. This is a deliberate simplicity trade-off, not a quota necessity.

**Failure classes:**

| Failure | Classification | Result |
| --- | --- | --- |
| Missing/blank env vars | structural | `{ kind: "unavailable" }`, replaces cache |
| Token 400/401/403 (bad key, revoked share) | structural | unavailable, replaces cache |
| Metadata/values 401/403 | structural | unavailable, replaces cache |
| Wrong title, extra/missing tab | structural | unavailable, replaces cache |
| Header mismatch | structural | unavailable, replaces cache |
| Invalid row for this room | structural | unavailable, replaces cache |
| 429, 5xx, network error, 8-second timeout | transient | throw `AppFeedUnavailableError`; Next serves a stale entry until `expire`; if none, the page catches and shows unavailable |

**Stale-serving recommendation:** serve the last successful entry for up to 1 hour and show its `fetchedAt` as "last updated"; after that, unavailable. This is better than a blank dashboard for a transient Google blip, and the visible timestamp prevents the stale value from pretending to be current. The page catches any thrown `AppFeedUnavailableError` and renders the generic unavailable state when there is no stale entry. This relies on Next's stale-while-revalidate behavior; the preview verification task checks it. If Next surfaces the error instead, the page still fails closed. Open decision #5.

**Admin refresh (not v1):** if added later, a small admin form can call a Server Action guarded by `isAdminSession()` that calls `updateTag("appfeed:room:a")` through `appfeed:room:e` (or `revalidateTag(tag, "max")` for stale-while-revalidate). `updateTag` is only available in Server Actions and gives read-your-own-writes. No route handler is added. Open decision #5.

**No client fetching:** the sheet is never fetched in the browser, never exposed through `NEXT_PUBLIC_`, and never passed to a client component.

### 7. Dashboard states, copy, and formatting

The page keeps its existing header, locale switcher, logout control, and `instant = false`. The amber placeholder badge and the three "(sample data)" captions are removed. The header gains a last-updated caption:

```
Last updated {date}   /   最後更新 {date}
```

Rendering rules:

- `result.kind === "unavailable"` or a caught error: render one generic white card with `room.unavailableHeading` and `room.unavailableMessage`; do not render bills, payments, or lease sections. Copy (zh-TW): 「資料暫時無法取得」/「請聯絡房東。」. Copy (en): "Data temporarily unavailable" / "Please contact the landlord." No raw error text.
- `result.kind === "ok"`:
  - Bills section: if `openBills.length === 0`, show `room.emptyBills`; otherwise list each bill with period, total, due date, open status, and a breakdown of rent/water/electricity (skip `null` components; show `0` as a real value).
  - Payments section: if `payments.length === 0`, show `room.emptyPayments`; otherwise list each payment with period, amount, and received date. The data layer already limits to 12 and sorts newest first.
  - Lease section: if `lease === null`, show `room.emptyLease`; otherwise show start, end, and renewal (show `room.notAvailable` when `renewalDue` is null).

State table:

| State | Trigger | What the tenant sees | Copy keys |
| --- | --- | --- | --- |
| Feed unavailable | Missing config, 401/403, wrong title/tabs, header mismatch, or a transient failure with no/expired cache | Header plus one generic card; no data sections | `room.unavailableHeading` + `room.unavailableMessage` |
| Room unavailable | Any invalid row attributed to the tenant's room | Same generic card | Same as feed unavailable |
| Stale served | 429/5xx/timeout/network with a cache entry younger than 1 hour | Normal sections plus the last-updated caption | `room.lastUpdatedTemplate` |
| No bills | Zero open Bills rows | Bills section shows the empty copy | `room.emptyBills` |
| No payments | Zero paid Bills rows | Payments section shows the empty copy | `room.emptyPayments` |
| No lease | No Leases row | Lease section shows the empty copy; bills/payments still render | `room.emptyLease` |
| No renewal date | Lease present, `renewal_due` blank | Lease start/end plus a not-available renewal value | `room.notAvailable` |
| Normal | Valid data | Open bills, payments, lease, last updated | `room.*` labels |

Exact copy:

| Key | `zh-TW` | `en` |
| --- | --- | --- |
| `room.lastUpdatedTemplate` | `最後更新 {date}` | `Last updated {date}` |
| `room.unavailableHeading` | `資料暫時無法取得` | `Data temporarily unavailable` |
| `room.unavailableMessage` | `請聯絡房東。` | `Please contact the landlord.` |
| `room.emptyBills` | `尚無帳單。` | `No bills yet.` |
| `room.emptyPayments` | `尚無付款紀錄。` | `No payments recorded yet.` |
| `room.emptyLease` | `租約日期尚無法取得。` | `Lease dates are not available.` |
| `room.notAvailable` | `尚無資料` | `Not available` |
| `room.period` | `期別` | `Period` |
| `room.rent` | `租金` | `Rent` |
| `room.water` | `水費` | `Water` |
| `room.electricity` | `電費` | `Electricity` |
| `room.total` | `合計` | `Total` |

New dictionary keys (both locales):

```ts
room: {
  headingTemplate, bills, payments, leaseDates,
  due, received, period,
  status: { open, paid },
  rent, water, electricity, total,
  lastUpdatedTemplate,       // "{date}" placeholder
  unavailableHeading, unavailableMessage,
  emptyBills, emptyPayments, emptyLease, notAvailable,
  leaseStart, leaseEnd, renewalDue
}
```

Removed: `room.placeholderBadge`, `room.sampleDataCaption`, `room.labels`, and the unused `common.sampleData`. The dictionaries keep identical key structure in `zh-TW` and `en`; `tests/i18n-dictionaries.test.ts` enforces parity.

`lib/i18n/format.ts`:

- `formatTwd(amountDollars, locale)` uses `Intl.NumberFormat(locale, { style: "currency", currency: "TWD", minimumFractionDigits: 0, maximumFractionDigits: 0 })`. `750` -> `NT$750` in `en`, `$750` in `zh-TW`.
- `formatDateTime(isoTimestamp, locale)` uses `Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" })`. A timestamp of `2026-11-01T04:00:00.000Z` -> `Nov 1, 2026, 12:00 PM` in `en`, `2026年11月1日 中午12:00` in `zh-TW`.

Contrast: the last-updated caption uses `text-xs text-slate-700` on the slate-100 page (9.45:1); breakdown labels use `text-xs text-slate-700` on white (10.35:1); values stay `text-slate-900`. `tests/contrast.test.ts` is updated for the removed captions and the new caption/labels.

### 8. Logging and observability

- Log only a fixed reason code, tab name, row numbers, and counts: for example `console.warn("[appfeed] room unavailable", { room: "a", invalidBillsRows: 1, invalidLeasesRows: 0 })`.
- Never log cell values, raw Google response bodies, `APPFEED_SPREADSHEET_ID`, the token, the private key, or the service-account email.
- HTTP status classes are logged as `auth`, `quota`, `server`, `timeout`, `network`, `config`, `wrong-file`, or `headers`; never the response body.
- The page never renders a thrown error's message.

### 9. No-PII guarantee (layers and limits)

Layered mechanisms:

1. **Separate file:** AppFeed is a different spreadsheet, and the service account is shared only with AppFeed as Viewer. The main rent file is never shared.
2. **Wrong-file guard:** the metadata check requires the exact title `AppFeed` and the exact tab set `{Bills, Leases}` before any cell is read.
3. **Fixed ranges and allow-list:** only `Bills!A:G` and `Leases!A:D` are fetched, and row 1 must equal the exact header lists. Extra columns are never fetched.
4. **Strict typed parsers:** there is no free-text column. A name, phone, email, ID number, or address in `room`, `period`, an amount, or a date fails the regex and makes that room unavailable; an invalid `room` cell is unattributable and dropped.
5. **Narrow projection:** the cached value and the page props contain only period, amounts, dates, room letter, and `fetchedAt`. Raw rows and the whole-sheet snapshot never leave the accessor's local scope.
6. **Safe logs:** only fixed reasons, tab names, row numbers, and counts. No cell contents, IDs, tokens, keys, or Google response bodies.
7. **Synthetic fixtures:** tests use invented sentinel values and PII-pattern strings, never real tenant data.
8. **No main-file references:** no environment variable, code constant, request URL, or log line contains the main file's ID, name, or link.

What the guarantee does **not** cover:

- A person with edit access to AppFeed can type PII into an unused column. It is never fetched because the ranges are fixed.
- A new tab is refused by the wrong-file guard.
- A name typed into a used schema cell is either unattributable (`room`) or rejected by the typed regex (`period`, amount, date). No schema column is displayed as free text, so it cannot render as a name or phone number.
- A deliberate copy renamed `AppFeed` with exactly `Bills`/`Leases` cannot be distinguished by the guard. The typed parsers still prevent free-text display, but an editor who can write allowed values could encode data into allowed fields. That is outside the accidental-PII/main-file threat model.
- Google Drive access, Vercel access, and the editor's own devices are outside the app's control.

**AppFeed rules (for Johnson, to keep next to the sheet):**

- Keep the file title exactly `AppFeed` and exactly two tabs: `Bills` and `Leases`. Remove extra tabs, including hidden ones.
- Keep the header row exactly as specified. Do not rename, reorder, or insert columns.
- Store `room`, `period`, and every date as plain text. Use `YYYY-MM` for periods and `YYYY-MM-DD` for dates.
- Store whole NT$ integers only. No `$`, commas, decimals, negative numbers, or Chinese date text.
- Blank water or electricity means no charge; `0` means a real zero charge.
- Use one Bills row per room per billing period and one Leases row per room.
- Leave `paid_on` blank until payment is received, then enter the received date.
- Do not use formulas that pull from the main rent file. Enter values only.
- Do not add names, phone numbers, emails, ID numbers, addresses, LINE IDs, notes, or deposit columns.
- Share only AppFeed with the service-account email as Viewer. Never share the main rent file or a copy of it.
- If a room shows unavailable, check that room's rows against this list. Other rooms are unaffected.

The human checklist is maintained in `docs/appfeed-rules.md` (task 6.3).

### 10. Test strategy

Follow the existing Vitest pattern (`vi.hoisted` + `vi.mock`, see `tests/login-action.test.ts`):

- `tests/appfeed-validate.test.ts`: header mismatch; every regex; `2026-02-30` and leap day; negative/formatted/`#DIV/0!` amounts; blank vs `0`; duplicate `(room, period)`; `lease_end < lease_start`; duplicate lease; empty rows; lowercase/padded room; invalid room dropped; fail-closed per room; PII-like values in every column.
- `tests/appfeed-google.test.ts`: mock `global.fetch`; generate an RS256 key pair with `jose` in the test; assert the JWT `scope`, `aud`, `iss`, `iat`, `exp`; assert metadata is called before values; assert only `Bills!A:G` and `Leases!A:D`; wrong title, extra tab, missing tab; 401/403/429/500/timeout/network maps to the typed unavailable result; missing env; the spreadsheet ID never appears in a result or thrown message.
- `tests/appfeed-feed.test.ts`: mock `@/lib/appfeed/google` and `next/cache`; sentinel values for rooms A-E; assert room A's serialized result contains only A's sentinels; repeat for each room; assert transient failures throw `AppFeedUnavailableError` and structural failures return `{ kind: "unavailable" }`; assert `getRoomFeed("f" as RoomLetter)` throws; static assert that no export returns the snapshot.
- `tests/room-page.test.ts`: mock `@/lib/appfeed/feed`; rooms A and B; normal, empty, room-unavailable, feed-unavailable (rejected promise), missing lease; zh-TW and en copy; assert no placeholder/sample text.
- `tests/appfeed-boundary.test.ts`: static checks that no `"use client"` file imports `@/lib/appfeed/feed`, `@/lib/appfeed/google`, or `@/lib/appfeed/validate`; no `NEXT_PUBLIC_` variable contains `GOOGLE_` or `APPFEED_`; `lib/placeholder-data.ts` does not exist and is not imported; `feed.ts` and `google.ts` contain `import "server-only"`; no route handler imports appfeed; no `spreadsheets/d/` URL appears in source.
- Update `tests/i18n-format.test.ts`, `tests/i18n-dictionaries.test.ts`, and `tests/contrast.test.ts`.
- Run `npx tsc --noEmit`, `npm test`, and `npm run build`.

### 11. Migration and rollout

No database, cookie, or Redis migration. The change is code plus a new external sheet. Rollout order:

1. Johnson creates AppFeed and shares it with the service account (manual prerequisite).
2. Code and tests land with no production env vars; the dashboard shows unavailable, never placeholders.
3. Johnson adds the three sensitive Vercel env vars on request and deploys.
4. Verify each room against the sheet; verify a malformed row in a copy only affects that room; verify unsharing gives the generic state.
5. Rollback is redeploying the previous build. The old build still uses placeholder data, so rollback must be paired with the explicit understanding that placeholders return; if that is unacceptable, roll forward with the fix instead.

## Risks / Trade-offs

- **Service-account scope is account-wide** → Isolate by sharing only AppFeed. The wrong-file guard catches an accidental wrong ID or a copy with the main file's tabs. Document the sharing rule in `docs/appfeed-rules.md`.
- **Serverless `use cache` is best effort** → Sheets reads may happen more often than every 15 minutes on cold instances. At 5 rooms and 10 reads per refresh, quota is not a concern; latency is acceptable. Upgrade path is a Redis-backed cache handler, not a v1 requirement.
- **Stale data during an outage** → Serve stale for up to 1 hour with a visible last-updated time; after that, unavailable. If Johnson prefers strict freshness, set `expire` closer to `revalidate` (open decision #5).
- **Real Google dates become serial numbers** → Require plain-text ISO dates in AppFeed and reject anything else. This is fail-closed and documented in the sheet rules.
- **A bad row hides the whole room** → Deliberate fail-closed policy to avoid hiding a bill. The landlord fixes the row; other rooms are unaffected. Alternative skip-bad-rows policy is open decision #6.
- **No admin refresh in v1** → A corrected row can take up to 15 minutes (and a cold instance may read immediately). Acceptable for monthly rent data; open decision #5.
- **Rollback restores placeholders** → The previous build still renders placeholder data. Prefer roll-forward once AppFeed is live; if rollback is required, treat the placeholder dashboard as a known temporary state.
- **Vercel Hobby is non-commercial** → Carried from the original plan, not resolved here (open decision #9). The technical design does not depend on the plan tier.

## Open Questions

These are the proposal's open decisions, repeated with the recommended defaults. None block the code tasks except the sheet itself, which is a manual prerequisite.

1. **Auth method:** service account (recommended) vs published CSV. Default: service account; deploy blocked until it exists.
2. **Who creates/approves AppFeed:** Johnson or Chief with Johnson's approval. Default: Johnson creates the exact two-tab schema; no app-side sheet creation.
3. **Who fills rows in v1:** manual values only (recommended) vs a later bot phase vs formulas pulling from the main file. Default: manual, values only, no main-file formulas.
4. **Payment status source:** hand-maintained `paid_on` (recommended for v1) vs a later database-backed mark-paid feature. Default: `paid_on`.
5. **Freshness/stale/admin refresh:** 15 minutes, serve stale up to 1 hour with last-updated (recommended), no admin refresh in v1. Default: this design.
6. **Bad-row policy:** fail closed per room (recommended) vs skip bad rows. Default: fail closed.
7. **Placeholder data:** delete it (recommended) vs a production-impossible dev switch. Default: delete.
8. **History depth/deposit:** 12 recent payments and no deposit (recommended). Default: this design.
9. **Vercel Hobby non-commercial question:** unresolved from the original plan; not a technical dependency of this change.
