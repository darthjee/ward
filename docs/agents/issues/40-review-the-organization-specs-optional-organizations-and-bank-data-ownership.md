# Issue: Review the organization specs: optional organizations and bank data ownership

## Description

Part of Epic #26 (Bank module). The banking specs under `docs/agents/specs/banking/` and the organization spec `docs/agents/specs/auth/organizations.md` (defined by #28) currently make organizations **mandatory**: every new user gets an auto-created organization, and all bank data is organization-scoped (`/api/orgs/:orgId/bank/...`).

This sub-issue **revisits that decision**: organizations become **optional**, and bank data can belong either to a user (personal) or to an organization. It is documentation-only — no code.

## Problem

Requiring an organization for every user adds weight to the most common case (one person tracking their own finances) and forces an auto-created organization on every account. The specs need a more flexible ownership model before the remaining spec work and the implementation proceed.

## Expected Behavior

- **Optional organizations**: no organization is auto-created at registration; users create organizations later. Belonging to zero organizations is the normal state, not an edge case.
- **Single owner per record**: every bank record (account) has **exactly one owner — either a user or an organization**, never both (two nullable logical references `user_id` / `organization_id` on `bank_accounts`, with a check constraint that exactly one is set). Child records (transactions, type-specific details) inherit the owner from their account.
- **Routes**: personal bank routes (`/api/bank/...`, UI `/bank/...`) alongside organization routes (`/api/orgs/:orgId/bank/...`, UI `/orgs/:orgId/bank/...`), served by the same logic resolving an owner context.
- **UI**: a context switcher (Personal / each organization) replaces the organization-only switcher.
- **Rules**: the data-ownership rule ("every domain record belongs to exactly one user") becomes "belongs to exactly one user or organization"; account-name uniqueness is per owner; permissions for personal data are owner-only, organization data keeps the #28 membership rules.
- **Out of scope** (Future epic candidates): moving an account between owners; sharing a personal record with an organization.

## Solution

### Ownership model

- Only **`bank_accounts`** stores the owner: `user_id` / `organization_id`, both nullable, with a
  DB check constraint that **exactly one** is set. Both are **logical** references to `auth` (no
  physical FK across module tables) and are indexed.
- Child records (transactions, `bank_debt_details`, `bank_investment_details`, …) **inherit the
  owner through their account** and never store their own copy, so they cannot drift.

### Registration and organization creation

- Registration **no longer creates** an organization or membership — it touches only `users`.
- Users create organizations later through `POST /orgs.json`, from the **"Create organization"**
  entry in the context switcher.

### Routes and owner context

- One `core` decorator, **`@OwnerScoped()`**, replaces `@OrgScoped()` for `bank`. It is backed by
  a DI token implemented by `auth` (same pattern as `SESSION_LOOKUP`) and resolves the
  `OwnerContext` for both prefixes:
  - personal: API `/api/bank/...`, UI `/bank/...`;
  - organization: API `/api/orgs/:orgId/bank/...`, UI `/orgs/:orgId/bank/...`.
- The `bank` controllers are mounted under **both** prefixes and serve the same logic.

### UI context switcher

- The switcher lists **Personal** plus each of the user's organizations, and a "Create
  organization" entry; selecting one navigates to that context's URL.
- After login (no context in the URL), the UI opens the **last used context**, remembered in the
  browser; otherwise **Personal**.

### Security and data sensitivity

- **Authentication**: every personal and organization bank route requires the JWT guard (only
  `approved` users, as today).
- **One owner-context guard** resolves the owner per request:
  - personal route → the owner is the current user from the JWT, never from the URL or body;
  - organization route → the existing membership check on `:orgId` (non-member → 404).
  Services only ever receive this `OwnerContext`, never a raw id, so every query is filtered by
  owner.
- **`user_id` means owner, never creator**: an organization record has `user_id = NULL` even
  though a member created it, so a personal query on `user_id = me` can never leak organization
  records. No `created_by` column (audit/authorship is out of scope).
- **Responses never expose owner fields** (`user_id` / `organization_id`): the context is implied
  by the route, and other users' ids are never leaked.
- **Personal data is private to its owner**: never visible to organization members (even of an
  organization the user belongs to), nor to the global `is_admin`.
- **Uniform 404**: unknown id, wrong context and non-member all answer 404 with identical bodies
  — no disclosure of whether a record or organization exists.
- **No client-supplied owner**: owner fields in the body are rejected by the whitelist
  `ValidationPipe`.
- **Caching**: personal routes carry **no owner in the URL**, so a shared cache would serve one
  user's data to another — they must be `user-scoped` and send `X-Skip-Cache`, no exception.
  Organization routes stay `user-scoped` too.
- **XSS**: unchanged — names and notes are always rendered escaped.
- **`data-access` checks** for user-or-organization-owned modules: every query is filtered via
  the `OwnerContext`; personal queries use only the JWT user; organization routes verify
  membership; no owner fields are read from input or written to output.

### Edge cases

**Contexts and membership**

- **Zero organizations** is the normal case: the user lands in the **Personal** context; the
  switcher shows only Personal plus "Create organization".
- **Pending user**: nothing is created at registration; they cannot log in until approved, so
  they reach nothing.
- **Denied user**: personal bank data is kept but unreachable (no cleanup); organization data
  they created belongs to the organization and outlives them (as in #28).
- **Global admin** (`is_admin`): no access to anyone's personal bank data, nor to any
  organization's data.
- **Stale remembered context** (e.g. the organization now returns 404): the UI forgets it and
  falls back to **Personal** (replacing #28's "first organization by creation date").

**Addressing records**

- Personal routes never carry a user id: personal always means the **current user**, so another
  user's personal data cannot be addressed; someone else's account id → **404**.
- **Wrong context**: an organization account's id on a personal route, or a personal account's
  id on an organization route → **404** — records are looked up only inside the active owner
  context, with the same body as an unknown id.
- **Owner fields in the body** (`user_id`, `organization_id`) are never accepted: the owner
  always comes from the route; unknown fields are rejected by the whitelist `ValidationPipe`.
- A record with **both owners or neither** cannot exist: a DB check constraint enforces exactly
  one, and the API never builds one.
- **Child records** (transactions, type-specific details) are reached only through their account
  in its context; a mismatch → 404.

**Cross-owner**

- The **same account name** in Personal and in an organization is allowed (uniqueness is per
  owner).
- Moving money between a personal account and an organization account is **two manual
  transactions**, as for any two accounts.
- **Leaving an organization** (once joining/leaving exists): the user loses access to its data;
  their personal data is unaffected.

**Deferred**: what happens to personal bank data if user deletion is ever added is left to a
future decision (Ward has no user deletion today).

### Sequencing

- Runs first. The follow-up sub-issue that aligns the finished banking specs depends on it.
- #32 (provider-expense accounts) and #33 (bills and the calendar) wait until this lands.
- Agents: architect (documentation); consult `product-owner`.

### Scope

**In (this issue)** — the ownership contract, defined once so the follow-up sub-issue only applies it:

- `docs/agents/specs/auth/organizations.md` rewrite:
  - organizations become optional — remove the "Auto-created organization" section and the
    registration-atomicity edge case; zero organizations is the normal state;
  - "Active organization" becomes an **active context** (Personal or an organization);
  - "Data ownership" gains the **user-or-organization-owned** module kind and its `data-access`
    checks;
  - the guard / owner-context contract (`core` token, decorator) is updated;
  - Required tests are updated accordingly;
  - the organization entities and `/orgs` routes stay as they are.
- Banking `docs/agents/specs/banking/README.md`:
  - rewrite the "Bank data is scoped to organizations" decision;
  - add a short bank-level ownership contract: two logical owner columns with an exactly-one
    check, personal (`/api/bank/...`) and organization (`/api/orgs/:orgId/bank/...`) route
    prefixes, per-owner name uniqueness;
  - add this issue's sub-issue map row;
  - note that the specs from #29–#31 are realigned by the follow-up sub-issue (#41), and that #32 / #33
    wait for this issue;
  - add Future epics: "move an account between owners" and "share a personal record with an
    organization".
- `docs/agents/specs/auth/README.md`: index entry, if present.

**Placement**: the generic rule (a module may be user-or-organization-owned; the guard) lives in
`auth/organizations.md`; the bank-specific contract (column names, route prefixes) lives in the
banking README, so `auth` never knows bank details.

**Out of this issue (done by #41)**: per-spec edits — `accounts/README.md`, `regular.md`,
`transactions.md`, `debt.md`, `investment.md`, `ui/menu.md`. Until #41 lands, those specs are
knowingly inconsistent; the README note flags it.

**Out entirely**:

- other modules (`protocol`, `car-performance`, `links`) stay **user-owned only**; only `bank`
  becomes user-or-organization-owned, and each module page states its kind;
- the already-deferred permission system, joining, closing and organization-creation rate limit;
- moving an account between owners and sharing (Future epics);
- editing `product.md` / `.claude/agents/data-access.md` (done when the specs are folded, per
  `specs.md`);
- any backfill.

## Benefits

- Solo users can use the bank module without creating an organization.
- Organizations remain available for shared finances, with a clear single-owner rule.
