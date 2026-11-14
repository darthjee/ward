# `formatDate` and its use on every displayed ISO date

Add `formatDate(isoDate)` to `bank/common/dates.js`:

- Input `YYYY-MM-DD`; `null` / `undefined` / `''` → `''`; anything not matching the pattern is
  returned unchanged (never throws).
- Parse the three parts and format a calendar date that cannot shift: either
  `new Date(y, m - 1, d)` with the default (local) zone, or `new Date(Date.UTC(y, m - 1, d))`
  with `timeZone: 'UTC'` in the options — **never** `new Date('YYYY-MM-DD')` (UTC midnight,
  which shows the previous day west of UTC). Prefer the UTC variant: it is independent of the
  process time zone.
- Options: short numeric date, `{ year: 'numeric', month: 'numeric', day: 'numeric' }`, locale
  `DisplayLocale.get()` → `14/03/2026` (`pt-BR`), `3/14/2026` (`en-US`).

Use it wherever a raw ISO date is displayed (paths under
`frontend/assets/js/components/resources/bank/`):

- `common/detail/helpers/LedgerTableHelper.jsx` — `transaction.date`, `opening.date`
- `common/bills/helpers/BillHistoryHelper.jsx` — `due_date`, `paid_on` (keep `'—'` for null;
  the React key stays raw)
- `providers/pages/helpers/AccountantPreviewHelper.jsx` — `charge.date`, `sentDate()`
- `providers/common/SentMark.jsx` — `Sent ${formatDate(localToday(new Date(sent_to_accountant_at)))}`
  (timestamp → local calendar date first, then format)
- `common/detail/helpers/ScheduleInfoHelper.jsx` — `bills_from`
- `accounts/pages/helpers/BankAccountHeaderHelper.jsx` — `opening_date`
- `debts/pages/helpers/DebtInfoHelper.jsx` — `opening_date`
- `providers/pages/helpers/ProviderInfoHelper.jsx` — `opening_date`
- `investments/pages/helpers/InvestmentInfoHelper.jsx` — `opening_date`, `maturity_date`
- `investments/pages/helpers/BankInvestmentListHelper.jsx` — `maturity_date`

Leave raw: form field values (`*FormFields.js`, date inputs), `accountantCsv.js` and the CSV
filename, values sent to the API, React keys, stored descriptions.

Specs:

- `datesSpec.js` — `formatDate('2026-03-14')` is `14/03/2026` in `pt-BR` and `3/14/2026` in
  `en-US`; browser default equals `Intl.DateTimeFormat(undefined, {…, timeZone: 'UTC'})` of the
  same UTC date; `-01` and `-31` / year-boundary dates (`2026-01-01`, `2025-12-31`) keep their
  day; null/empty/garbage cases. To prove time-zone independence, run the day assertions with
  `process.env.TZ` temporarily set to `America/Sao_Paulo` and `Pacific/Kiritimati` (restore in
  `afterEach`), or assert the `timeZone: 'UTC'` option is passed via an injected `Intl`.
- Each helper spec listed above — with `pt-BR` set the date renders as `dd/mm/yyyy`; existing
  raw-ISO assertions updated to the formatted value.
- `accountantCsvSpec.js` — with a locale set, the CSV still contains ISO dates and `.` decimals.

## Files to Change

- `frontend/assets/js/components/resources/bank/common/dates.js` — `formatDate`
- The ten helper / component files listed above
- `frontend/specs/assets/js/components/resources/bank/common/datesSpec.js`
- The matching `*Spec.js` of each changed helper / component
- `frontend/specs/assets/js/components/resources/bank/providers/common/accountantCsvSpec.js` — regression
