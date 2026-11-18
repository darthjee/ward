# Plan: Split provider: calendar, payments and history per provider bill

Issue: [123-split-provider-calendar-payments-and-history-per-provider-bill.md](../../issues/123-split-provider-calendar-payments-and-history-per-provider-bill.md)

## Overview

Move the Calendar, overdue list, payment writer and bill history from one series per provider
account to one series per `ProviderBill`. The work adds per-bill pay, undo and history routes,
keeps the account-level pay and undo routes as aliases to the provider's single recurring bill,
and moves the provider-expense details response to read its schedule fields from that bill. All
code changes are in `backend/`.

See [backend.md](backend.md) for the full plan.

## Review and documentation (outside the backend plan)

- `cache` reviews the cache classes against `docs/agents/specs/split-provider/api/payments.md`.
  New GETs are user-scoped, writes are never cached, and Navi warms none of the new routes.
- `security` and `data-access` review the new routes, the aliases, the `source_bill` exposure
  and the ledger-label change.
- `architect` updates the docs in the same PR:
  - `specs/split-provider/api/payments.md`:
    - history is not an alias;
    - list the one-off routes `bills/:id/payment.json` until #125;
    - `DELETE` has no nominal-occurrence check;
    - add the 1000-occurrence cap behavior (see backend.md Notes).
  - `specs/split-provider/security.md`: the `:dueDate` row (POST only), the lock order and the
    occurrence-cap answer.
  - `specs/split-provider/migration.md`:
    - "Reads (from #123)": zero bills fall back to the details row;
    - the #123 test list;
    - the orphaned-payments leftover.
  - `modules/bank/bills.md`: lock order provider → provider bill → paying account, `source_bill`,
    per-bill history.
  - `backend/routes/bank.md`: new routes.
