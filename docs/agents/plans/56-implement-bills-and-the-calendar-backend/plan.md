# Plan: Implement bills and the calendar — backend

Issue: [56-implement-bills-and-the-calendar-backend.md](../../issues/56-implement-bills-and-the-calendar-backend.md)

## Overview

Adds bills and the calendar to the lazy `bank` backend module, in one PR:

- the schedule fields on debt and provider-expense accounts;
- the `bank_bills` and `bank_bill_payments` tables;
- a pure occurrence generator;
- the calendar and overdue routes;
- one-off bill CRUD;
- pay / skip / undo;
- the bill history.

Occurrences are computed in memory for each request. The only writes come from user actions. The docs under `docs/agents/` are updated in the same PR.

See [backend.md](backend.md) for the full plan.
