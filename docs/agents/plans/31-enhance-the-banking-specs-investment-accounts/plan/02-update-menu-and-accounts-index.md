# Update ui/menu.md and accounts/README.md

Record the placement decision in the shared files that still list it as open.

`docs/agents/specs/banking/ui/menu.md`:

- Add an **Investments** row to the submenu table, after **Debts**:
  "`investment` accounts only: list, detail (with the ledger and the Add application / Add
  withdrawal / Update value shortcuts), create / edit pages
  ([accounts/investment.md](../accounts/investment.md#investments-submenu-ui))", Status
  **Specified**, Row owner [#31](https://github.com/darthjee/ward/issues/31).
- Delete the "Where investment accounts are shown depends on…" paragraph.
- Edit only the #31 row and that paragraph. Do not touch other rows, the open question or
  Required tests (owned by #27). Optionally, add a Reference line for #31 if the file's
  convention allows it. Otherwise leave Reference alone.

`docs/agents/specs/banking/accounts/README.md`:

- In the "main accounts list" decision bullet, replace "Whether investment accounts appear in
  the main list is open" with a statement that investment accounts are **not** in the main
  list and have their own **Investments** submenu (link `investment.md`). Leave the rest of the
  file unchanged.

## Files to Change

- `docs/agents/specs/banking/ui/menu.md`: add the Investments row and remove the "depends on"
  paragraph.
- `docs/agents/specs/banking/accounts/README.md`: close the "investment in main list" open
  wording.
