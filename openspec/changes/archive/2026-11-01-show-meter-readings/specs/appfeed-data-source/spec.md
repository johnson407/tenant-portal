# Spec Delta

## MODIFIED Requirements

### Requirement: Bills tab schema

The `Bills` tab SHALL expose exactly the header row `room, period, rent, water, electricity, due_date, paid_on, claimed_on, bank_last5, water_start, water_end, water_rate, electricity_start, electricity_end, electricity_rate` in that order. It SHALL hold one row per room per billing period, with room A-E, period `YYYY-MM`, whole-NT$ rent, optional whole-NT$ water and electricity, an ISO due date, an optional ISO paid date, optional claim fields, and an optional meter group per utility. A meter group SHALL hold whole-number readings and an NT$ rate with up to four decimal places. A row SHALL have both claim cells empty or both filled. Deposit is excluded.

#### Scenario: Exact Bills header
- **WHEN** the first row of the Bills tab is read
- **THEN** it equals the fifteen header names above, in that order, after trimming surrounding whitespace

#### Scenario: Blank versus zero utility charges
- **WHEN** a Bills row has a blank water or electricity cell
- **THEN** that utility is treated as no charge, while a cell containing `0` is treated as a real zero charge

#### Scenario: Duplicate billing period
- **WHEN** two Bills rows have the same room and the same period
- **THEN** both rows are invalid and that room's data is unavailable

#### Scenario: Claim pair is complete
- **WHEN** a Bills row has a claimed date but a blank suffix, or a suffix but a blank claimed date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Meter group is optional
- **WHEN** a Bills row has all six meter cells blank
- **THEN** the row is valid and the bill shows no meter breakdown

### Requirement: Fixed ranges and header allow-list

The system SHALL read cell data only from the fixed A1 ranges `Bills!A:O`, `Leases!A:D`, and, when present, `Repairs!A:G`, and SHALL validate each first row against the exact header allow-list. It MUST NOT fetch any other tab, column, or range. A claim write SHALL target only `Bills!H:I` on a row inside that range. A repair status write SHALL target only `Repairs!F:G` on a row inside that range.

#### Scenario: Only fixed ranges are requested
- **WHEN** the app reads cell data
- **THEN** the only ranges in the request are `Bills!A:O`, `Leases!A:D`, and, when the tab exists, `Repairs!A:G`

#### Scenario: Header mismatch
- **WHEN** a required header is renamed, reordered, duplicated, or missing
- **THEN** the affected tab is unavailable and no rows from it are interpreted

#### Scenario: Extra column is never fetched
- **WHEN** the sheet contains data in a column beyond O on Bills, beyond D on Leases, or beyond G on Repairs
- **THEN** that column is outside the requested range and never reaches the app

#### Scenario: Write stays inside the claim columns
- **WHEN** a claim is written
- **THEN** the update range is inside `Bills!H:I` and no other column changes

#### Scenario: Repair write stays inside the status columns
- **WHEN** a repair request is marked done
- **THEN** the update range is inside `Repairs!F:G` and no other column changes

#### Scenario: No Repairs range when the tab is absent
- **WHEN** the `Repairs` tab is absent
- **THEN** the read request contains only the `Bills` and `Leases` ranges

### Requirement: Strict Bills validation

Each Bills value SHALL be validated: room A-E after trim and uppercase; period `^\d{4}-(0[1-9]|1[0-2])$`; rent, water, and electricity `^\d{1,7}$` after trim, with blank allowed only for water and electricity; due_date and paid_on `^\d{4}-\d{2}-\d{2}$` real calendar dates; claimed_on blank or a real ISO date; bank_last5 blank or `^\d{5}$`; each utility meter group blank or complete with whole-number readings, an NT$ rate matching `^\d{1,4}(\.\d{1,4})?$` and above zero, an end not below its start, and a rounded cost equal to the amount; no duplicate `(room, period)`. Rows failing any check are invalid.

#### Scenario: Formatted amount rejected
- **WHEN** a rent or utility cell contains `$1,000`, `1,000`, a negative number, or a currency word
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Spreadsheet error rejected
- **WHEN** a cell contains `#DIV/0!`, `#N/A`, or another spreadsheet error
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Impossible calendar date rejected
- **WHEN** a due_date, paid_on, or claimed_on cell contains `2026-02-30` or another non-existent date
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Valid leap day accepted
- **WHEN** a date cell contains `2024-02-29`
- **THEN** the date is accepted as a real calendar date

#### Scenario: Lowercase or padded room accepted
- **WHEN** a room cell contains ` b ` or `c`
- **THEN** it is normalized to room B or C and attributed to that room

#### Scenario: Malformed account suffix rejected
- **WHEN** a bank_last5 cell contains four digits, six digits, letters, a space, or a hyphen
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Full account number is rejected
- **WHEN** a bank_last5 cell holds more than five digits
- **THEN** the row is invalid and the value is never displayed

#### Scenario: Complete meter group accepted
- **WHEN** a utility has a start reading, an end reading, a rate, and an amount equal to `(end - start) x rate`
- **THEN** the row is valid and the bill carries that meter breakdown

#### Scenario: Partial meter group rejected
- **WHEN** a utility has one or two of its start, end, and rate cells blank and the others set
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Cost mismatch rejected
- **WHEN** a meter group is complete but `(end - start) x rate` does not equal the utility amount
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: End reading below start rejected
- **WHEN** a meter group has an end reading lower than its start reading
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Breakdown without an amount rejected
- **WHEN** a meter group is complete and the matching water or electricity amount is blank
- **THEN** the row is invalid and that room's data is unavailable

#### Scenario: Zero usage with a zero amount accepted
- **WHEN** a meter group has equal start and end readings, a valid rate, and a matching amount of `0`
- **THEN** the row is valid and the breakdown shows zero units

## ADDED Requirements

### Requirement: Bill meter breakdown projection

The tenant feed SHALL include a water breakdown and an electricity breakdown for each open bill. Each breakdown SHALL hold the start reading, end reading, consumed units, and price per unit, or be null when the row has no meter group. Payment history SHALL keep its existing period, amount, and received date, with no breakdown.

#### Scenario: Breakdown is projected for an open bill
- **WHEN** an open bill row has a complete water meter group
- **THEN** the room feed holds the water start, end, units, and rate for that bill

#### Scenario: Missing meter group projects null
- **WHEN** an open bill row has blank meter cells for a utility
- **THEN** that utility's breakdown is null and the amount still appears

#### Scenario: Payment history has no breakdown
- **WHEN** a bill has a paid_on date and a complete meter group
- **THEN** the payment entry holds only period, amount, and received date

#### Scenario: Breakdown stays inside its room
- **WHEN** rooms A and B have distinct meter values and room A's feed is requested
- **THEN** the serialized result holds only room A's meter values and none of room B's

#### Scenario: Invalid meter group hides the room
- **WHEN** room A has an invalid meter group and room B has only valid rows
- **THEN** room A's feed is unavailable and room B's feed renders normally

#### Scenario: Logs hold no meter values
- **WHEN** an invalid meter group is logged
- **THEN** the log holds only counts, tab names, row numbers, and a fixed reason code, never a reading, rate, or amount
