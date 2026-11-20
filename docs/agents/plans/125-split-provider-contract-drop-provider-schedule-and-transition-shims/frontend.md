# Frontend Plan: Split provider: contract, drop provider schedule and transition shims

Main plan: [plan.md](plan.md)

## Shared contracts

What the frontend can rely on:

- **Provider account response.** `account.provider_expense` holds only `for_accountant` and
  `provider_tax_id`. The schedule keys are absent.
- **Provider create/PATCH.** Sending any other key in the nested `provider_expense` is a `400`.
- **Provider bill list.**
  `GET <base>/bank/accounts/:id/provider-bills.json?kind=recurring&page=1` returns
  `{ provider_bills: [{ expected_amount: string|null, kind: 'recurring', … }], pagination: { total_count, … } }`.
  Provider bills have no archived flag.
- **Calendar occurrences.** `kind` is `'debt' | 'provider_bill' | 'bill'` and is never
  `'provider'`. Provider occurrences still carry `source_bill`.
- **Single-bill rule.** Shared with the migration's `down`: exactly one recurring bill gives its
  `expected_amount`; zero or several give an empty amount.

## Implementation Steps

### Step 1 — Trim the client contracts

**`frontend/assets/js/client/TypedAccountsClient.js`.** `PROVIDER_EXPENSE_FIELDS` becomes
`['for_accountant', 'provider_tax_id']`. `nestedBody` in `accountBodies.js` already whitelists to
these fields, so a schedule key can never reach the nested body. `DEBT_FIELDS` is unchanged.

**`frontend/assets/js/client/CalendarClient.js`.** `CHARGE_KINDS` becomes
`['provider_bill', 'bill']`. Drop the "`provider` stays until #125" comment.

**`frontend/assets/js/components/resources/bank/calendar/common/PayForm.jsx`.** Change the JSDoc
from "provider / bill" to "provider-bill / bill". Its behavior follows `CHARGE_KINDS`.

**Stale JSDoc.** These comments mention `provider_expense` as a schedule source; their callers
are debt-only:

- `common/form/controllers/scheduleFields.js` (L20-22);
- `common/detail/helpers/ScheduleInfoHelper.jsx` (L12).

**Specs:**

- `specs/assets/js/client/TypedAccountsClientSpec.js`:
  - remove the provider rows from the "passes / keeps null schedule fields" tables;
  - add cases where `createProviderExpense` / `updateProviderExpense` strip every schedule key
    from `provider_expense`;
  - add a case where `for_accountant` / `provider_tax_id` pass through.
- `specs/assets/js/client/BankClientProvidersSpec.js`: `PROVIDER_ATTRS` and the update test
  now expect the schedule keys stripped.
- `specs/assets/js/client/CalendarClientSpec.js`:
  - iterate `['provider_bill', 'bill']`;
  - add a case where kind `'provider'` drops `record_charge`.
- `specs/.../calendar/common/PayFormSpec.js`:
  - remove the `'provider'` case, or assert that the checkbox is hidden for it;
  - keep the checkbox offered for `'provider_bill'`.
- Rename the `kind: 'provider'` fixtures to `'provider_bill'` in:
  - `CalendarActionsSpec.js:12`
  - `CalendarEntrySpec.js:68`
  - `payFieldsSpec.js:4`
- Drop the stale schedule keys from the `provider_expense` fixtures in:
  - `ProviderInfoHelperSpec.js`
  - `BankProviderListHelperSpec.js`
  - `BankProviderDetailHelperSpec.js`

  `providerFormFieldsSpec.js:75` deliberately feeds schedule keys to assert they are ignored.
  Keep it.

### Step 2 — Add charge prefill from the single recurring bill

Today `ProviderShortcuts` calls `chargePreset(account.provider_expense)`, which reads
`expected_amount` from the provider details. That field is gone. The provider detail page does
not hold the bills itself: they live in the sibling `ProviderBills` component, paginated, in
local state. So the shortcut fetches what it needs with one small request.

**`frontend/assets/js/client/ProviderBillsClient.js`.** `listProviderBills(context, providerId,
page = 1, kind)` appends `&kind=<kind>` when `kind` is given. Existing callers are unchanged.

**`frontend/assets/js/components/resources/bank/providers/common/shortcutPresets.js`.**
`chargePreset(recurringPage)` takes the `kind=recurring` list response:

- `pagination.total_count === 1`: `amount` is `provider_bills[0].expected_amount ?? ''`.
- Otherwise (zero, several, not loaded yet, or `undefined` from an expired session): `''`.

`direction` and `description` are unchanged. Using `total_count` instead of the page length keeps
the rule correct for providers whose recurring bills span more than one page.

**Fetching the page.** Add a small hook,
`providers/common/hooks/useRecurringBills.js` (or similar). Given the context and the provider
id, it fetches `kind=recurring` page 1 once, keeps the response in state and ignores the result
after unmount. Use it from `ProviderShortcuts.jsx`, which takes the context it needs from its
caller `BankProviderDetailHelper.renderShortcuts`, or from the existing context provider. Follow
the existing patterns of `useProviderBills` / `ProviderBillsController`.

Skip the fetch when the account is archived: the bar is hidden then anyway.

The prefill is computed when the user clicks **Add charge**. A bill added in the sibling list
during the same page view does not refresh the prefill until reload. This is acceptable. Optional
improvement: re-fetch when `ProviderBills` changes. Do not add it unless it is trivial.

**Specs:**

- `specs/.../providers/common/shortcutPresetsSpec.js` covers `chargePreset`:
  - one recurring bill gives its amount;
  - one recurring bill with a `null` amount gives `''`;
  - zero bills (`total_count: 0`, the "only one-off bills" case) give `''`;
  - several (`total_count: 2`) give `''`;
  - `undefined` gives `''`.
- `specs/.../providers/common/ProviderShortcutsSpec.js`:
  - stub `ProviderBillsClient.listProviderBills` and assert it is called with `kind`
    `'recurring'`;
  - clicking **Add charge** prefills the amount for a single recurring bill, and leaves it empty
    for zero or several;
  - no fetch for an archived provider.
- `specs/.../providers/pages/helpers/BankProviderDetailHelperSpec.js`: stub the new fetch so the
  existing **Add charge** assertions keep passing.
- A spec for the new hook, if it is a separate module.
- `ProviderBillsClient` spec: the `kind` query parameter is appended when given and omitted
  otherwise.

## Files to Change

- `frontend/assets/js/client/TypedAccountsClient.js`: trim `PROVIDER_EXPENSE_FIELDS`.
- `frontend/assets/js/client/CalendarClient.js`: `CHARGE_KINDS = ['provider_bill', 'bill']`.
- `frontend/assets/js/client/ProviderBillsClient.js`: optional `kind` filter on
  `listProviderBills`.
- `frontend/assets/js/components/resources/bank/calendar/common/PayForm.jsx`: JSDoc wording.
- `frontend/assets/js/components/resources/bank/common/form/controllers/scheduleFields.js` and
  `frontend/assets/js/components/resources/bank/common/detail/helpers/ScheduleInfoHelper.jsx`:
  JSDoc wording (debt-only).
- `frontend/assets/js/components/resources/bank/providers/common/shortcutPresets.js`:
  `chargePreset` reads the recurring-bill page.
- `frontend/assets/js/components/resources/bank/providers/common/ProviderShortcuts.jsx`: fetch
  the recurring bills and feed `chargePreset`.
- `frontend/assets/js/components/resources/bank/providers/common/hooks/useRecurringBills.js`:
  new hook, if extracted.
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx`:
  pass the context or provider id to `ProviderShortcuts`, if needed.
- Specs under `frontend/specs/assets/js/`:
  - `client/TypedAccountsClientSpec.js`
  - `client/BankClientProvidersSpec.js`
  - `client/CalendarClientSpec.js`
  - the `ProviderBillsClient` spec
  - `calendar/common/PayFormSpec.js`, `CalendarActionsSpec.js`, `CalendarEntrySpec.js` and
    `payFieldsSpec.js`
  - `providers/common/shortcutPresetsSpec.js` and `ProviderShortcutsSpec.js`
  - `providers/pages/helpers/BankProviderDetailHelperSpec.js`, `ProviderInfoHelperSpec.js` and
    `BankProviderListHelperSpec.js`

## CI Checks

- `frontend` specs: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend` lint: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- **The issue's premise is inaccurate.** The issue says the prefill comes "from the bills the
  detail page already loads", but the detail page does not load bills; only the sibling
  `ProviderBills` does, paginated. Hence the dedicated `kind=recurring` fetch. Lifting
  `useProviderBills` into the page was rejected: it only holds the current page and would mix
  one-off bills in.
- **No archived flag.** "Only archived → empty" in the issue's test list is not representable,
  because provider bills have no archived flag. Test "only one-off bills → empty" instead.
- **Stale tabs.** An open tab with the pre-#125 bundle only loses the **Add charge** prefill
  until reload. This is accepted.
- The account-level `BillsClient` routes and `CalendarClient.payOccurrence` remain for debts.
  `CalendarActionsController` already routes provider occurrences via `source_bill`.
