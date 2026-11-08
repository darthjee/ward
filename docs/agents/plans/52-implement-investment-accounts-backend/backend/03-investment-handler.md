# Handler contract hook and InvestmentAccountHandler
**Contract hook (account-level rule).** Add to `AccountTypeHandler`:
`validateAccount(account: Account): void` — "checks account-level rules of the type on the
account as it is about to be saved; throws `BadRequestException`". Call it once in
`AccountService.#saveWithDetails(account, handler, prepared)` before `manager.transaction(...)`
(the first write on both create and PATCH; about one line, keeping the file under 300 lines).
Checking the final account state covers create and PATCH, uses the stored type on PATCH, and is
safe across a currency rescale (0 stays 0). `RegularAccountHandler` and `DebtAccountHandler` get
an explicit no-op `validateAccount(): void {}` (matching the existing explicit no-ops). Archived
PATCH with `opening_balance` still returns 409 earlier, so archived beats the zero rule.

**Pure helpers** — `account-types/investment-details.ts`, mirroring `debt-details.ts`:
`InvestmentState` (Pick of the entity fields), `InvestmentResponse` (a `type` alias, not an
interface, so it stays assignable to `Record<string, unknown>`), `defaultInvestmentState()` (all
null), `investmentStateOf(details | undefined)`, `mergeInvestmentState(base, dto)` (copy table of
`[body_key, property]`; `undefined` = unchanged, `null` = clear), `assertInvestmentPairs(state)`
(`(yieldRate === null) !== (yieldPeriod === null)` → 400), `serializeInvestmentState(state)`
(snake_case keys, unset → `null`, `yield_rate` through `normaliseRate`). Move `normaliseRate`
from `debt-details.ts` to a shared `account-types/rate.ts` and import it in both.

**Handler** — `account-types/investment-account.handler.ts`, `InvestmentAccountHandler`
(`type = 'investment'`, `carriesLedger = true`):
- `validateAccount(account)`: `account.openingBalance !== 0n` →
  `BadRequestException('opening_balance must be 0 on investment accounts')`.
- `validateCreate(nested)`: merge onto `defaultInvestmentState()`, then `assertInvestmentPairs`.
- `validateUpdate(nested, stored)`: merge onto `investmentStateOf(stored)`, then
  `assertInvestmentPairs` on the merged result (issue decision). Ignores `previousCurrency`
  (no amounts to rescale).
- `loadDetails(ids, manager)`: empty map for `[]`, otherwise one
  `find({ where: { accountId: In(ids) } })` keyed by `accountId` (no N+1).
- `saveDetails(account, prepared, manager)`: always upserts a row (all-null when no
  `investment` object was sent), so reads never see a missing row.
- `serialize(details)`: `serializeInvestmentState(investmentStateOf(details))`.

**Registration** — `bank.module.ts`: add `InvestmentAccountHandler` to `providers` and to the
`ACCOUNT_TYPE_HANDLERS` factory `inject`. Update the stale "investment later" comments in
`account-type-handler.ts` and `bank.module.ts`.

## Files to Change
- `backend/src/bank/account-types/account-type-handler.ts` — `validateAccount` in the contract; comment
- `backend/src/bank/account-types/regular-account.handler.ts` — no-op `validateAccount`
- `backend/src/bank/account-types/debt-account.handler.ts` — no-op `validateAccount`
- `backend/src/bank/account-types/debt-details.ts` — import `normaliseRate` from `rate.ts`
- `backend/src/bank/account-types/rate.ts` — new, shared `normaliseRate`
- `backend/src/bank/account-types/investment-details.ts` — new pure helpers
- `backend/src/bank/account-types/investment-account.handler.ts` — new handler
- `backend/src/bank/account.service.ts` — call `handler.validateAccount(account)` in `#saveWithDetails`
- `backend/src/bank/bank.module.ts` — register the handler
