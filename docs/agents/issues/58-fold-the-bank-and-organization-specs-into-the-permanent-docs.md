# Issue: Fold the bank and organization specs into the permanent docs

## Description

Fold the lasting content of the bank and organization specs (`docs/agents/specs/banking/` and
`docs/agents/specs/auth/`) into Ward's permanent documentation, open the deferred **Future
epics** as GitHub issues, and remove the spec folders. This is steps 3–5 of the spec lifecycle
(`docs/agents/specs.md#lifecycle`), and the last sub-issue of Epic #26.

Describe what was **actually implemented** (the code and `docs/agents/backend/routes/bank.md` as
built by #46–#57 and #77), not only what the specs planned. Note every divergence from the specs.

## Scope

The work runs in this order, in one PR.

1. **Open the Future epics.** Create one GitHub issue for each of the 24 entries in
   `docs/agents/specs/banking/README.md#future-epics` (the organization concerns live there too).
   - Labels: `Epic` and `Idea`, so each one enters the pipeline at `/enhance-issue`.
   - Each body seeds the epic: what it covers, the decisions it must respect, and where those
     decisions now live in the permanent docs (no links into the spec folders).
   - These are standalone epics, not sub-issues of #26.
2. **Fold the bank specs** into a hub plus a folder, like `modules/auth.md` + `modules/auth/`.
   - `docs/agents/modules/bank.md` (new hub): purpose and scope, entities, the bank ownership
     contract, the account types, routes (pointing at `backend/routes/bank.md`), cache classes,
     and an index of the folder.
   - `docs/agents/modules/bank/` (new), one file per concern:
     - `accounts.md`: common account fields, archive vs delete, regular accounts;
     - `transactions.md`: ledger, opening anchor, computed balances, currency;
     - `debt.md`, `investment.md`, `provider-expense.md` (including the accountant hand-off);
     - `bills.md`: hybrid bill model, schedule fields, recurrence, paying / skipping / undoing;
     - `ui.md`: the Bank menu, the per-account submenus, the Calendar list and month views and
       their dialogs, Add / edit bill and Bill history.
   - Each place a deferred concern is mentioned links the epic created in step 1.
3. **Fold the organization specs** into the `auth` module docs.
   - `docs/agents/modules/auth/organizations.md` (new): `Organization`,
     `OrganizationMembership`, roles (stored, not enforced), the auto-created organization, the
     active organization in the URL, the user-or-organization data-ownership rule,
     `OrganizationService` and `@OwnerScoped()`, and the security rules.
   - `docs/agents/modules/auth.md`: the org routes, plus links to `auth/organizations.md`.
4. **Update the other permanent docs.**
   - `docs/agents/product.md`: the data-ownership rule becomes "every domain record belongs to
     exactly one user or organization", and `bank` is described as implemented.
   - `docs/agents/backend/routes/` and `backend/routes.md`: the routes are complete, and
     `routes/bank.md` points at `modules/bank/` instead of the specs.
   - `docs/agents/architecture/backend.md` and `architecture/frontend.md`: repoint their spec
     links. `frontend.md` keeps only the cross-cutting parts (the organization context in the
     URL, routing) and links `modules/bank/ui.md` for the rest.
   - `.claude/agents/data-access.md` **and** `.github/agents/data-access.agent.md` (the Copilot
     copy added by #78): repoint the user-or-organization-owned checks at `product.md`,
     `modules/bank.md` and `modules/auth/organizations.md`. The same goes for the spec references
     in `.claude/agents/frontend.md` and `.github/agents/frontend.agent.md`.
   - `AGENTS.md`, `docs/agents/summary.md`, `index.md`, `contributing.md` and
     `folder-structure.md`: list `modules/bank.md` and `modules/bank/`, and drop any reference
     to the feature spec folders (links to the `specs.md` hub stay).
5. **Remove the specs.**
   - Delete `docs/agents/specs/banking/` and `docs/agents/specs/auth/`.
   - In `docs/agents/specs.md`, move both entries from *Active specs* (which then reads "none")
     to *Completed specs*, pointing at the permanent docs, with the created epics listed in the
     *Follow-up epics* column.

## Out of scope

- Any code change. If folding reveals a bug or gap, open a separate issue instead of fixing it
  here.
- Refining or planning the new epics: each goes through the pipeline later.
- The specs' *Required tests* sections: the tests already live in the code. Only the rules they
  verify are folded.

## Depends on

- #46–#57 and #77 (every implementation sub-issue of Epic #26). #77, the Calendar views
  frontend split from #57, is still open, and its UI decisions are part of this fold.

## Acceptance criteria

- Every lasting decision in `docs/agents/specs/banking/` and `docs/agents/specs/auth/` exists in
  the permanent docs, and every divergence between the specs and the implementation is noted.
- The 24 Future epics exist as GitHub issues labelled `Epic` and `Idea`, and the permanent docs
  link them where the deferred concern is mentioned.
- `docs/agents/specs/banking/` and `docs/agents/specs/auth/` are deleted, and `specs.md` lists
  them under *Completed specs*.
- `grep -rn "specs/banking\|specs/auth"` over `AGENTS.md`, `.claude/`, `.github/` and
  `docs/agents/` (excluding `issues/` and `plans/`) returns nothing.
