# Calendar label and occurrence key

**Label** (`CalendarEntry.jsx`, `entryName`): when `occ.source_bill` is set, show
`source_bill.description` as the primary label and the provider name
(`source_account.name`) as the secondary one, as in "Internet / Vivo". Without `source_bill`,
labels stay as today: debts show the account name, and legacy `bill` entries show
`bill.description`. `entryHref` doesn't change.

**Key** (`occurrenceKey.js`): add `source_bill?.id` to the key. Otherwise two recurring bills
of one provider due on the same date collide, which breaks React keys and the overdue
de-duplication in `CalendarListController`.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/common/CalendarEntry.jsx`: label
  from `source_bill`.
- `frontend/assets/js/components/resources/bank/calendar/common/occurrenceKey.js`: include
  `source_bill?.id`.
- Specs: `CalendarEntrySpec.js` (label with and without `source_bill`) and an
  `occurrenceKey` spec (two bills of one provider on one date get distinct keys).
