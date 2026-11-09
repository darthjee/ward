# Record the #55 decisions in the spec

In `docs/agents/specs/banking/accounts/provider-expense.md`, record each decision from the
issue's "Decisions on points the spec leaves open" next to the rule it refines, marked
"(decided in #55)":

- Shared `bank/common` code with parameterised labels and slots.
- Add charge / Add payment mapping to Out / In, with the `expected_amount` suggestion.
- Frequency display ("/ month", "/ year", "—") and due day / month shown only when set.
- Sent mark display ("Sent <local date>"); Mark as unsent with no confirmation, visible when
  archived.
- The ConfirmModal warning on editing or deleting a sent charge.
- Range inputs defaulting to the last full month; the client-side check; API 400s shown via
  BankErrorAlert.
- Auto-reload preview with no Preview button; buttons disabled while loading.
- The Mark as sent gate (rows present, no download enforced); the confirm text; reload plus the
  success alert after marking.
- Per-currency totals summed in minor units.
- The CSV header row `Date,Account,Provider,Provider tax id,Description,Amount,Currency`;
  empty fields quoted; amount as the API string; a pure builder module.

Also flip the Providers row status in `docs/agents/specs/banking/ui/menu.md` if the
convention for implemented rows calls for it. Check what #49, #51 and #53 did.

## Files to Change
- `docs/agents/specs/banking/accounts/provider-expense.md` — decisions marked "(decided in #55)"
- `docs/agents/specs/banking/ui/menu.md` — only if the implemented-row convention requires it
