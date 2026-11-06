# Realign investment.md

Same treatment as `debt.md`; the investment model stays as #31 decided.

- **Summary** (line ~17): "It belongs to an organization …" → inherits the owner from its
  account, link to [regular.md](regular.md#data-sensitivity--ownership).
- **Investments submenu UI** intro (~122): "under the active organization,
  `/orgs/:orgId/bank/investments…`" → "under the active context, `<ui>/investments…`".
- Headings (~127, ~138, ~147) → `### List` / `### Detail` / `### Create / Edit` with
  `<ui>/investments`, `<ui>/investments/:accountId`, `<ui>/investments/new`,
  `<ui>/investments/:accountId/edit` on the first line.
- Links `regular.md#detail--orgsorgidbankaccountsaccountid` (~111, ~140) → `regular.md#detail`.
- **Routes** (~161): "All routes live under `/api/orgs/:orgId/bank`" → "same base path as
  [regular.md](regular.md#routes-and-permissions)".
- **Permissions and caching** (~190–194): misses add "another owner's or wrong-context ids";
  permissions qualified "in an organization context"; bodies never accept `userId`,
  `organizationId`, `accountId`, `type` on PATCH, computed fields (drop `createdByUserId`).
- **Data sensitivity** (~203): "Investments belong to the organization; every member can see and
  edit them" → "inherit the owner from their account; access follows regular.md".
- **Owning module** (~211–212): `bank_investment_details` carries no owner columns;
  `@OrgScoped()` → `@OwnerScoped()`.
- **Edge cases**: name uniqueness (~233) → "within its owner"; wrong-type deep links (~243)
  `/bank/...` → `<ui>/...`.
- **Reference** (~269): `@OwnerScoped()` / #40 line.
- **Required tests**: (~304) "another owner's or wrong-context `:accountId`"; one line pointing
  to the regular.md owner-context matrix in both contexts; frontend deep links (~325) →
  `<ui>/...`; pages render in both contexts.

## Files to Change
- `docs/agents/specs/banking/accounts/investment.md` — the sections above.
