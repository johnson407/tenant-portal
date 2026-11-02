# Proposal

## Why

Tenants can report a repair, but they cannot see when a visit is planned or whether work has started. The admin also needs a simple way to record repair costs over time and see their total.

## What Changes

- Add repair statuses for scheduled and in-progress work, plus a planned visit window that tenants can see.
- Let the admin update repair status and visit timing as plans change.
- Add one optional whole-NT$ expense amount to each repair. The admin can record or update it after the repair is complete.
- Show a running total of recorded repair expenses in the admin console. Keep expense amounts private from tenants.
- Extend the `Repairs` sheet contract and its validation and write rules.
- Keep the existing repair note, room privacy, and completion history rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repair-requests`: Add visit timing, additional repair statuses, admin status and expense updates, and an admin expense total.
- `appfeed-data-source`: Extend the `Repairs` schema and its read and write boundaries for visit times and expense amounts.

## Impact

This affects the tenant repair history, the admin repair queue, the AppFeed `Repairs` tab, repair projections and validation, Google Sheets reads and writes, and localized repair labels. It adds no runtime dependency or tenant contact data.
