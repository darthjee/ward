# Plan: Split provider — frontend: provider bills management UI

Issue: [131-split-provider-frontend-provider-bills-management-ui.md](../../issues/131-split-provider-frontend-provider-bills-management-ui.md)

## Overview
Replace the provider list's "Expected amount" column (which reads the old provider-level
`expected_amount` / `charge_frequency`) with a "Bills" column built from the `bills_summary`
field (`count`, `monthly`, `yearly`) that #133 adds to each provider in the list payload.
Frontend-only; blocked by #133.

See [frontend.md](frontend.md) for the full plan.
