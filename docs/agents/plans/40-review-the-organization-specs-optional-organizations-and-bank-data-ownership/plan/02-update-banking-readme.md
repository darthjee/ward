# Update the banking README

Update `docs/agents/specs/banking/README.md` so it carries the bank-specific ownership contract.
The generic rule from step 01 is linked, not duplicated.

- **Purpose and scope**: replace "All bank data is scoped to **organizations**" with: bank data
  belongs to exactly one owner, either the user (personal) or an organization. Organizations
  stay specified in `specs/auth/` and are still implemented before any bank entity, because
  `@OwnerScoped()` and the organization routes are needed.
- **Decisions**: rewrite the "Bank data is scoped to organizations" bullet as "Bank data is
  user-or-organization-owned", linking
  [auth/organizations.md#data-ownership](../auth/organizations.md#data-ownership). Note that
  #40 revised the rule from #28 and that the fold applies it to `product.md`.
- **Add a "Bank ownership contract" section** (short, after Decisions):
  - Only `bank_accounts` stores the owner: `user_id` and `organization_id` are both nullable,
    logical references to `auth` (no physical FK) and indexed. A DB check constraint requires
    exactly one of them to be set.
  - Child records (transactions, `bank_debt_details`, `bank_investment_details`, and later
    provider-expense and bill records) inherit the owner through their account and never store
    a copy.
  - Route prefixes:
    - personal: API `/api/bank/...`, UI `/bank/...`;
    - organization: API `/api/orgs/:orgId/bank/...`, UI `/orgs/:orgId/bank/...`.
    The `bank` controllers are mounted under both prefixes, apply `@OwnerScoped()`, and serve
    the same logic.
  - Account-name uniqueness is **per owner**: the same name in Personal and in an organization
    is allowed.
  - Moving money between a personal account and an organization account takes two manual
    transactions.
  - Responses never contain `user_id` or `organization_id`. A wrong context returns 404.
  - All bank routes are `user-scoped` and send `X-Skip-Cache`.
- **Add a realignment note** (a short callout near the top or under the contract):
  - the specs written by #29–#31 (`accounts/README.md`, `regular.md`, `transactions.md`,
    `debt.md`, `investment.md`, `ui/menu.md`) still describe organization-only scoping and are
    knowingly inconsistent until the follow-up
    [#41](https://github.com/darthjee/ward/issues/41) realigns them;
  - #32 and #33 wait for this issue.
- **Sub-issue map**: add a #40 row covering `auth/organizations.md` (optional organizations,
  active context, user-or-organization-owned rule, `@OwnerScoped()`), this `README.md`
  (decision, ownership contract, note, Future epics) and `auth/README.md`. Add a #41 row for
  the per-spec realignment of the files listed above.
- **Implementation order**: step 1 becomes "Organizations and the owner-context guard
  ([specs/auth/](../auth/README.md))".
- **Future epics**:
  - Reword entry 3 (Closing): closing no longer "makes the zero-organizations state
    reachable", because zero organizations is now the normal state. Keep the open question
    about the organization's data.
  - Add two new entries:
    - **Move an account between owners** (from this README's ownership contract): reassign an
      account and its children from Personal to an organization or back. It must keep the
      exactly-one-owner check and per-owner name uniqueness.
    - **Share a personal record with an organization** (same source): give organization
      members access to a personal record without changing its owner. It must keep "personal
      data is private" as the default, and keep owner fields out of responses.
- **Reference**: add the #40 and #41 issue URLs to the sub-issues list.

## Files to Change
- `docs/agents/specs/banking/README.md` — rewritten scope and decision, new ownership
  contract, realignment note, #40/#41 map rows, two new Future epics, reworded Closing epic
