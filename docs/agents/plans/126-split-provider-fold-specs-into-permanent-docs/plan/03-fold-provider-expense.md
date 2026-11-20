# Fold into `modules/bank/provider-expense.md`

- **Intro:** reword "one account per provider" to "one account per provider (one tax id, one
  ledger), which may hold several provider bills (an ISP's internet, phone and mobile)".
- **`## Fields`:** keep the `forAccountant` / `providerTaxId` table. Replace the paragraph that
  links `specs/split-provider/model.md` with a link to
  [bills.md § Provider bills](bills.md#provider-bills). Say that `for_accountant` stays on the
  provider because it classifies the relationship, not one charge. Say that the default paying
  account is per bill.
- **`### Rules`:** keep. The currency change also re-checks every bill's `paying_account_id`
  (from `api/provider-bills.md`). Mention the row-locked rescale in one transaction.
- **New `## Data sensitivity and ownership`** (from `security.md`):
  - Provider bills are personal financial data that inherit their owner through the provider.
  - Personal context: owner only, and the global admin gets **no** access.
  - Organization context: every member has full read / write access until
    [#81](https://github.com/darthjee/ward/issues/81).
  - A non-member and a non-member global admin both get the uniform `404`.
  - Routes sit under `@OwnerScopedController` with `@StrictBody()`.
  - Every `409` comes only after the owner-scoped resolve.
- **`## Charges and bills`:** keep, tighten the wording, and link the per-transaction-link
  epic from step 01 where it says the ledger has no bill link.
- **Delete** `## Transition rule (#122) — removed in #125`. It is delivery history.

## Files to Change
- `docs/agents/modules/bank/provider-expense.md` — intro wording, fields paragraph, rules, new access section, remove transition section.
