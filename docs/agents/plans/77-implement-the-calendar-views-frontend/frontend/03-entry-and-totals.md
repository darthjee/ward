# Calendar entry and totals components

## Shared presentation pieces

Build the presentation pieces that both views share.

### `CalendarEntry` (props `{ context, occurrence, onPay, onSkip, onUndo, variant }`)

- **Name.** Show `bill.description` for `kind: bill`, otherwise `source_account.name`. Render
  it as escaped text.
- **Amount.** Show `formatMoney(expected_amount, currency)`, or nothing when it is `null`.
- **Date.**
  - Show `formatDate(effective_date)`.
  - Add the nominal date **only** when `nominal_date !== effective_date`, as "due Sat 14,
    moved to Mon 16", using `formatWeekdayDay` from step 01.
- **Status.**
  - Show a status badge.
  - `overdue` gets a highlight class (for example `text-danger` or `border-danger`).
  - `paid` and `skipped` get a muted class (`text-muted` / `opacity-50`).
- **Link.** Build it under the active context with `contextHash`:
  - for `debt` / `provider`: `${SECTION_BY_TYPE.get(source_account.type)}/${source_account.id}`;
  - for `bill`: `${BILLS_BASE}/${bill.id}/edit`.
- **Actions.**
  - `open` / `overdue`: Pay and Skip buttons.
  - `paid` / `skipped`: an Undo button.
- **Keys.** Export `occurrenceKey(occ)` (`kind`, `source_account.id`, `bill?.id` and
  `nominal_date`). Use it for React keys and for the Overdue de-duplication in step 05.

### `CalendarTotals` (props `{ totals, columns }`)

- Render one line per currency, never summed across currencies.
- `columns` is `['open']` for the list view and `['expected','paid','open']` for the month
  view.
- Every amount goes through `formatMoney`.
- Render nothing for `[]`.

## Specs

Cover:
- the nominal date shown only when it was shifted;
- the link targets for debt, provider and bill, under both Personal and organization contexts;
- the status classes;
- the buttons shown for each status;
- escaped names and descriptions (`<script>` in, `&lt;script&gt;` out);
- totals with two currencies, which stay separate, and an empty totals list.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/common/CalendarEntry.jsx`: new
  (split a helper out if it grows).
- `frontend/assets/js/components/resources/bank/calendar/common/CalendarTotals.jsx`: new.
- `frontend/assets/js/components/resources/bank/common/sections.js`: add
  `CALENDAR_BASE = '/bank/calendar'`.
- `frontend/specs/assets/js/components/resources/bank/calendar/common/CalendarEntrySpec.js`:
  new.
- `frontend/specs/assets/js/components/resources/bank/calendar/common/CalendarTotalsSpec.js`:
  new.
