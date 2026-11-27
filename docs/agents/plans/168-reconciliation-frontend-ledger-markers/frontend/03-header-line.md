# Last reconciled header line

Create `B/detail/LastReconciledLine.jsx`:

- **Props.** `{ account }`.
- **Hidden case.** It returns `null` when `account.last_reconciliation` is null.
- **Line.** Otherwise it renders `Last reconciled: <formatDate(statement_date)> · <formatMoney(balance, account.currency)>`.
- **Debt sign.** `balance` is `statement_balance`, negated (`negateAmount` from `B/amounts.js`)
  when `account.type === 'debt'`. This follows the precedent in
  `ReconcileSectionHelper.jsx` / `StatementsHistoryHelper.jsx`.

In `B/detail/helpers/AccountHeaderHelper.jsx`, render `<LastReconciledLine account={account} />`
right under the `Balance:` paragraph. `AccountHeaderHelper` is used by the Debts, Providers and
Investments detail helpers, and by Accounts through `BankAccountHeaderHelper.jsx`, so all four
types get the line.

**Refresh.** No new wiring is needed:

- after a finish, `ReconcileController.finish()` calls `reload()`;
- after an undo, `AccountDetailHelper`'s `onHistoryUndone` calls `onRetryLoad()`.

Both reload the account detail, and the header is derived from it. Assert this in the specs.

Specs:

- **New component spec** `S/detail/LastReconciledLineSpec.js`:
  - absent when `last_reconciliation` is null;
  - shows the formatted date and balance;
  - shows the negated balance on a debt and the raw balance on the other types.
- **`S/detail/helpers/AccountHeaderHelperSpec.js`**:
  - the line renders under `Balance:` (`containsInOrder`);
  - it is absent when `last_reconciliation` is null.
- **`S/detail/helpers/AccountDetailHelperReconcileSpec.js`**:
  - after an undo, the header shows the reloaded account's `last_reconciliation` (or none);
  - after a finish, the same. If the finish reload is easier to assert at the controller level,
    use `S/reconciliation/controllers/ReconcileControllerSpec.js`, then render the header from
    the reloaded state.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/LastReconciledLine.jsx` — new
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx` — render the line under `Balance:`
- `frontend/specs/assets/js/components/resources/bank/common/detail/LastReconciledLineSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelperSpec.js` — line shown / absent
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelperReconcileSpec.js` — refresh after finish and after undo
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileControllerSpec.js` — only if the finish reload is asserted here
