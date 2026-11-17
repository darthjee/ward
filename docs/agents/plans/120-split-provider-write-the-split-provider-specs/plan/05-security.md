# Write security.md

Record the settled data sensitivity & ownership and performance & security decisions, using the
`security` and `data-access` findings from step 01.

- **Data sensitivity & ownership** — provider bills are personal financial data inheriting the
  owner through the provider account; personal context: owner only; global admin: no access;
  organization (`/orgs/:orgId/bank`): every member full read / write until #81 (roles stored, not
  enforced — `modules/auth/organizations.md`), no new role logic; owner / org id never taken from
  the body.
- **Exposure** — `source_bill` carries only `{ id, description }` of the caller's own bill;
  `notes` never in occurrence payloads; full `ProviderBill` fields only on the provider-bills
  routes.
- **Performance & security decisions** (confirmed or revised): owner-scoped uniform `404` via
  `ProviderBillResolver` (reusing the `BillService.findOwned` pattern); recurring bills locked to
  their provider (`409 PROVIDER_BILL_PROVIDER_LOCKED`), one-offs movable unless paid with the
  target provider resolved owner-scoped (uniform `404` / generic `422`); `:dueDate` validated
  per bill (`404` otherwise) and `FOR UPDATE` lock on the bill row; `paying_account_id` through
  `PayingAccountResolver` (generic `422`, `CURRENCY_MISMATCH`); the 50-recurring cap; the
  366-day / 1000-occurrence caps checked on occurrences; single-query calendar / overdue load
  (`provider_account_id IN (…) AND kind = 'recurring'`, `registry.loadDetails()` batching as the
  model, no N+1); the indexes from `model.md`.
- **Reference** and **Required tests** — `provider-bill.resolver.spec.ts` (uniform `404`
  matrix), the e2e `404` matrix over both base paths, the `:dueDate` not-an-occurrence `404`,
  the cap and lock conflicts, a cross-owner / cross-org denial case.

## Files to Change

- `docs/agents/specs/split-provider/security.md` — new.
