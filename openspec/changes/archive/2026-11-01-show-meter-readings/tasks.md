# Tasks

## 1. Bills schema, validation, and projection

- [x] 1.1 Extend `BILLS_HEADER` in `lib/appfeed/validate.ts` to the fifteen names, add a meter group type and the two breakdown fields in `lib/appfeed/types.ts`, and read cells 9 to 14 in `parseBillRow`. Verify the header assertion and the `validBill` fixture in `tests/appfeed-validate.test.ts` use fifteen cells, and `npx vitest run tests/appfeed-validate.test.ts` passes.
- [x] 1.2 Add the meter group check: all three cells blank or all set, whole readings, a rate matching `^\d{1,4}(\.\d{1,4})?$` and above zero, end not below start, and a present amount. Verify new cases in `tests/appfeed-validate.test.ts` cover a partial group, a missing amount, a zero rate, end below start, zero units, and a complete group.
- [x] 1.3 Add the half-up cost check with integer arithmetic: `expected = floor((units * rateScaled + 5000) / 10000)` must equal the utility amount. Verify `tests/appfeed-validate.test.ts` accepts an exact product, accepts a half-up rounded product, rejects a one-NT$ mismatch, and keeps a blank group valid.
- [x] 1.4 Project `waterBreakdown` and `electricityBreakdown` in `toFeedBill` as `{ start, end, units, rate }` or null, and leave `toFeedPayment` unchanged. Verify `tests/appfeed-feed.test.ts` and `tests/appfeed-boundary.test.ts` show the breakdown on an open bill, null on a blank group, no breakdown on a payment, and no room B value in room A's serialized feed.
- [x] 1.5 Change `BILLS_RANGE` in `lib/appfeed/google.ts` to `Bills!A:O` and leave the claim write at `Bills!H:I`. Verify `tests/appfeed-google.test.ts` requests `Bills!A:O`, accepts a fifteen-cell header, rejects a nine-cell header, and keeps a column beyond O outside the request.
- [x] 1.6 Update `docs/appfeed-rules.md` with the six new headers, the plain-text format for J:O, the group and rounding rules, the fixed-fee limit, and the deploy order. Verify the document names all six headers, states that the released app reads `Bills!A:I`, and lists the rollback step.

## 2. Locale formatting and copy

- [x] 2.1 Add `formatCount` and `formatRate` to `lib/i18n/format.ts`. Verify `tests/i18n-format.test.ts` shows grouped whole readings and units, and a rate such as `NT$8.5` with up to four fraction digits in both locales.
- [x] 2.2 Add `room.billBreakdownTemplate` to `lib/i18n/types.ts` and both dictionaries. Verify `tests/i18n-dictionaries.test.ts` passes, both templates hold `{start}`, `{end}`, `{units}`, and `{rate}`, and the `zh-TW` copy reads naturally with the existing water and electricity labels.

## 3. Dashboard display

- [x] 3.1 Render one breakdown line under the water and electricity amount on each open bill when the group exists, using the existing `water` and `electricity` labels and `text-slate-300`. Verify `tests/room-page.test.ts` finds the start reading, end reading, units, and formatted rate in the rendered bill.
- [x] 3.2 Keep the amount-only display when a group is null, and keep the payments disclosure at period, amount, and received date. Verify `tests/room-page.test.ts` covers a bill with one group, a bill with no group, and a paid bill with no breakdown text.
- [x] 3.3 Verify `tests/contrast.test.ts` still passes with the new line classes on the dark card.

## 4. Integration checks

- [x] 4.1 Run `npx tsc --noEmit` and confirm no type error.
- [x] 4.2 Run `npm test` and confirm every test passes.
- [x] 4.3 Run `npm run build` and confirm the production build succeeds.
- [x] 4.4 Run `openspec validate show-meter-readings --strict` and confirm the change is valid.

## Workflow follow-up

- Add the six header cells to AppFeed and set J:O to plain text before the new app deploys.
- Deploy the new app, then fill one test bill and confirm the breakdown line.
- Archive the change after the deploy and the sheet update are complete.
