# Frontend Plan: Split provider — frontend: provider bills management UI

Main plan: [plan.md](plan.md)

## Overview
Add a pure `bills_summary` formatter next to `formatExpected` in `providerLabels.js` and use it
in a new right-aligned "Bills" column in `BankProviderListHelper.jsx`, replacing the "Expected
amount" header and cell. Update the provider-bills UI spec doc to match.

## Context
- **Blocked by #133.** `bills_summary` does not exist in the backend yet (no match for
  `bills_summary` under `backend/`). Assumed shape per the issue, one per provider in the list
  payload, archived providers included:
  ```json
  "bills_summary": { "count": 3, "monthly": "250.00", "yearly": "1200.00" }
  ```
  `monthly` / `yearly` are decimal strings or `null`. `null` and `"0.00"` both count as zero.
  The field may be **absent** (older backend or a cached response).
- The list helper currently has `const details = provider.provider_expense ?? {}`. The
  Expected cell reads `details.expected_amount` / `details.charge_frequency` through
  `formatExpected`. The For-accountant cell still uses `details` and stays as is.
- `formatExpected` must stay: `ProviderBillsHelper.jsx` and `BankBillHistoryHelper.jsx` still
  use it.
- The `/ month` / `/ year` wording comes from `formatInstalment(amount, frequency, currency)` in
  `bank/common/rates.js`. It returns `''` for an unset amount, so reuse it for each sum part.

### Cell rules (from the issue)
| `bills_summary` | Cell |
|---|---|
| missing (`undefined`/`null`) | empty |
| `count: 0` | `—` |
| `count: 2`, no non-zero sums | `2 bills` |
| `count: 1`, monthly 250 | `1 bill · R$ 250,00 / month` |
| `count: 3`, monthly 250, yearly 1200 | `3 bills · R$ 250,00 / month + R$ 1.200,00 / year` |
| `count: 1`, yearly only | `1 bill · R$ 1.200,00 / year` |

Each part (`3 bills`, `R$ 250,00 / month`, `R$ 1.200,00 / year`) sits in its own `text-nowrap`
span, so the cell wraps only between parts. Separators: ` · ` after the count and ` + ` between
sums.

## Steps

- [01 — Add the bills summary formatter](frontend/01-add-bills-summary-formatter.md)
- [02 — Replace the list column](frontend/02-replace-list-column.md)
- [03 — Update the provider-bills UI spec doc](frontend/03-update-spec-doc.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn test` (Jasmine + nyc coverage)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (ESLint over `assets` and `specs`)

## Notes
- The `bills_summary` shape is an assumption until #133 merges. Check the merged payload before
  implementing. If `monthly` / `yearly` come back as numbers, the zero check
  (`Number(value) === 0` or nullish) still holds.
- Don't add a per-row request. The column reads only the list payload.
- Never run `yarn` on the host. Always go through `docker-compose run --rm ward_fe ...`.
