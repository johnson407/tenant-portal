# Tasks

## 1. Extend the Repairs data contract

- [x] 1.1 Extend repair types and validation for the A:K schema, four statuses, Asia/Taipei visit windows, and optional whole-NT$ expenses; verify with validation tests for valid and invalid rows.
- [x] 1.2 Extend Google Sheets reads, appends, and row updates for columns A:K; verify with Google client tests for exact ranges and write boundaries.
- [x] 1.3 Update `docs/appfeed-rules.md` with the new headers, cell rules, deploy order, and rollback steps; verify that its schema and steps match the design.

## 2. Add secure repair management actions

- [x] 2.1 Add admin-only status and visit window updates with fresh reads, request locks, write verification, and room cache invalidation; verify with action and write tests.
- [x] 2.2 Add admin-only expense recording and updates for completed repairs; verify blank, zero, valid, invalid, unauthorized, and write-failure cases.
- [x] 2.3 Build fresh active-repair and completed-repair admin projections, including an expense total and no partial total on invalid data; verify room scoping, admin authorization, and sum cases.

## 3. Show repair timing to tenants

- [x] 3.1 Update tenant repair projections and history to show localized status and visit windows without expense values; verify page and boundary tests for room privacy and expense exclusion.
- [x] 3.2 Add Traditional Chinese and English labels for all repair statuses and visit times; verify the locale dictionaries and rendered date and time formats.

## 4. Add repair costs to the admin console

- [x] 4.1 Show active repair controls and completed repair history with editable expense amounts; verify status updates and later expense entry in both locales.
- [x] 4.2 Show the total of all recorded expenses in the admin repair section; verify blank and zero amounts, updates, unavailable data, and that tenants never see the total.

## 5. Verify the integrated change

- [x] 5.1 Run the full unit suite and type check; verify both commands pass and OpenSpec requirements map to the implemented behavior.
