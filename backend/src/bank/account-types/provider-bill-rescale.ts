import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';
import { ownerWhere, type OwnerContext } from '../../core/owner-context.js';
import { convertAmountInput } from '../amount-input.js';
import { accountNotFoundInBody, currencyMismatch } from '../body-reference-errors.js';
import { Account } from '../entities/account.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';
import { PAYING_ACCOUNT_TYPE } from '../paying-account.resolver.js';

/**
 * @param {Account} account - An account.
 * @returns {OwnerContext} Its owner, as the routes would resolve it.
 */
function ownerOf(account: Account): OwnerContext {
  return account.userId === null
    ? { kind: 'organization', organizationId: account.organizationId as number }
    : { kind: 'user', userId: account.userId };
}

/**
 * Re-checks a bill's default paying account against the provider's new
 * currency, like `PayingAccountResolver` (a `regular`, non-archived account of
 * the same owner and currency; 422 otherwise).
 * @param {Account} provider - The provider account.
 * @param {number} payingAccountId - The bill's paying account.
 * @param {EntityManager} manager - The transactional entity manager.
 * @returns {Promise<void>}
 * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
 */
async function assertPayingAccountCurrency(provider: Account, payingAccountId: number, manager: EntityManager): Promise<void> {
  const paying = await manager.getRepository(Account).findOneBy({
    ...ownerWhere(ownerOf(provider)),
    id: payingAccountId,
    type: PAYING_ACCOUNT_TYPE,
    archivedAt: IsNull(),
  });

  if (!paying) {
    throw accountNotFoundInBody();
  }

  if (paying.currency !== provider.currency) {
    throw currencyMismatch();
  }
}

/**
 * A provider currency change rescales every bill's `expected_amount` (both
 * kinds, locked rows) keeping its decimal value, and re-checks every bill's
 * paying account against the new currency. Any failure rolls back the whole `PATCH`.
 * @param {Account} provider - The saved provider account (already in its new currency).
 * @param {string} from - The previous currency.
 * @param {EntityManager} manager - The transactional entity manager.
 * @returns {Promise<void>}
 * @throws {BadRequestException} When an amount cannot be represented in the new currency.
 * @throws {UnprocessableEntityException} When a paying account does not fit the new currency.
 */
export async function rescaleProviderBills(provider: Account, from: string, manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(ProviderBill);
  const bills = await repository.find({ where: { providerAccountId: provider.id }, lock: { mode: 'pessimistic_write' } });

  for (const bill of bills) {
    if (bill.expectedAmount !== null) {
      bill.expectedAmount = convertAmountInput('expected_amount', bill.expectedAmount, from, provider.currency);
    }

    if (bill.payingAccountId !== null) {
      await assertPayingAccountCurrency(provider, bill.payingAccountId, manager);
    }

    await repository.save(bill);
  }
}
