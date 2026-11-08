# Debt detail page with info block and shortcuts

New `components/resources/bank/debts/pages/BankDebtDetail.jsx`, built on the shared detail
parts from steps 01–02 with base `'/bank/debts'`:

- Header, actions (Edit / Rename, Archive / Unarchive, Delete), archived banner, paginated
  ledger with inline add / edit — exactly as the regular detail.
- **Debt info block** (passed as the header's details renderer): interest rate and period,
  instalment amount (formatted), frequency, due day / due month, instalment count; unset
  values shown as empty / "—".
- **Add payment** / **Add interest** buttons above the ledger, mapped onto the inline form's
  In / Out toggle through `startNew(preset)`:
  - Add payment → `{ direction: 'in', description: 'Payment', amount: debt.instalment_amount ?? '' }`
  - Add interest → `{ direction: 'out', description: 'Interest', amount: '' }`
  - the plain inline add row stays available;
  - both buttons hidden on an archived debt (edge case 6).

Specs: info block contents; ledger present; each shortcut presets direction / description /
amount (with and without `instalment_amount`); dirty form asks for confirmation before a
preset; plain add still works; shortcuts hidden when archived; both contexts; creditor / notes /
descriptions escaped.

## Files to Change
- `components/resources/bank/debts/pages/BankDebtDetail.jsx` — new
- `components/resources/bank/debts/pages/helpers/BankDebtDetailHelper.jsx` — new (shortcuts + layout)
- `components/resources/bank/debts/pages/helpers/DebtInfoHelper.jsx` — new (info block)
- Specs mirroring the above
