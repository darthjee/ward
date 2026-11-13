# Plan: Implement bill inputs, one-off bills and Bill history — frontend

Issue: [57-implement-the-calendar-one-off-bills-and-bill-history-frontend.md](../../issues/57-implement-the-calendar-one-off-bills-and-bill-history-frontend.md)

## Overview

Frontend-only work on top of the #56 backend: three schedule inputs on the Debts / Providers
forms (and their display on the detail pages), the one-off bill pages
(`<ui>/bills/new`, `<ui>/bills/:id/edit`), the provider **Add bill** button, and a paginated
**Bill history** list with **Undo** on the debt / provider detail pages, built around a shared
Undo confirmation component that #77 will reuse.

See [frontend.md](frontend.md) for the full plan.
