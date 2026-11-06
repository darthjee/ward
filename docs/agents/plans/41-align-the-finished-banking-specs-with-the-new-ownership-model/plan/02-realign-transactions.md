# Realign transactions.md

Link to `regular.md` for the shared rules instead of restating organization scoping.

- **Ledger**: "Transactions belong to an `Account` …, and so to its organization" → "… and
  inherit its owner (see the [Bank ownership contract](../README.md#bank-ownership-contract))".
- **Transaction entity**: remove the `organizationId` row (a child record never stores the
  owner — this was missed by the issue text but contradicts the contract) and the
  `createdByUserId` row.
- **Routes** intro: "under `/api/orgs/:orgId/bank`, through `@OrgScoped()`" → "same base path as
  [regular.md](regular.md#routes-and-permissions) (`<base>`, both contexts)"; "every member can
  do everything" → "owner-based permissions".
- Transactions: "account of another organization" → "account of another owner, or of the other
  context" → 404. "Bodies never accept" → `accountId`, `userId`, `organizationId` or computed
  fields (drop `createdByUserId`).
- UI link `regular.md#detail--orgsorgidbankaccountsaccountid` → `regular.md#detail`.
- **Settings**: served under both prefixes with the same `default_currency`; a non-member on an
  organization route → 404. "Kept organization-scoped" → "Kept owner-scoped (rather than a
  public route) so every bank route follows the ownership contract with no exception".
- **Performance & integrity**: no-rate-limit reason → "authenticated users acting in their own
  context".
- **Alternatives considered**: "organization-scoped `settings.json`" → "owner-scoped".
- **Reference**: `@OwnerScoped()` / #40 line as in step 01.
- **Required tests**:
  - validation line: `accountId` / `userId` / `organizationId` in the body rejected (drop
    `createdByUserId`);
  - 404 line: "of another owner, through an account of the other context, or an unknown /
    non-numeric id → 404 with identical bodies; a non-member `:orgId` → 404";
  - transaction routes work in both contexts;
  - `settings.json` under both prefixes returns the same default; non-member → 404;
  - remove "`created_by_user_id` absent from every response" (owner fields never in responses
    are covered by the `regular.md` matrix — add a pointer).

## Files to Change
- `docs/agents/specs/banking/accounts/transactions.md` — the sections above.
