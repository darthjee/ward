# Issue: Split provider — frontend: calendar, per-bill payments and history

## Description

Sub-issue of [#124 — Split provider — frontend provider bills UI](https://github.com/darthjee/ward/issues/124) (epic [#119](https://github.com/darthjee/ward/issues/119)), part **B**: calendar, payments and per-bill history.

PR #134 (which fixed #124) already shipped almost all of part B:
- the calendar label `<bill> / <provider>`
- pay, skip and undo for each bill through `provider-bills/:id/occurrences/:dueDate/payment.json`
- `provider_bill` in `CHARGE_KINDS`
- the `bank-bill-history` route and page, with the back link, the header and the per-bill client
- the History link on each row of the Bills block
- the provider detail without the Bill history block

What remains is one gap, described below.

## Problem

`renderActions` in `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx` returns `null` when the provider is archived. That hides the **History** link together with **Edit** and **Delete**.

The provider-level Bill history block was removed in #134, so on an archived provider there is now no way to reach any bill's payment history. Before #134, that history stayed visible (read-only) on archived providers.

## Expected Behavior

- Every row of the Bills block, one-offs included, shows the **History** link, whether or not the provider is archived.
- **Edit** and **Delete** stay hidden while the provider is archived.
- The per-bill history page keeps its current behaviour on archived providers: payments are listed and **Undo** is hidden.

## Solution

- In `ProviderBillsHelper.jsx`, always render the actions cell with the History link. Render Edit and Delete only when `account.archived_at` is not set. Update the JSDoc to match.
- If the actions column header is hidden on archived providers, make it consistent with the cell.
- Jasmine spec: on an archived provider, the History link is present and Edit and Delete are absent. On an active provider, all three are present.
- Docs: in `docs/agents/specs/split-provider/ui/provider-bills.md` (§ Provider detail — Bills block), state that the history link stays available on archived providers while Edit and Delete are hidden.

Owner: `frontend` agent.

## Benefits

Bill payment history stays reachable on archived providers, so archiving no longer hides it.
