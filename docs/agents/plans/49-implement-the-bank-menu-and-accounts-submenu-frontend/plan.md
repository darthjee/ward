# Plan: Implement the Bank menu and Accounts submenu — frontend

Issue: [49-implement-the-bank-menu-and-accounts-submenu-frontend.md](../../issues/49-implement-the-bank-menu-and-accounts-submenu-frontend.md)

## Overview

Frontend-only work: a context-aware **Bank** dropdown in the header (Accounts entry only), a
section registry so a context switch from a bank page lands on the same section's list, a
`BankClient` built on `contextPath`, shared bank helpers (amounts, currency, pagination,
`CurrencySelect`), and the regular-account pages (list, new, edit, detail + paginated ledger with
an inline transaction form). No backend change and no new dependency.

See [frontend.md](frontend.md) for the full plan.
