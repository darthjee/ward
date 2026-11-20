# Fold into `modules/bank/ui.md`

From `ui/provider-bills.md` and `ui/calendar.md`. Read the frontend code under
`frontend/assets/js/` (read-only) where a detail is unclear, and record what shipped.

- **`## Providers`:**
  - **List:** replace "expected amount with its frequency" with the right-aligned **Bills**
    column, read from `bills_summary` (no per-row request). Add every formatter rule:
    - singular / plural;
    - zero parts omitted (`null` and `"0.00"` count as zero);
    - one-offs and recurring bills without an amount count toward N but not the sums;
    - `count: 0` → `—`, and a missing `bills_summary` → an empty cell;
    - single currency;
    - parts never break internally;
    - archived providers follow the same rules.
  - **Detail:**
    - The provider info block loses expected amount / frequency / due day.
    - New **Bills block**: one row per bill (description, kind badge, amount and frequency or
      due date). Actions are Add bill, Edit, Delete and History.
    - On an archived provider, Add / Edit / Delete are hidden but History stays (read-only,
      Undo hidden).
    - **Add charge** prefills from the single recurring bill (empty with zero or several).
  - **Create / Edit:** provider fields are only For accountant and Provider tax id.
- **`## Schedule fields and Bill history`:** split it:
  - Debts keep the account-level schedule fields and history.
  - Providers have per-bill history, reached from the bill row
    (`provider-bills/:id/bill-payments.json`).
- **`## Add / edit bill`:** rewrite:
  - Same routes `<ui>/bills/new?provider=:id` and `<ui>/bills/:billId/edit`.
  - `kind` selector, disabled on edit.
  - Field sets per kind.
  - Server-error mapping (`NAME_TAKEN`, `LIMIT`, `KIND_LOCKED`, `PAID`, `CURRENCY_MISMATCH`, …).
  - The `show_in_calendar` hint that unticking it is how to stop a bill with history. Link
    the archive-bill epic from step 01.
  - Keep the one-off details that still apply (paying account, due date default, `?provider=`
    drop).
- **`## Calendar`:**
  - Entry label: `source_bill.description` primary and provider name secondary ("Internet /
    Vivo"). Debts unchanged.
  - The Pay form targets the per-bill route for provider bills.
  - "Also record the charge" for `provider_bill` and `bill`.
  - Amount required when `expected_amount` is null.
  - Drop the "accepts both `provider` and `provider_bill`" transition note.
- Add to `## Differences from the original spec` only where #124 / #132 / #133 shipped
  something the split-provider spec did not say.

## Files to Change
- `docs/agents/modules/bank/ui.md` — Providers list/detail/form, Bill history split, Add / edit bill rewrite, Calendar labels and Pay form.
