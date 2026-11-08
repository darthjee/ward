# Plan: Implement the Debts submenu — frontend

Issue: [51-implement-the-debts-submenu-frontend.md](../../issues/51-implement-the-debts-submenu-frontend.md)

## Overview
Add the **Debts** submenu to the Bank menu: list, detail (debt info block, ledger, Add payment /
Add interest shortcuts), create / edit pages, wrong-type deep-link redirects and the client
calls for debt accounts. To avoid copying, the ledger, inline transaction form, header / archive
actions and common form fields are first extracted from the #49 Accounts pages into
`bank/common`, and both Accounts and Debts are built on top of them. Frontend only — the backend
(#50) already serves debt accounts on the generic account routes.

See [frontend.md](frontend.md) for the full plan.
