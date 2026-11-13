# Schedule values on the detail pages

Show the three schedule values on the debt and provider detail pages, using `DetailEntry`
(escaped text, `—` when blank):

- **Bills from** — `bills_from`
- **Show in Calendar** — Yes / No
- **Default paying account** — `paying_account?.name`

Add them to the private `renderDebtFields` in `DebtInfoHelper.jsx` and `renderProviderFields`
in `ProviderInfoHelper.jsx`. If both need the same three entries, extract a tiny shared
`common/detail/helpers/ScheduleInfoHelper.jsx`.

Specs: the values render, blanks show `—`, and the account name is escaped.

## Files to Change
- `frontend/assets/js/components/resources/bank/debts/pages/helpers/DebtInfoHelper.jsx` — schedule entries
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/ProviderInfoHelper.jsx` — schedule entries
- `frontend/assets/js/components/resources/bank/common/detail/helpers/ScheduleInfoHelper.jsx` — optional shared renderer
- `frontend/specs/assets/js/components/resources/bank/debts/pages/helpers/DebtInfoHelperSpec.js` — extend
- `frontend/specs/assets/js/components/resources/bank/providers/pages/helpers/ProviderInfoHelperSpec.js` — extend
