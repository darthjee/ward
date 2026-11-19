# BillHistory per-bill variant

`BillHistory` / `useBillHistory` / `BillHistoryController` gain an optional `billId`:

- With `billId`, list with `ProviderBillsClient.listBillPayments(context, billId, page)` and
  undo every row with `ProviderBillsClient.undoOccurrencePayment(context, billId,
  row.due_date)`.
- Without `billId`, behaviour is unchanged (the account route). Debt detail keeps using it.

`account` is still passed in, because it supplies the currency and `archived_at`, so Undo stays
hidden while the provider is archived.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/bills/BillHistory.jsx`: accept `billId`.
- `frontend/assets/js/components/resources/bank/common/bills/hooks/useBillHistory.js`: pass
  `billId` to the controller.
- `frontend/assets/js/components/resources/bank/common/bills/controllers/BillHistoryController.js`:
  per-bill load and undo.
- Specs under `frontend/specs/assets/js/components/resources/bank/common/bills/`: list URL and
  undo URL with and without `billId`.
