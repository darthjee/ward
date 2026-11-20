# Create the follow-up epics

The spec README's `## Future epics` lists three concerns. #101 (combined calendar) already
exists and is handled in step 07. Create one GitHub epic for each of the other two. First
check that neither exists yet: run `gh issue list --label Epic --state all --search "<keyword>"`
for "bill link" and "archiv". Reuse an existing epic if one matches.

1. **Per-transaction bill link**
   - Title: `Epic: Per-transaction bill link`.
   - Labels: `Epic`, `Idea`.
   - Body (seeded from `specs/split-provider/README.md` § Future epics and `model.md`
     § "The ledger is unchanged"):
     - What it covers: linking a ledger `Transaction` to the `ProviderBill` (or debt
       occurrence) that produced it.
     - Today: the bill is a schedule, not a sub-ledger, and nothing links a transaction to a
       bill.
     - Constraints: keep one ledger and one balance per account, keep
       `account-balances.query.ts`, `ledger.query.ts` and the accountant hand-off intact, and
       add no owner column.
     - Cross-reference epic #119 and the permanent doc
       `https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md`.
2. **Archiving an individual bill while keeping its history**
   - Title: `Epic: Archive an individual provider bill`.
   - Labels: `Epic`, `Idea`.
   - Body:
     - What it covers: a cancelled phone line, for example.
     - Today: `ProviderBill` has no `archived` column, and a bill leaves the list and the
       Calendar only together with its provider.
     - Workaround until it ships: delete the bill when it has no paid payment, or set
       `show_in_calendar: false`. The add / edit form says this.
     - Constraints: keep the per-bill history readable, keep the description-uniqueness rule
       (recurring only), and keep provider archiving semantics.
     - Cross-reference #119 and the `bills.md` / `ui.md` web URLs.

Use `gh issue create --title ... --label Epic --label Idea --body-file -` and pass the body on
stdin. Then comment on #119 with the two new URLs. Record both URLs, because steps 02–04 and
08 need them.

## Files to Change
- None (GitHub only).
