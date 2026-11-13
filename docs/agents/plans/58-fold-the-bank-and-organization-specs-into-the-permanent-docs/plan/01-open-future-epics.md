# Open the 24 Future epics

Create one GitHub issue for each of the 24 entries in
`docs/agents/specs/banking/README.md#future-epics`. Do this first, so later steps can link the
real issue numbers.

For each entry:

- Run `gh issue create -R darthjee/ward --title "<entry title>" --label Epic --label Idea --body-file -`.
  These are standalone epics. Don't attach them as sub-issues of #26.
- The body seeds the epic and has these sections:
  - **What it covers**: the entry's description.
  - **Decisions it must respect**: the constraints in the entry, for example:
    - the one-currency-per-account rule;
    - the exactly-one-owner check;
    - Ward's global `is_admin` grants no org access;
    - payments stay keyed by the nominal due date;
    - read occurrences through a service, never events;
    - the 512 MB memory limit.
  - **Where these decisions live**: links to the **permanent** pages that will exist after
    steps 02–03, as GitHub URLs on `main`, for example
    `https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md#currency`.
    Never link into `docs/agents/specs/`.
  - **Origin**: "Deferred by the bank / organization specs of Epic #26, folded by #58", plus
    the issue numbers the entry cites (#28, #32, #33, #40, #41).
- Plan the target page and anchor for each entry before writing its body:

  | Entries | Target page |
  |---|---|
  | 1–4 | `modules/auth/organizations.md` |
  | 5–10, 24 | `modules/bank/transactions.md` |
  | 11 | `modules/bank/debt.md` |
  | 12 | `modules/bank/investment.md` |
  | 13, 14 | `modules/bank.md#bank-ownership-contract` |
  | 15 | `modules/bank/accounts.md` |
  | 16, 17 | `modules/bank/provider-expense.md` |
  | 18–23 | `modules/bank/bills.md` (and `modules/bank/ui.md` for 21 and 22) |

  Then use the same anchors in steps 02–03.

Record the mapping from entry to issue number in a scratch table outside the repo. Steps 02, 03
and 05 use it to link each deferred concern where the docs mention it, and to fill the
*Follow-up epics* column. Before creating anything, check for existing issues with the same
titles (`gh issue list -R darthjee/ward --label Epic --search "<title>"`), so a rerun doesn't
create duplicates.

## Files to Change
- None in the repo. This step creates 24 GitHub issues labelled `Epic` and `Idea` in `darthjee/ward`.
