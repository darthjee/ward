# Owner-scoped resolvers

Add `ProviderBillResolver`, the bill-id counterpart of `bill-source.resolver.ts`, following the
`BillService.findOwned` pattern:

- **`resolve(owner, id, manager?)`.** Load the bill by id with any `kind`. Then load its provider
  with `{ ...accountOwnerWhere(owner), id: bill.providerAccountId, type: PROVIDER_TYPE,
  archivedAt: IsNull() }`. Return `{ bill, provider }`.
  - With a manager, lock the bill `pessimistic_write`. Update and delete need this.
  - Unknown, foreign or other-context ids, archived providers, and a bill whose provider is not
    `provider_expense` all throw the same `ownerNotFound()`, with an identical body.
  - Malformed ids are rejected earlier by `parseId`.
- **`provider(owner, accountId, { allowArchived }, manager?)`.** Resolves the nested `:accountId`
  as an owned `provider_expense` account. Archived accounts are allowed for list and rejected for
  create, with a `409 ACCOUNT_ARCHIVED` after the owner check. Debt, regular, unknown or foreign
  accounts give the uniform `404`.
- **Move targets.** The same method, without `allowArchived`, also resolves the target provider
  when a one-off is moved. The caller chooses the not-found error: `404` for provider-bills, `422`
  for `bills.json`.

Register the resolver in `BankModule` (providers and exports).

**Tests.** `backend/src/bank/tests/provider-bill.resolver.spec.ts` (new) covers the uniform `404`
matrix with identical bodies: unknown, foreign, other context (personal vs org), archived provider,
and a debt account id for the nested resolver. It also covers the happy path for both kinds.

## Files to Change
- `backend/src/bank/provider-bill.resolver.ts` (new)
- `backend/src/bank/bank.module.ts` — provide and export the resolver.
- `backend/src/bank/tests/provider-bill.resolver.spec.ts` (new)
