# Preserve the bills.json contract

`bills.json` and `/bills/:id.json` must behave exactly as before, and only ever see one-off bills.

- **Owner-scoped `kind` filter, inside the query** (uniform 404, no check after loading):
  - `BillService.findOwned`: `bills.findOneBy({ id, kind: 'one_off' })`. This also covers
    `payBill` / `undoBill` in `bill-payment.service.ts`.
  - `#lockedBill` (update/delete): `where: { id, providerAccountId, kind: 'one_off' }`. A legacy
    `DELETE` can therefore never cascade-delete a recurring bill's history.
  - `list`: `where: { providerAccountId: In(ids), kind: 'one_off' }`.
  - `calendar.query.ts` `bills(...)`: add `kind: 'one_off'`, so recurring rows (null `due_date`)
    never surface as one-off occurrences.
  - `bill-payment.writer.ts` `#recheck`: add `kind: 'one_off'` to the lock query.
- **`amount` ↔ `expectedAmount` mapping:** the DTOs keep `amount`. `create` sets
  `expectedAmount` and `kind: 'one_off'`, `update` writes `bill.expectedAmount`, and
  `serializeBill` emits `amount` from `expectedAmount`. Extract a small mapper if
  `bill.service.ts` would pass 300 lines.
- **400 on recurring fields:** `@StrictBody()` (`forbidNonWhitelisted`) already rejects any
  undeclared property. Make sure no DTO declares `kind`, `due_day`, `charge_frequency`,
  `due_month`, `bills_from` or `show_in_calendar`, and pin this behaviour with specs.

## Specs (`bank/tests/bills.e2e-spec.ts`, both contexts)
- `bills.json` lists one-offs only (seed a recurring bill directly in `repos.bills`), with
  `amount` in the body.
- `POST` / `PATCH` with each recurring field → `400`.
- `GET` / `PATCH` / `DELETE /bills/:id.json` on a recurring id → `404`, the same as an unknown id.
  After the `DELETE`, the recurring bill and its payments still exist.
- Paying / undoing a recurring id through the one-off bill-payment route → `404`.

## Files to Change
- `backend/src/bank/bill.service.ts` — `kind` filters and amount mapping.
- `backend/src/bank/bill-response.ts` — `amount` from `expectedAmount`.
- `backend/src/bank/calendar.query.ts`, `backend/src/bank/bill-payment.writer.ts` — `kind: 'one_off'` filter.
- `backend/src/bank/tests/bills.e2e-spec.ts`, `backend/src/bank/tests/bill-payments.e2e-spec.ts` — new cases.
