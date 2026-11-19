# Plan: Split provider — frontend provider bills UI

Issue: [124-split-provider-frontend-provider-bills-ui.md](../../issues/124-split-provider-frontend-provider-bills-ui.md)

## Overview

Move the frontend from one schedule per provider to provider bills. The provider detail gets a
Bills block, and the bill form handles both `one_off` and `recurring` bills through the
`provider-bills` routes. The provider form no longer edits schedule fields, and the provider
list shows a bills summary. Calendar entries are labelled by bill. Pay, skip and undo, and a new
per-bill history page (`bank-bill-history`), use the per-bill routes. All code changes are in
`frontend/`. Steps 01–07 deliver sub-issue #131 and steps 08–14 deliver sub-issue #132.

See [frontend.md](frontend.md) for the full plan.

## Documentation (outside the frontend plan)

- `architect` updates `docs/agents/specs/split-provider/ui/provider-bills.md` (§ Per-bill
  history, § Routes) in the #132 PR. It names the `/bank/bills/:billId/history` →
  `bank-bill-history` route and records the decisions in frontend.md's Notes (archived
  providers, Bills block placement, provider info without schedule).
- If `docs/agents/modules/bank/ui.md` describes the provider detail, provider form or bill
  form, it gets updated in the same PR.

## Reviews

- There are no new endpoints and no backend changes, so `security`, `data-access` and `cache`
  are not required. The UI only consumes the routes from #122, #123 and #133.
