# Design

## Context

See `proposal.md` for the motivation. The current system already reads lease rows from `AppFeed` in `lib/appfeed/validate.ts`. The tenant dashboard receives a room-scoped `RoomFeed` with `lease.start`, `lease.end`, and `lease.renewalDue`. The admin console has no lease accessor; it reads pending claims and repairs through separate server-only functions. The existing `fetchAppFeedSnapshot()` reads both `Bills!A:Q` and `Leases!A:D` in one call.

The shared date helper `todayInTaipei()` already returns an ISO date for the portal's time zone. The existing RFC 3339 timestamps and ISO date strings make lexicographic date comparison safe after validation.

## Goals / Non-Goals

**Goals:**

- One shared definition of the 60-day window for both views.
- Tenant reminder from the existing room feed, with no extra Sheets read.
- Admin reminder from a narrow, admin-only accessor that reuses the existing fixed snapshot read.
- Localized, server-rendered banner that works without client-side JavaScript.
- No new writes, columns, ranges, environment variables, routes, or dependencies.

**Non-Goals:**

- Tracking whether a renewal was completed.
- Sending email, SMS, or push notifications.
- Dismissing or snoozing a reminder.
- Changing the lease schema or adding a renewal status column.
- Changing the existing lease facts, bills, payments, claims, or repairs behavior.

## Decisions

### 1. Compare ISO dates by whole calendar days

Add a small helper that turns a validated `YYYY-MM-DD` value into a day number:

```ts
function isoDayNumber(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / 86_400_000);
}
```

A lease is due when `0 <= isoDayNumber(leaseEnd) - isoDayNumber(today) <= 60`.

Rationale: ISO dates have no time or zone. UTC day numbers give exact whole-day differences and avoid local-time or daylight-saving errors. `setUTCFullYear` avoids the `Date.UTC` year 0–99 remapping that `isRealIsoDate()` already guards against. The caller supplies today from `todayInTaipei()`.

Alternative considered: compare `leaseEnd` and a computed cutoff string with `<=`. This also works, but a day-number helper makes the inclusive boundary easy to test and reuse for both views.

### 2. Tenant reminder uses the existing room feed

`app/[lang]/rooms/[room]/page.tsx` already calls `getRoomFeed(claims.room)`. When `feed.lease` is not null, the page calls the window helper with `feed.lease.end` and `todayInTaipei()`. It passes the result to the shared banner.

Rationale: the feed is already room-scoped, validated, cached, and unavailable-safe. A second read would add cost and a second failure path. The page already hides lease facts when the feed is unavailable, so the banner follows the same rule.

Alternative considered: a new tenant accessor. Rejected because it duplicates an existing projection and would need its own cache and invalidation.

### 3. Admin reminder uses a new fresh accessor

Add the types to `lib/appfeed/types.ts`:

```ts
export type LeaseRenewal = { room: RoomLetter; end: string };

export type AdminLeaseRenewalsResult =
  | { kind: "ok"; renewals: LeaseRenewal[] }
  | { kind: "denied" }
  | { kind: "unavailable" };
```

Add `lib/appfeed/renewal.ts` with `import "server-only"` and:

```ts
export async function listLeaseRenewals(): Promise<AdminLeaseRenewalsResult>;
```

The accessor:

1. Calls `isAdminSession()` and returns `denied` before any Sheets call.
2. Calls `fetchAppFeedSnapshot()`. This is the existing fixed pair of `Bills!A:Q` and `Leases!A:D`, so the change adds no range.
3. Calls `buildLeaseRenewals(snapshot, todayInTaipei())`.
4. Returns only `{ room, end }` entries.

A `Bills` header mismatch or an over-wide `Bills` row makes the shared snapshot unavailable, so the admin banner shows the unavailable notice even when every lease row is valid. The design accepts this cost because the alternative is a second Google read path.

It reads fresh on each admin page load, like `listPendingClaims()` and `listPendingRepairs()`.

Rationale: the admin console is cross-room and cannot use the per-room cache. A fresh read keeps the window edge correct. Admin traffic is low.

Alternative considered: `use cache` with a tag. Rejected because a stale entry could hide or show a reminder on the boundary day, and the admin console already reads fresh claim and repair lists.

### 4. Build the reminder list in the validator

Add `buildLeaseRenewals(snapshot, today)` to `lib/appfeed/validate.ts`, next to `buildPendingClaims()` and `buildPendingRepairs()`. It reuses the private `validateSnapshot()` result.

The builder:

- Returns `null` when the snapshot shape or headers are invalid.
- Returns `null` when any room has at least one invalid `Leases` row, so the admin never sees a partial list. Use the per-tab counts already returned by `validateSnapshot()`:

```ts
const hasInvalidLease = [...validation.invalidRooms.values()].some(
  (counts) => counts.leases > 0,
);
```

- Ignores a room that has only invalid `Bills` rows. Its lease data is still trustworthy, and the reminder must not disappear because of a bill error.
- Ignores unattributable rows, matching the existing validation rules.
- Filters valid leases by the window.
- Sorts by `end` ascending, then `room` ascending.
- Projects only `{ room, end }`.

A `Bills` header mismatch or an over-wide `Bills` row still returns `null` because `validateSnapshot()` rejects the whole snapshot. The admin page shows the unavailable notice in that case.

Rationale: the validator already owns lease validation and fail-closed behavior. Keeping the projection there prevents a second interpretation of the sheet.

Alternative considered: omit only the invalid room. Rejected because the admin could miss the room that most needs attention.

### 5. One shared banner component

Add `app/[lang]/renewal-banner.tsx` as a server component:

```ts
type RenewalBannerProps = {
  locale: Locale;
  dictionary: Dictionary;
  renewals: LeaseRenewal[];
  variant: "tenant" | "admin";
};
```

- `tenant` renders `dictionary.renewal.tenantHeading`, the message with the lease end date, and no room list.
- `admin` renders `dictionary.renewal.adminHeading`, the caption, and a list of `dictionary.common.room` plus `dictionary.room.leaseEnd` for each entry.
- Both variants use a `<section>` with `aria-labelledby` and a stable heading ID.
- The banner uses the existing amber panel treatment: `border-amber-800`, `bg-amber-950/40`, `text-amber-200`. The border is decorative; the text meets the existing contrast budget.
- Dates use `formatDate(renewal.end, locale)`.
- Each admin row uses `flex flex-wrap gap-x-2 gap-y-1` and `min-w-0 break-words`. No fixed width and no `whitespace-nowrap` class. At 390 pixels, each line wraps inside the content width.

The admin page renders the banner after its `<header>` and before the card grid. The tenant page renders it inside its `<header>`, after the room title row and before the latest-update line and lease facts.

Alternative considered: separate tenant and admin components. Rejected because the visual treatment, contrast rules, and localization are the same; a `variant` prop keeps one source of truth.

### 6. Add shared dictionary keys

Add a top-level `renewal` block to `Dictionary`:

```ts
renewal: {
  tenantHeading: string;
  tenantMessageTemplate: string; // {date}
  adminHeading: string;
  adminCaption: string;
  unavailable: string;
};
```

The admin list reuses `common.room` and `room.leaseEnd`. The tenant message uses `{date}` and the existing `formatDate()` helper.

Rationale: both views share the reminder concept, and a top-level block avoids duplicating copy under `room` and `admin`.

### 7. Empty and unavailable states

- Tenant with no lease or no reminder: render nothing. The existing missing-lease copy and lease facts remain unchanged.
- Tenant with an unavailable feed: render nothing. The existing unavailable card remains.
- Admin with no reminders: render nothing. No empty banner.
- Admin with a failed read: render a dedicated unavailable notice in the banner area. The reset, bank, claims, and repairs cards keep their current behavior.

Rationale: an empty reminder is not useful, and a failed lease read must not hide the other admin tools.

## Risks / Trade-offs

- **A single invalid lease row hides the whole admin list** → Show a clear unavailable notice. The landlord can fix the row. The builder checks only the `leases` count, so a room with only a bad bill row still gets its reminder.
- **A `Bills` header or over-wide row hides the reminder** → The shared snapshot rejects the whole file before lease validation. The admin sees the unavailable notice while the other cards keep working. This is the cost of reusing the existing read path; a lease-only read would avoid it but add a second Google path.
- **The admin page now performs another full snapshot read** → The claim list already reads the same pair, so the second read can differ by one edit. Admin traffic is low. If consistency or quota becomes a problem, a later change can share one per-request snapshot across the admin accessors.
- **The reminder depends on an accurate `lease_end`** → The banner can only be as correct as the sheet. A missing lease row produces no reminder; the existing missing-lease copy still tells the tenant that lease dates are unavailable.
- **A set `renewal_due` does not hide the banner** → This is intentional and confirmed with the user. The column is a decision deadline, not proof of renewal.
- **Boundary tests can drift with the real clock** → The builder takes `today` as an argument. `tests/room-page.test.ts` mocks `todayInTaipei()` with a fixed date, and `tests/appfeed-renewal.test.ts` passes a fixed date to both the helper and the accessor test. The production accessor uses `todayInTaipei()` only at the edge.

## Migration Plan

No data migration and no environment change. Deploy the code after `npm test`, `npx tsc --noEmit`, and `npm run build` pass. The feature starts working as soon as a room's `lease_end` enters the window. Rollback is a code revert; no sheet state is written.
