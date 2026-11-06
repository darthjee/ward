# Realign debt.md

Ownership-only changes; the debt model (fields, sign rules, shortcuts) stays as #30 decided.

- **Summary**: "It belongs to an organization …, never directly to a user" → "It inherits the
  owner from its account (Personal or an organization), see
  [regular.md](regular.md#data-sensitivity--ownership)".
- **Debts submenu UI** intro: "under the active organization, `/orgs/:orgId/bank/debts…`" →
  "under the active context, `<ui>/debts…` (see
  [regular.md](regular.md#routes-and-permissions))".
- Headings → `### List` / `### Detail` / `### Create / Edit` with the path (`<ui>/debts`,
  `<ui>/debts/:accountId`, `<ui>/debts/new`, `<ui>/debts/:accountId/edit`) on the first line.
- Links `regular.md#detail--orgsorgidbankaccountsaccountid` (two places) → `regular.md#detail`.
- **Routes**: "All routes live under `/api/orgs/:orgId/bank`" → "same base path as
  [regular.md](regular.md#routes-and-permissions)".
- **Permissions and caching**: misses list adds "another owner's or wrong-context ids";
  "every member … can do everything" qualified "in an organization context"; bodies never
  accept `userId`, `organizationId`, `accountId`, `type` on PATCH, computed fields (drop
  `createdByUserId`).
- **Data sensitivity & ownership**: "Debts belong to the organization; every member can see and
  edit them" → "Debts inherit the owner from their account; access follows
  [regular.md](regular.md#data-sensitivity--ownership)".
- **Owning module**: `bank_debt_details` "carries no `organization_id` of its own — the
  organization comes from the account" → "carries no owner columns — the owner comes from the
  account"; `@OrgScoped()` → `@OwnerScoped()`.
- **Edge case 1** (Name uniqueness across types): "unique within the organization" → "unique
  within its owner (Personal or an organization)".
- **Reference**: `@OwnerScoped()` / #40 line.
- **Required tests**: "other-organization `:accountId`" → "another owner's or wrong-context
  `:accountId`"; add one line "debt routes follow the
  [regular.md owner-context matrix](regular.md#required-tests) in both contexts"; frontend
  wrong-type deep links use `<ui>/accounts/:id` / `<ui>/debts/:id`; pages render in both
  contexts.

## Files to Change
- `docs/agents/specs/banking/accounts/debt.md` — the sections above.
