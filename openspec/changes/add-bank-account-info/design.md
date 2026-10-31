# Design

## Context

See `proposal.md` for motivation. The constraints that shape this design:

- There is no database. Upstash Redis is already required at runtime and is accessed through `@upstash/redis` from `lib/code-store.ts` and `lib/rate-limit.ts`, each with a small private `getRedis()` that reads `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- AppFeed is strictly read-only and its file guard accepts exactly the `Bills` and `Leases` tabs, so the bank account cannot live there without weakening the data-source rules.
- The admin area is a single page guarded by `isAdminSession()` plus `proxy.ts`; the tenant dashboard is `app/[lang]/rooms/[room]/page.tsx`.
- Server Actions return locale-independent error codes and client forms map them to dictionary entries (`openspec/specs/localization/spec.md`).
- Specs for this change: `specs/bank-account-info/spec.md` and `specs/room-dashboard/spec.md`.

## Goals / Non-Goals

**Goals:**
- One durable, admin-editable bank account record that tenants see immediately after a save.
- Validation that keeps malformed transfer details out of both the admin form and the tenant page.
- Bank details never break the dashboard and never leak to unauthenticated requests or logs.

**Non-Goals:**
- Per-room accounts, multiple accounts, account history, or an audit trail.
- Google Sheets writes, new environment variables, or a new database.
- Bank account data in AppFeed, bills, or payments.
- Copying the account number to the clipboard or rendering it as a payment link.

## Decisions

### Store the record as a Redis hash under a fixed key

`lib/bank-account.ts` will expose `getBankAccount()` and `saveBankAccount(record)` using a Redis hash at `bank:account` with fields `bankName`, `recipientName`, `bankCode`, `accountNo`. `hset` writes all four fields in one call and `hgetall` returns the record.

- A hash avoids the deserialization ambiguity of storing a JSON string through the Upstash client, which auto-parses JSON on `get`, and keeps the record readable field by field.
- A fixed key matches the single shared account; there is no room segment, unlike `room:<letter>`.
- No cache: the dashboard calls `getBankAccount()` per request so an admin save is visible on the next load. The record is four short strings, and a stale bank account is worse than one extra KV read.
- Alternatives considered: a JSON string via `get`/`set` (auto-deserialization makes round-tripping a string fragile), `use cache` (would hide admin edits for the cache lifetime), and a new `lib/kv.ts` shared client (a wider refactor than this change needs; the two existing modules already duplicate the helper).

### Keep validation in a pure module

`lib/bank-account.ts` will export `parseBankAccount(input: Record<string, unknown>)` returning either `{ ok: true, value: BankAccount }` or `{ ok: false, field }`. Rules, applied after trimming:

| Field | Rule |
| --- | --- |
| `bankName` | 1-80 characters, no control characters |
| `recipientName` | 1-80 characters, no control characters |
| `bankCode` | `/^\d{3,7}$/` |
| `accountNo` | `/^\d{6,20}$/` |

This mirrors the pure `lib/appfeed/validate.ts` style and lets tests cover the rules without a Server Action. The same function validates a value read back from Redis, so a corrupted or hand-edited hash yields "no account configured" instead of rendering junk.

### Split the admin action from the reset action

Add `app/[lang]/admin/bank-actions.ts` with `"use server"` and `saveBankAccountAction(localeInput, _prev, formData)`, plus `app/[lang]/admin/bank-state.ts` for the state union `idle | error | success` and a `GENERIC_BANK_ERROR` constant. The existing `actions.ts` and `AdminResetState` stay untouched.

The action order will be: check `getSessionClaims()?.role === "admin"` before touching input or KV, parse the four fields, save, and return a locale-independent action state (`"idle"`, `{ error: "invalid" | "generic" }`, or `"success"`). Unlike code reset, no rate-limit bucket is added: the action verifies nothing secret and is already admin-only, and a failed save is not an authentication attempt. A compromised admin session could spam writes regardless of a bucket.

### Admin page: read, then render one section per concern

`app/[lang]/admin/page.tsx` will read the record inside a try/catch:

- Read succeeds with a record → pass it to `BankAccountForm` for prefill.
- Read succeeds with `null` → pass empty values.
- Read throws → render a localized unavailable notice in place of the form, so the admin cannot overwrite an unknown record with empty fields. The reset form keeps working in this case.

The page `<h1>` changes from "Room access codes" to a broader admin heading (zh-TW: 管理後台), and `AdminResetForm` gains its own section heading so the two forms are distinguishable. The bank form is a client component using `useActionState`, with the four inputs held in `useState` seeded from server-provided values; controlled inputs survive React's post-action form reset and keep the admin's input on a validation error.

### Tenant page: independent of the AppFeed result

`app/[lang]/rooms/[room]/page.tsx` reads the bank account in a separate try/catch that maps any failure to `null`, then renders a bank section when a value exists, before the bills section and outside the `feed === null` branch. This satisfies both "AppFeed unavailable still shows bank details" and "read failure hides only the section". Values render as plain text: the account number is not a link, and no formatting or masking is applied because tenants need the exact digits.

### Dictionary entries

Add `room.bankAccount` (heading, bankName, recipientName, bankCode, accountNo) and `admin.bank` (section heading, four labels, placeholders, digit-format hints, save label, saving, saved, errors for invalid and generic, unavailable notice) to `lib/i18n/types.ts`, `en.ts`, and `zh-TW.ts`. Account numbers and bank codes stay unchanged across locales.

## Risks / Trade-offs

- **Bank details are sensitive (recipient legal name and account number).** → They are read only on the authenticated tenant page and the authenticated admin page, never logged, and never returned by an API route. Error paths log fixed reasons only.
- **Redis data can be evicted or lost.** → The record is small and the admin can re-enter it; tenants see no section rather than an error. The form is the source of truth after the first save, so no env seeding is added.
- **A shared account cannot serve different rooms with different accounts.** → Accepted for this change; the hash key is a single constant that can become `bank:account:<scope>` later without changing the UI contract.
- **The dashboard gains a KV read on every request.** → One `hgetall` of four fields is cheap and keeps admin edits immediate; if latency becomes visible, a short `use cache` with an admin-save tag can be added later.
- **Controlled inputs add client state.** → They are needed to preserve values across `useActionState` submissions; the fields are four plain strings with no masking logic.

## Migration Plan

1. Deploy the code. No env changes and no data migration: the hash does not exist until the first save, and every tenant sees the same dashboard as before.
2. The landlord signs in, fills the bank form once, and saves.
3. Rollback is code-only. The `bank:account` key is simply ignored by the previous version, so no cleanup is required.

## Open Questions

None. The account scope, bank-code meaning, storage location, and validation shape were confirmed before this design was written.
