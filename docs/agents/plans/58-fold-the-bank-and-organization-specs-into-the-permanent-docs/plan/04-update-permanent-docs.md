# Update the other permanent docs and agent files

Repoint every remaining reference to the spec folders at the new permanent pages, and record
that `bank` is implemented.

- **`docs/agents/product.md`**:
  - Line ~58, the "Domain data ownership" bullet becomes: "every domain record belongs to
    exactly one user **or** organization", stored as logical references to Auth. Link
    `modules/auth/organizations.md#data-ownership` (or whatever anchor step 03 uses).
  - The module table (line ~25) changes `bank` from "Planned" to implemented.
  - The `### bank` section (line ~69) describes what exists and links `modules/bank.md`.
- **`docs/agents/backend/routes/bank.md`**:
  - The "source of truth" sentence (lines ~19–20) points at `modules/bank/` (and the bank
    hub) instead of the specs.
  - Replace the per-section spec pointers (lines ~101, 127, 140, 171, 205, 272, 341) with the
    matching `modules/bank/*.md` pages.
  - Add the PATCH / DELETE 404 on bills of archived providers, which is missing today.
- **`docs/agents/backend/routes.md`**: add the organization routes (served from
  `routes/auth.md`, see step 03) to the Auth entry. Say that the bank routes are complete.
- **`docs/agents/architecture/backend.md`** (line ~73): column detail for `bank` lives in
  `docs/agents/modules/bank.md` / `modules/bank/`. Drop "until the specs are folded". Add the
  `auth_organizations` / `auth_organization_memberships` rows to the owned-tables table if
  they're missing.
- **`docs/agents/architecture/frontend.md`**:
  - The `## Owner context (organizations)` link (line ~200) points at
    `../modules/auth/organizations.md`.
  - Keep only the cross-cutting parts here: the organization context in the URL, routing,
    `SECTIONS_CONTEXT`, the remembered context.
  - For the bank pages, link `../modules/bank/ui.md`.
  - Update the section-registry text, which still mentions only `/bank/accounts`, to list
    the Debts / Investments / Providers rows and the `/bank/bills` → Providers mapping.
- **`.claude/agents/data-access.md` and `.github/agents/data-access.agent.md`**: in the
  *User-or-organization-owned modules* section (line ~65), the reference becomes
  `docs/agents/product.md`, `docs/agents/modules/bank.md` and
  `docs/agents/modules/auth/organizations.md` (its `data-access` checks section). Drop the
  "issue #58 repoints this…" note. Make the same edit in both files; they differ only in
  frontmatter.
- **`.claude/agents/frontend.md` and `.github/agents/frontend.agent.md`**: they have no
  feature-spec links today (their `specs/` mentions are Jasmine paths and stay). Next to the
  "Domain modules (`bank`, …)" sentence, add a pointer saying that the bank UI is documented
  in `docs/agents/modules/bank/ui.md`. Edit both files identically.
- **Indexes**:
  - `AGENTS.md`: add `modules/bank.md` to the docs table, and the Bank module to any module
    list. Keep the `specs.md` hub link.
  - `docs/agents/index.md`: under Modules, add `Bank` (`modules/bank.md`) with its sub-pages,
    and `Organizations` (`modules/auth/organizations.md`) under Auth.
  - `docs/agents/summary.md`: the Modules entry (lines ~22–31) changes "`modules/auth.md` and
    `modules/mail.md` today" to include the bank hub and folder. Add a Bank bullet and an
    Organizations bullet.
  - `docs/agents/contributing.md`: add any reference to module docs that is needed. Make
    sure no feature-spec folder is referenced.
  - `docs/agents/folder-structure.md`:
    - the `modules/` row (line ~85) lists `bank.md` + `bank/` and `auth/organizations.md`;
    - the `backend/src/` table gains a `src/bank/` row pointing at `docs/agents/modules/bank.md`
      (and `src/core/` for the owner context, if it's missing);
    - the `specs/` row (line ~86) stays generic.

## Files to Change
- `docs/agents/product.md` — the ownership rule, bank status and bank section
- `docs/agents/backend/routes/bank.md` — repoint the spec links, add the bill 404 detail
- `docs/agents/backend/routes.md` — organization routes, completeness
- `docs/agents/architecture/backend.md` — repoint the bank column detail, add the org tables
- `docs/agents/architecture/frontend.md` — repoint the org link, link `modules/bank/ui.md`, update the section registry
- `.claude/agents/data-access.md` — repoint the reference
- `.github/agents/data-access.agent.md` — the same edit
- `.claude/agents/frontend.md` — bank UI doc pointer
- `.github/agents/frontend.agent.md` — the same edit
- `AGENTS.md` — list the bank module docs
- `docs/agents/index.md` — list the bank pages and organizations
- `docs/agents/summary.md` — list the bank pages and organizations
- `docs/agents/contributing.md` — verify and adjust module doc references
- `docs/agents/folder-structure.md` — `modules/` and `src/bank/` rows
