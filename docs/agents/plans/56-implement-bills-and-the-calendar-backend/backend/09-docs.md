# Docs (architect-owned)

This step is owned by the **architect** (`docs/agents/` scope), not by `backend`. It ships in the same PR, written against the code produced by steps 01–08.

## `docs/agents/specs/banking/bills.md`

Record each decision from issue #56's *Decisions* section next to the rule it refines, marked "(decided in #56)":

- the calendar and overdue envelopes, with the sort and tie-break;
- the totals rules;
- pagination for `bills.json` (including the `provider_account_id` filter) and `bill-payments.json` (`off_schedule`);
- the bill response fields;
- the pay / skip `201` and undo `204` responses, and undo with no payment → 404;
- undo on archived accounts;
- undo of a charge already sent to the accountant;
- the `paid_on` limit of today + 1;
- the description text and its truncation.

Also record any open point resolved during implementation, such as an archived provider in a bill body, or the visibility of an archived account's history, once it is confirmed on the issue.

## `docs/agents/backend/routes/bank.md`

- **Intro.** List the new controllers (calendar, bills, bill-payments) and services (`CalendarService`, `BillService`, `BillPaymentService`, `PayingAccountResolver`).
- **Object sections.** On the Debt and Provider-expense objects, add `bills_from`, `show_in_calendar`, `paying_account_id` in the body and `paying_account: {id, name}` in the response, with the 422 rules.
- **New *Bills and calendar* section** (before *Settings*): every route, with its body, reply, envelope, totals, pagination, errors (400 / 404 / 409 / 422, and the 366-day cap) and cache class.

## `docs/agents/backend/routes.md`

This file has no per-route index, so only extend the Bank bullet's description to mention bills and the calendar.

## Files to Change

- `docs/agents/specs/banking/bills.md` — the "(decided in #56)" notes
- `docs/agents/backend/routes/bank.md` — the schedule fields and the *Bills and calendar* section
- `docs/agents/backend/routes.md` — the Bank bullet
