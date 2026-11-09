# Plan: Implement the Providers submenu and the accountant hand-off — frontend

Issue: [55-implement-the-providers-submenu-and-the-accountant-hand-off-frontend.md](../../issues/55-implement-the-providers-submenu-and-the-accountant-hand-off-frontend.md)

## Overview

Add the **Providers** submenu (`provider_expense` accounts: list, detail with Add charge / Add
payment and sent marks, create / edit) and the accountant hand-off page
(`<ui>/providers/accountant`: range, "Unsent only", preview with per-currency totals, client-side
CSV, Mark as sent) to the React frontend. It is built on `bank/common`, the same way #51 (Debts)
and #53 (Investments) were, and it consumes the backend routes from #54 and #71. The issue's
decisions are also recorded in the provider-expense spec.

See [frontend.md](frontend.md) for the full plan.
