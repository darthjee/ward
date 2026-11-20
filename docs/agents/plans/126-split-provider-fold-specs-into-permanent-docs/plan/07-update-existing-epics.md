# Update and re-read the existing epics

1. **#101 (Combined calendar across owners):** run `gh issue view 101`. Add a comment, or edit
   the body if it describes the occurrence shape. It must be written against the new
   occurrence shape:
   - `kind` `debt | provider_bill | bill`;
   - `source_bill: { id, description } | null`;
   - payment keys per bill (`provider_bill_id` + nominal date), debts per account.

   Link `bills.md` § Occurrence shape by web URL.
2. **#85, #86, #89, #96, #97:** run `gh issue view <n>` for each. If an issue names
   provider-level schedule fields (`expected_amount`, `charge_frequency`, `due_day`,
   `due_month`, `bills_from`, `show_in_calendar`, provider `paying_account`) or "the
   provider's bill", add a short comment:
   - those fields now live on each `ProviderBill` (#119);
   - include the web URL of `modules/bank/bills.md`;
   - name the relevant per-bill route or key.

   Leave issues that don't name them alone. Record which ones were commented on, for the PR
   description.

Comments are passed on stdin (`gh issue comment <n> --body-file -`).

## Files to Change
- None (GitHub only).
