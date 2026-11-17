# Split provider — Calendar UI

Calendar labels and the Pay form. Read by [#124](https://github.com/darthjee/ward/issues/124).
Back to the [README](../README.md). Payload in [../api/payments.md](../api/payments.md).

## Entry label

Primary label is `source_bill.description`, secondary the provider name, so three entries of one
provider read "Internet / Vivo", "Telefone / Vivo", "Móvel / Vivo". Debt entries are unchanged
(`source_bill` is `null`).

## Pay form

- Reads `source_bill` and targets the **per-bill** payment route
  (`provider-bills/:id/occurrences/:dueDate/payment.json`); debts keep the account route.
- Accepts **both** `provider` and `provider_bill` in `CHARGE_KINDS`
  (`frontend/assets/js/client/CalendarClient.js`, `calendar/common/PayForm.jsx`) to offer the
  optional charge, since the backend renames the value only in
  [#125](https://github.com/darthjee/ward/issues/125).
- The amount is required when `expected_amount` is `null`.

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md)
- [`CalendarClient.js`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/client/CalendarClient.js)

## Required tests

[#124](https://github.com/darthjee/ward/issues/124): label rendering (bill + provider, debt
unchanged); Pay form route selection per kind; both `provider` and `provider_bill` offer the
charge; amount required when `expected_amount` is `null`.
