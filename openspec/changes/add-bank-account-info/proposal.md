# Proposal

## Why

Tenants currently see what they owe but not where to send the money, so they must ask the landlord for transfer details. Letting the landlord maintain one bank account record in the admin area and showing it on every tenant dashboard removes that manual back-and-forth and keeps the details correct without a deploy.

## What Changes

- Add an admin-editable bank account record with four fields: bank name, recipient name, bank code (銀行代號), and account number.
- Persist the record in the existing Upstash Redis KV store; no database and no new environment variables are introduced, and AppFeed stays read-only.
- Add a "Bank account" section to the admin page (prefilled with the current values) with a Server Action that validates and saves the record. Only an admin session may write it.
- Show the saved bank account on every authenticated tenant dashboard as a reference section, independent of AppFeed availability: bills/payments/lease failures do not hide it, and a missing or unreadable record hides the section without breaking the dashboard.
- Add localized labels, placeholders, success, and validation messages for both locales.

**Assumptions recorded for this change:** one account is shared by all rooms; `bank no.` means the institution code used for transfers; account numbers are digits only. An unconfigured account shows no section rather than placeholder values.

## Capabilities

### New Capabilities

- `bank-account-info`: the landlord-maintained bank transfer details, including admin-only editing, validation, storage, and the tenant-facing reference display.

### Modified Capabilities

- `room-dashboard`: the dashboard requirement is extended so each authenticated tenant also sees the configured bank account section alongside bills, payments, and lease dates.

## Impact

- New server module for reading and writing the bank account in Redis, modeled on `lib/code-store.ts` and `lib/rate-limit.ts`.
- `app/[lang]/admin/page.tsx`, a new admin form component, a new Server Action, and a new action-state type.
- `app/[lang]/rooms/[room]/page.tsx` renders the new section; `lib/appfeed/*` and AppFeed schemas are untouched.
- `lib/i18n/types.ts`, `lib/i18n/dictionaries/en.ts`, and `lib/i18n/dictionaries/zh-TW.ts` gain admin and room entries.
- New Vitest coverage for validation, storage, the admin action, and dashboard rendering; existing tests that construct dictionaries may need updating.
- No new dependencies, routes, or environment variables. The admin page remains behind `isAdminSession()` and `proxy.ts`.
