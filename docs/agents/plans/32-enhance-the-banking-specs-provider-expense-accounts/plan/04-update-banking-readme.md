# Banking README: index, decisions, sub-issue map, Future epics

Edit `docs/agents/specs/banking/README.md`:

1. **Decisions — Bank menu bullet** — replace "a place for **provider-expense accounts**
   (decided by #32)" with "**Providers** (provider-expense accounts, their own submenu)".
2. **Bank ownership contract — child records** — optionally name the concrete
   `bank_provider_expense_details` alongside `bank_debt_details` / `bank_investment_details`
   ("later provider-expense and bill records" → "`bank_provider_expense_details`, and later
   bill records"). This is a wording precision, not a contract change; skip if it seems to
   go beyond scope.
3. **Index** — expand the `accounts/provider-expense.md` row in the debt / investment style:
   one account per provider, payable ledger (charges negative, payments positive), fields in
   `bank_provider_expense_details`, `provider_expense` object on the generic account routes,
   `sentToAccountantAt`, accountant hand-off (preview, client-side CSV, mark sent / unsent),
   Providers submenu pages.
4. **Sub-issue map** — expand the #32 row: `accounts/provider-expense.md` (full spec);
   `accounts/transactions.md` (`sentToAccountantAt` row, body whitelist, attachments
   pointer); `ui/menu.md` (Providers row, shared-submenu question resolved); this
   `README.md` (decision bullet, index entry, sub-issue map row, `## Future epics`).
5. **Future epics** — append, continuing the numbering after 15:
   - **16. Receipts / attachments** (from provider-expense.md) — attach receipt files to
     transactions (charges), include them in the accountant hand-off; decide storage (no
     persistent disk on Render's free tier), size limits, allowed types and access
     (attachments inherit the owner through their transaction's account).
   - **17. PDF accountant export** (from provider-expense.md) — a PDF alongside the CSV
     hand-off; deferred because of the heavy library / memory cost on 512 MB.
   - **Categories** (existing item 9) — add one sentence: telling a provider refund apart from
     a payment, so it can be exported to the accountant as a negative business expense, is one
     of its use cases.

## Files to Change

- `docs/agents/specs/banking/README.md` — decisions bullet, (optional) ownership-contract
  wording, index row, sub-issue map row, Future epics 16–17, Categories sentence.
