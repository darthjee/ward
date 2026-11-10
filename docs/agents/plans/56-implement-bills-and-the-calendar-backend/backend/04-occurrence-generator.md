# Pure occurrence generator

Add a pure, dependency-free module: `bank/bills/occurrences.ts`, or `bank/occurrence-generator.ts` if a `bills/` subfolder breaks conventions. It does all the date maths with `Date.UTC`; no library is added.

## API

- **`occurrencesBetween(schedule, from, to)`** returns `{ nominal, effective }[]`, sorted ascending.
  - `schedule = { frequency: 'monthly' | 'yearly', dueDay, dueMonth, billsFrom, showInCalendar, archived }`.
  - It filters on the **effective** date being in `[from, to]`. To catch nominal dates whose shift lands in the range, scan a few days before `from`.
- **`isNominalOccurrence(schedule, date)`** is used by the pay / undo 404 check (step 07) and by `off_schedule` (step 08).
- **`overdueOccurrences(schedule, today)`** returns the occurrences whose effective date is `< today`, starting from `billsFrom`. It can be written as `occurrencesBetween(schedule, billsFrom, yesterday)`, filtered.
- **Helpers:** `clampDay(year, month, day)`, `shiftWeekend(date)` and `addDays`. Export them for tests if useful.

## Rules (from `bills.md`)

- **No schedule.** `dueDay` null, `showInCalendar` false or archived → no occurrences, past or future.
- **Frequency.** Monthly ignores `dueMonth`; yearly uses `dueDay` plus `dueMonth`.
- **Start.** The first occurrence is the first nominal date on or after `billsFrom`. A null `billsFrom` with `dueDay` set should not happen after the backfill. Treat it as "no occurrences", and note that choice in code.
- **Open-ended.** `instalmentCount` and the balance are not inputs at all.
- **Clamping.** The day is clamped to the month's last day: 31 → 30 Apr; 29–31 → 28 or 29 Feb; yearly 29 Feb → 28 Feb in non-leap years. Exactly one occurrence per period.
- **Weekend shift.** Saturday or Sunday → the following Monday for the effective date; the nominal date is unchanged.
- **One-off bills** do not go through the generator: nominal = effective = `dueDate`.

## Tests

Add `bank/tests/occurrences.spec.ts` covering every *Backend — pure occurrence generator* bullet of `bills.md`'s Required tests, except the 366-day cap, which is a route test in step 05:

- monthly and yearly;
- the `billsFrom` start, with the opening date ignored;
- every clamp case, including leap years;
- the Saturday and Sunday shifts;
- `showInCalendar` false, no `dueDay` and archived produce nothing;
- open-ended behaviour;
- `isNominalOccurrence` for on-schedule, off-schedule and before-`billsFrom` dates.

## Files to Change

- `backend/src/bank/bills/occurrences.ts` — new pure generator
- `backend/src/bank/tests/occurrences.spec.ts` — new unit spec
