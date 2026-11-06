# Realign regular.md (the operational source of truth)

`accounts/regular.md` becomes the place every account type reuses for the owner-context rules.
Edit it first; the other specs link to its new anchors and placeholders.

**Summary**
- "It belongs to an organization … never directly to a user" → "It has exactly one owner —
  the user (Personal) or an organization — see the
  [Bank ownership contract](../README.md#bank-ownership-contract) and
  [auth/organizations.md](../../auth/organizations.md#data-ownership)".

**Common account fields**
- Replace the `organizationId` row with two rows, `userId` and `organizationId`: nullable,
  not editable, exactly one set (check constraint), taken from the route context (the JWT user
  on personal routes, `:orgId` on organization routes), never from the body, never returned.
- `name` row: "unique within the organization" → "unique within its owner (Personal or an
  organization)".
- Remove the `createdByUserId` row.

**Name uniqueness**
- Wording: "unique within its owner (Personal or an organization)".
- Replace the single index with **two unique indexes** on the existing generated column
  `active_name_key`: `(user_id, active_name_key)` (personal; organization rows have
  `user_id = NULL`) and `(organization_id, active_name_key)` (organization). Explain in one line
  why one index is not enough (personal rows have `organization_id = NULL`, NULLs never clash,
  MySQL has no partial indexes) and that these double as the owner lookup indexes the contract
  requires.
- Unchanged: case-insensitive, active accounts of any type, archived names free, 409 on create,
  rename, unarchive.

**Accounts submenu UI**
- Intro: "All pages live under the active organization, `/orgs/:orgId/bank/accounts…`" →
  "under the active context, `<ui>/accounts…` (see [Routes and permissions](#routes-and-permissions)
  for `<ui>`); links are built from the active context, so every page works in either context."
- Headings become plain names with the path on the first line below (stable anchors):
  - `### List` — first line: "`<ui>/accounts`";
  - `### Detail` — "`<ui>/accounts/:accountId`";
  - `### Create / Edit` — "`<ui>/accounts/new`, `<ui>/accounts/:accountId/edit`".

**Routes and permissions**
- Rewrite the intro: JWT-protected, `.json` suffix, served under two base paths, defined
  **once** here and linked to the README contract:
  - **`<base>`** — `/api/bank` (personal) or `/api/orgs/:orgId/bank` (organization);
  - **`<ui>`** — `/bank` (personal) or `/orgs/:orgId/bank` (organization).
  The same controllers serve both prefixes through **`@OwnerScoped()`**. Route tables stay
  relative (unchanged).

**Rules**
- "404, never 403": list every miss — unknown or non-numeric id, another user's personal
  account, another organization's account, a non-member `:orgId`, and the **wrong context**
  (an organization account on a personal route, or the reverse) — all 404 with identical bodies.
- New bullet: **Responses never contain owner fields** (`user_id`, `organization_id`).
- "Bodies never accept": `userId`, `organizationId`, `accountId`, `type` (on PATCH) or computed
  fields — drop `createdByUserId`; owner fields always come from the route.
- Permissions: "every member of the organization can do everything" → qualify "in an
  organization context, every member can do everything (roles stored, not enforced); in
  Personal, only the owner".
- Caching: add the reason — personal routes carry no owner in the URL, so they **must** stay
  `user-scoped` with `X-Skip-Cache`, no exception; none goes into Navi's warm-up.

**Data sensitivity & ownership**
- Rewrite "Who sees and edits":
  - **Personal** — only the owner, taken from the JWT, never from the URL or body; never visible
    to organization members (even of an organization the owner belongs to);
  - **Organization** — only its members, all with equal rights while roles are not enforced;
  - Ward's global `is_admin` has access to neither; every miss is a 404.
- Remove the `createdByUserId` bullet (no `created_by` column; authorship is a Future epic).
- Unchanged: never stored credentials, account number not encrypted / masked in lists, bodies
  never logged, XSS escaping.

**Owning module**
- "Depends on `auth` only through `@OrgScoped()`" → "`@OwnerScoped()`".
- References: "`user_id` and `organization_id` are logical (no cross-module FK)", replacing
  `organization_id` / `created_by_user_id`.

**Edge cases**
- "Unknown / foreign / non-numeric ids" → add "or wrong-context" → 404.

**Reference**
- Replace the `@OrgScoped()` line with "Organizations, `@OwnerScoped()`, data-ownership rule"
  linking #28, #40 and `auth/organizations.md`; add the README contract link.

**Required tests — the full owner-context matrix**
- Each account route works under both `/api/bank` and `/api/orgs/:orgId/bank`.
- Created on a personal route → owned by the current user; on an organization route → owned by
  that organization; owner fields never in any response (replaces the
  `created_by_user_id` absent lines in List / Detail).
- `userId` / `organizationId` in the body → 400 (whitelist) — replaces the
  `organizationId` / `createdByUserId` create line.
- 404 with identical bodies for: unknown and non-numeric ids, another user's personal account,
  an organization account on a personal route, a personal account on an organization route,
  another organization's account, a non-member `:orgId`, a global admin who is not a member.
- The personal list returns only the current user's personal accounts, never organization
  accounts (even of the user's own organizations).
- Name uniqueness per owner: duplicates clash within Personal and within one organization; the
  same name is allowed in Personal vs an organization and in two different organizations.
- DB: a row with both owners or neither is rejected by the check constraint.
- Frontend: pages render under both `/bank/...` and `/orgs/:orgId/bank/...` with links built
  from the active context; a user with zero organizations uses the Accounts pages in Personal.

## Files to Change
- `docs/agents/specs/banking/accounts/regular.md` — all sections above.
