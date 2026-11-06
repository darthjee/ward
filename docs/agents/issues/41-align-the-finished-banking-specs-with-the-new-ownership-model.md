# Issue: Align the finished banking specs with the new ownership model

## Description

Part of Epic #26 (Bank module). Once the organization specs are revised so that organizations are **optional** and every bank record belongs to **exactly one owner — either a user or an organization** (defined by #40, merged as PR #42), the banking specs already written under the old, organization-only model must be realigned. It is documentation-only — no code.

## Problem

The specs from #29 (regular accounts and transactions), #30 (debt accounts) and #31 (investment accounts) assume all bank data is organization-scoped: routes under `/api/orgs/:orgId/bank/...`, UI under `/orgs/:orgId/bank/...`, account-name uniqueness per organization, and organization-membership permissions. These no longer match the new ownership model.

## Expected Behavior

- These specs are updated to the ownership, route, permission and uniqueness rules decided in the organization review:
  - `docs/agents/specs/banking/accounts/README.md`
  - `docs/agents/specs/banking/accounts/regular.md`
  - `docs/agents/specs/banking/accounts/transactions.md`
  - `docs/agents/specs/banking/accounts/debt.md`
  - `docs/agents/specs/banking/accounts/investment.md`
  - `docs/agents/specs/banking/ui/menu.md`
- Each spec covers both personal (`/api/bank/...`) and organization (`/api/orgs/:orgId/bank/...`) routes, owner-based uniqueness and permissions, and keeps its **Reference** and **Required tests** sections.
- The banking `README.md` index entries and sub-issue map rows reflect the updated files, the
  "Realignment pending" note is removed, and the #27 stubs (`accounts/provider-expense.md`,
  `bills.md`) no longer state the organization-only rule (one line each).

## Solution

- Walk each listed spec and replace organization-only assumptions (scoping, routes, UI paths, uniqueness, permissions, cache notes) with the owner-context rules from the organization review.
- No change to the type-specific decisions of #29–#31 beyond ownership.

### Approach

**Per-spec edits with two sources of truth:**

- the banking README **"Bank ownership contract"** — the bank-level rule (columns, check
  constraint, prefixes, per-owner uniqueness), as placed by #40;
- **`regular.md`** — the operational details every account type reuses (`<base>` / `<ui>`,
  Rules, Data sensitivity, the owner-context test matrix);
- `transactions.md`, `debt.md`, `investment.md` only link to those two, following the existing
  hub pattern (type specs reuse `regular.md`).

Rejected: a new `banking/ownership.md` (duplicates or moves the README contract, reopening #40's
placement — a third place to keep in sync); self-contained specs restating the rules (the drift
risk #29–#31 avoided).

### Scope

**In:**

- The six specs: `accounts/README.md`, `accounts/regular.md`, `accounts/transactions.md`,
  `accounts/debt.md`, `accounts/investment.md`, `ui/menu.md`.
- Banking `README.md`: remove the **"Realignment pending"** note, replacing "#32 / #33 wait for
  #40" with "#32 / #33 are written against the realigned specs (after #41)", and update the index
  entries and the #41 sub-issue map row.
- The two #27 stub lines that still state the old rule — one line each, nothing else in those
  stubs:
  - `accounts/provider-expense.md` ("It belongs to an organization") and `bills.md` ("Bills
    belong to an organization") → "inherits the owner from its account".
- `ui/menu.md`: one short line — the menu is the same in every context (Personal or an
  organization) and its links resolve under the active context's prefix. The switcher itself
  stays specified in `auth/organizations.md`.

**Out:**

- `auth/organizations.md` and the banking README "Bank ownership contract", already settled by #40.
- `product.md` / `.claude/agents/data-access.md` (done at fold time, per `specs.md`).
- The type-specific decisions of #29–#31.
- The full specs of #32 (provider-expense accounts) and #33 (bills and the calendar).

### Drop `createdByUserId`

#29 added a `createdByUserId` audit field (stored, never returned) that contradicts #40's rule in
`auth/organizations.md` ("the user reference means owner, never creator … **no `created_by`
column**"). It is **dropped everywhere**:

- `regular.md` and `transactions.md`: remove the `createdByUserId` field rows, the
  Data-sensitivity bullet, the logical-reference mention (`created_by_user_id`) and the
  "`created_by_user_id` absent" test lines.
- `regular.md`, `transactions.md`, `debt.md`, `investment.md`: the "bodies never accept" lists
  and their tests drop `createdByUserId` and reject both **owner fields** (`userId`,
  `organizationId`), which always come from the route.
- Banking `README.md`: add a Future epic **"Authorship / audit trail"** — record which member
  created or changed a record in an organization, without changing the single-owner rule.

### Name uniqueness per owner

The #29 index `(organization_id, active_name_key)` breaks under nullable owners: every personal
account has `organization_id = NULL`, and NULLs never clash, so two active personal accounts
could share a name. Ward runs MySQL (no partial indexes), so:

- **Two unique indexes** replace the single one, reusing the `active_name_key` generated column:
  - `(user_id, active_name_key)` — uniqueness among personal accounts (organization rows have
    `user_id = NULL`, so they never clash);
  - `(organization_id, active_name_key)` — uniqueness among organization accounts.
  They also serve as the owner lookup indexes the ownership contract requires.
- The rest of the rule is unchanged: case-insensitive, among **active** accounts of any type,
  archived names free, a duplicate maps to **409** on create, rename and unarchive.
- Wording: "unique within its organization" → "unique within its owner (Personal or an
  organization)" in `regular.md`, and the restated rule in `debt.md` / `investment.md`
  ("Name uniqueness across types").
- Tests: duplicates clash within Personal and within one organization; the same name is allowed
  in Personal vs an organization and in two different organizations.

### Routes and UI paths

Route tables already use relative paths (`/accounts.json`, …) under a base path stated once per
spec; only the base-path sentences and the UI page headings hard-code `/orgs/:orgId/...`.

- `regular.md` "Routes and permissions" defines two placeholders, **once**, linking to the
  README "Bank ownership contract":
  - **`<base>`** — `/api/bank` (personal) or `/api/orgs/:orgId/bank` (organization);
  - **`<ui>`** — `/bank` (personal) or `/orgs/:orgId/bank` (organization).
  The same controllers serve both prefixes through **`@OwnerScoped()`** (replacing
  `@OrgScoped()`, including the "Depends on `auth` only through …" line).
- UI headings become `<ui>/accounts`, `<ui>/accounts/:accountId`, `<ui>/debts…`,
  `<ui>/investments…`; "All pages live under the active organization" → "under the active
  context".
- `transactions.md`, `debt.md`, `investment.md` say "same base path as
  [regular.md](regular.md#routes-and-permissions)" instead of repeating `/api/orgs/:orgId/bank`.
- Route tables stay unchanged. UI links are built relative to the active context, so every page
  works in either context.

### Permissions and data sensitivity

The rules were settled by #40; `regular.md` "Data sensitivity & ownership" stays the bank-wide
source and the other specs link to it.

- **`regular.md` "Who sees and edits"** is rewritten:
  - **Personal** — only the owner, taken from the JWT, never from the URL or body; never
    visible to organization members (even of an organization the owner belongs to);
  - **Organization** — only its members, all with equal rights while roles are not enforced;
  - Ward's global `is_admin` has access to neither.
- **"404, never 403"** adds the **wrong context** (an organization account on a personal route,
  or the reverse) → 404 with the same body as an unknown id or a non-member.
- **Responses never contain owner fields** (`user_id`, `organization_id`) — an explicit rule
  bullet, replacing the old `createdByUserId` "never expose other users' ids" reason.
- **Caching** states its reason: personal routes carry no owner in the URL, so they **must** stay
  `user-scoped` with `X-Skip-Cache`, no exception; none goes into Navi's warm-up.
- **`debt.md` / `investment.md`**: "belong to the organization; every member can see and edit
  them" → "inherit the owner from their account; access follows
  [regular.md](regular.md#data-sensitivity--ownership)"; "every member can do everything" is
  qualified "in an organization context".
- **`transactions.md`**: "account of another organization" → "account of another owner"; the
  no-rate-limit reason → "authenticated users acting in their own context".
- **Unchanged**: no credentials stored, account number unencrypted but masked in lists, bodies
  never logged, XSS escaping.

### Edge cases

- **Stable anchors** — renaming UI headings to `<ui>/...` would silently break links such as
  `regular.md#detail--orgsorgidbankaccountsaccountid` (used by `debt.md`, `investment.md`,
  `transactions.md`). UI headings become plain names (`### List`, `### Detail`,
  `### Create / Edit`) with the path on the first line below, and every existing link is updated
  to the new anchors. No docs CI exists, so links are checked manually.
- **Switching context on a page** — the switcher lands on the **same section's list** in the new
  context (Accounts / Debts / Investments), never the same record id (which would 404). Stated in
  `ui/menu.md`.
- **Linked transfers across owners** — the *Linked transfers* Future epic entry gains: linked
  transfers only between accounts of the **same owner**; cross-owner stays two manual
  transactions.
- **`settings.json` in both contexts** — served under both prefixes, same `default_currency`; a
  non-member on an organization route → 404. Stated in `transactions.md`, with a test.
- **Zero organizations** — the bank menu and pages work fully in Personal; one line in
  `ui/menu.md`.
- Wrong context, foreign ids, owner fields in the body, `is_admin` and the stale context are
  already covered by #40 and the sections above.

### Required tests

`regular.md` holds the **full owner-context matrix**; the other specs add only what is specific
to their routes.

- **`regular.md`** (every account route):
  - each route works under both `/api/bank` and `/api/orgs/:orgId/bank`;
  - created on a personal route → owned by the current user; on an organization route → owned
    by that organization; owner fields never in any response;
  - `userId` / `organizationId` in the body → 400 (whitelist);
  - 404 with identical bodies for: unknown and non-numeric ids, another user's personal account,
    an organization account on a personal route, a personal account on an organization route,
    another organization's account, a non-member `:orgId`, a global admin who is not a member;
  - the personal list returns only the current user's personal accounts, never organization
    accounts (even of the user's own organizations);
  - name uniqueness per owner (see [Name uniqueness per owner](#name-uniqueness-per-owner));
  - DB: a row with both owners or neither is rejected by the check constraint;
  - the `createdByUserId` test lines are removed.
- **`transactions.md`**: transaction routes in both contexts; a transaction reached through an
  account of the other context → 404; `settings.json` under both prefixes returns the same
  default, non-member → 404.
- **`debt.md` / `investment.md`**: one line — their routes follow the `regular.md` matrix in both
  contexts; "other-organization `:accountId`" lines → "another owner's or wrong-context
  `:accountId`".
- **UI** (`regular.md`, `debt.md`, `investment.md`, `ui/menu.md`): pages render under both
  `/bank/...` and `/orgs/:orgId/bank/...` with links built from the active context; switching
  context lands on the same section's list; a user with zero organizations uses the whole bank
  module in Personal.

### Owning module, caching, compatibility

- `regular.md` "Owning module": still `bank` (lazy tier, no new module); depends on `auth` only
  through `@OwnerScoped()`; **References** list `user_id` and `organization_id` as logical (no
  cross-module FK), replacing `organization_id` / `created_by_user_id`.
- Caching is unchanged (`user-scoped` reads, `never` writes, nothing warmed by Navi); no memory
  impact; no backward-compatibility concern — documentation only, nothing is implemented yet.

### Sequencing

- #40 (the organization review) has landed (PR #42), so this issue is unblocked.
- **#41 runs next.** #32 (provider-expense accounts) and #33 (bills and the calendar) start only
  **after #41 lands**, so they are written directly against the realigned `regular.md`
  (placeholders, anchors, test matrix). Running them in parallel would collide on
  `provider-expense.md`, `bills.md`, `ui/menu.md`, the README rows and the anchors renamed here.
- #32 and #33 may run in parallel with each other (different files; README rows merge
  trivially).
- This issue does **not** cover #32 / #33 themselves.
- Agents: architect (documentation); consult `product-owner`.

## Benefits

- All finished banking specs agree with the new ownership model before implementation starts.
