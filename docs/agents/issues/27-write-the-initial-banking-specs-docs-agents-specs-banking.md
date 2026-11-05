# Issue: Write the initial banking specs (docs/agents/specs/banking/)

## Description

Part of Epic [#26](https://github.com/darthjee/ward/issues/26) (Bank module). Ward's first domain
module, `bank` (lazy tier), tracks bank accounts, business expenses for the accountant and bills
to pay, scoped to **organizations**. The feature follows the spec lifecycle in
`docs/agents/specs.md`: specs are written first, refined by enhancement sub-issues
(#28–#33), then implemented, folded into the permanent docs and removed.

This is the **first** sub-issue: it creates the spec folders every other sub-issue builds on. It
records **only what is already decided** and leaves a clearly marked place for everything else.

Depends on: nothing — this goes first.

## Problem

The enhancement sub-issues #28–#33 need a shared spec skeleton to refine, and they must be able
to run in parallel without editing the same files. No `docs/agents/specs/banking/` or
`docs/agents/specs/auth/` folder exists yet, and `docs/agents/specs.md` lists no active spec.

## Expected Behavior

- `docs/agents/specs/banking/` and `docs/agents/specs/auth/` exist with the layout below, every
  file following the `docs/agents/specs.md` conventions (ending with **Reference** — GitHub web
  URLs only — and **Required tests** sections).
- Decided facts are written as decisions; everything else is a stub owned by exactly one
  sub-issue, with its open questions as a checklist and a **Required tests** section reading
  `TBD — defined by #NN`.
- *Active specs* in `docs/agents/specs.md` lists both `banking` and `auth` (Epic #26), replacing
  "None.".

## Solution

### Decided facts (written as decisions, entity names fixed now)

- `Organization` — a new entity owned by the `auth` module (same module as `User`).
- `OrganizationMembership` — many-to-many user ↔ organization, with a `role` of `owner`, `admin`
  or `user`. These are organization roles, distinct from Ward's global admin role
  (`User.role` / `@AdminOnly()`).
- An organization is created automatically for each new user.
- Bank data is scoped to organizations. This changes the "every domain record belongs to exactly
  one user" rule in `product.md` — the change is only **announced** here; #28 specifies it and
  the fold issue applies it.
- `Account` with a `type`: `regular`, `debt`, `investment`, `provider_expense`.
- The main accounts list shows `regular` accounts only; debt and provider-expense accounts are
  seen in their own place.
- The **Bank** menu: **Accounts** (regular only), a place for **debt / provider-expense
  accounts** (exact split decided later), and a **Calendar** of upcoming bills.
- The folder is named `banking`; the module is `bank` — stated once at the top of the banking
  `README.md`.

### Spec folder layout

Each file has a single owning sub-issue, so #28–#33 can run in parallel.

```
docs/agents/specs/auth/
├── README.md                 #27 — overview of the auth feature (organizations), index
└── organizations.md          #27 skeleton → #28 (roles, auto-org, invites, active org,
                              backfill, data-ownership rule)

docs/agents/specs/banking/
├── README.md                 #27 — overview, decisions, index, sub-issue → file map,
│                             implementation order, link to specs/auth/
├── accounts/
│   ├── README.md             #27 — Account + `type`, common concepts,
│   │                         "main list = regular only"
│   ├── regular.md            #29 — regular accounts + common fields
│   ├── transactions.md       #29 — ledger / balances
│   ├── debt.md               #30
│   ├── investment.md         #31
│   └── provider-expense.md   #32 — incl. business expenses for the accountant
├── bills.md                  #33 — bill entity, recurrence, paying
└── ui/
    ├── menu.md               #27 — Bank menu + submenu list (each sub-issue edits only its
    │                         own row)
    └── calendar.md           #33
```

- **Banking `README.md`** — purpose, scope of the bank module, the decisions above, a file index,
  the sub-issue → file map (#28–#33, plus the future implementation / fold / remove issues), a
  link to `specs/auth/` as a dependency, and the **rough implementation order**: organizations
  first, then accounts (and their types), then bills and the calendar. The actual implementation
  sub-issues are created later by the *Continue* split of #26.
- No separate `api/` or `security.md` yet: each concern file holds its own routes, permissions
  and cache class; they can be split out later.
- The fold/remove sub-issues of #26 handle both folders (`organizations.md` folds into
  `docs/agents/modules/auth/`).

### Open questions to list in the stubs

- Organization role permission matrix; number of owners; leaving/deleting an organization (#28).
- Whether investment accounts appear in the main accounts list (#31).
- Whether debts and provider-expense accounts share one submenu or get one each (#30/#32,
  `ui/menu.md`).
- Whether bills are standalone or generated by debt/provider accounts (#33).
- Currency handling; categories (#29).

### Out of scope

- Fields (beyond the names above), routes, DTOs, permission matrices, cache classes — these
  belong to #28–#33.
- Editing `product.md` or `AGENTS.md`.
- Any code, migration or frontend change.

### Alternatives considered

- **A single `banking.md` file** — rejected: #28–#33 run in parallel and would all edit the same
  file; the spec convention prefers files split by concern.
- **#27 writes the full specs at once** (fields, routes, permissions) — rejected: one huge PR
  deciding everything without per-topic discussion.
- **Skipping specs and writing straight into `modules/bank.md`** — rejected: breaks the spec
  lifecycle; permanent docs would describe things that don't exist yet.
- **Organizations inside `specs/banking/`** — rejected: they belong to `auth` and other modules
  will reuse them.
- **Splitting by layer** (`api/`, `security.md`, `ui/` for everything) — rejected for now: every
  enhancement issue would touch every file.
- **No organizations (keep user-owned data)** — rejected: contradicts the vision of shared
  organizations with roles.

## Benefits

- Gives #28–#33 a stable skeleton with one owner per file, so they can be refined in parallel.
- Keeps each decision small and reviewable in its own enhancement issue.
- Fixes entity names and the module/folder naming up front, avoiding drift across sub-issues.
