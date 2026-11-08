# Implement `DebtAccountHandler`

Add `backend/src/bank/account-types/debt-account.handler.ts` implementing
`AccountTypeHandler` for `type = 'debt'` (`carriesLedger: true`), and register it.

- `validateCreate(nested, ctx)`: when `nested` is absent, use defaults (all null,
  `instalment_frequency` `monthly`). Otherwise check paired rules on the object itself:
  rate ↔ period together; `due_month` required iff `instalment_frequency` (default
  `monthly`) is `yearly`. Parse `instalment_amount` with `parseAmountInput('debt.instalment_amount', …)`
  against the resolved account currency, then require it `> 0` (the existing `nonZero` option
  doesn't reject negatives — add an explicit positive check → 400).
- `validateUpdate(nested, stored, ctx)`: merge the request onto the stored row (only keys
  present in the request; `null` clears), apply edge case 2 (frequency → `monthly` clears
  `due_month` automatically, even if not sent; an explicit non-null `due_month` with a merged
  `monthly` frequency → 400), then run the same paired checks on the merged result. Examples
  that must hold: `{ interest_rate: "2.5" }` with a stored period → OK; `{ interest_period: null }`
  with a stored rate → 400; `{ interest_rate: null, interest_period: null }` → cleared.
  If the handler interface doesn't receive the stored details / account currency today, extend
  the interface (and `RegularAccountHandler` accordingly) rather than special-casing in the
  service.
- `saveDetails(account, nested, manager)`: upsert the `bank_debt_details` row — on create
  **always** insert a row (edge case 4), inside the existing `manager.transaction` of
  `AccountService#saveWithDetails`.
- `loadDetails(ids, manager)`: one `find({ where: { accountId: In(ids) } })` — no N+1.
- `serialize(details)`: snake_case object; `instalment_amount` via `formatAmount` in the
  account currency (needs the currency — pass the account or currency in), `interest_rate`
  normalised by stripping trailing fractional zeros, unset fields `null`.
- A rescale helper used by step 04: given the stored details and old/new currency, convert
  `instalmentAmount` with `convertAmountInput('debt.instalment_amount', …)` (400 when
  unrepresentable).
- Make sure `RegularAccountHandler` rejects a present `debt` object (create and PATCH) with 400
  — "a `debt` object on a non-debt account → 400". Prefer a generic rule in the service: any
  nested key other than the account's own type name → 400.
- Register: `providers` + `ACCOUNT_TYPE_HANDLERS` factory `inject` list in
  `bank/bank.module.ts`.

## Files to Change
- `backend/src/bank/account-types/debt-account.handler.ts` — new handler.
- `backend/src/bank/account-types/account-type-handler.ts` — extend the interface if stored state / currency must be passed.
- `backend/src/bank/account-types/regular-account.handler.ts` — follow interface changes; reject a nested `debt`.
- `backend/src/bank/bank.module.ts` — register the handler.
- `backend/src/bank/tests/debt-account.handler.spec.ts` — new unit spec (merge, paired rules, defaults, serialize).
- `backend/src/bank/tests/account-type.registry.spec.ts` — `debt` now resolves.
