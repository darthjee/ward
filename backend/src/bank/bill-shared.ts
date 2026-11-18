import type { EntityManager } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import { currencyMismatch } from './body-reference-errors.js';
import type { OwnerContext } from '../core/owner-context.js';
import type { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import type { ProviderBill, ProviderBillKind } from './entities/provider-bill.entity.js';
import type { PayingAccountResolver } from './paying-account.resolver.js';

// Logic shared by `BillService` (`bills.json`, one-off only) and
// `ProviderBillService` (`provider-bills`, both kinds).

/** The kind `bills.json` reads and writes. */
export const ONE_OFF: ProviderBillKind = 'one_off';

/**
 * @param {EntityManager} manager - The (transactional) manager.
 * @param {ProviderBill} bill - The bill.
 * @returns {Promise<boolean>} Whether a `paid` payment row exists: by `billId`
 *   for a one-off, by `providerBillId` (any occurrence) for a recurring bill.
 */
export async function paidPaymentExists(manager: EntityManager, bill: ProviderBill): Promise<boolean> {
  const where = bill.kind === 'recurring' ? { providerBillId: bill.id } : { billId: bill.id };

  return manager.getRepository(BillPayment).existsBy({ ...where, status: 'paid' });
}

/**
 * Applies a sent `paying_account_id` to the bill and re-checks the resulting
 * paying account against `currency` when it was sent or the bill moved.
 * @param {PayingAccountResolver} resolver - Resolves body paying accounts.
 * @param {OwnerContext} owner - The resolved owner.
 * @param {ProviderBill} bill - The bill (mutated).
 * @param {number | null | undefined} sent - The body's `paying_account_id`.
 * @param {string} currency - The (target) provider's currency.
 * @param {boolean} moved - Whether the bill changes provider.
 * @param {EntityManager} manager - The transactional manager.
 * @returns {Promise<void>}
 * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
 */
export async function applyPayingAccount(
  resolver: PayingAccountResolver,
  owner: OwnerContext,
  bill: ProviderBill,
  sent: number | null | undefined,
  currency: string,
  moved: boolean,
  manager: EntityManager,
): Promise<void> {
  if (sent !== undefined) {
    bill.payingAccountId = sent;
  }

  if (bill.payingAccountId !== null && (sent !== undefined || moved)) {
    await resolver.resolve(owner, bill.payingAccountId, currency, manager);
  }
}

/**
 * The one-off move rules on an already resolved target: an archived target
 * answers 409, a target in another currency 422 (`expected_amount` is in the
 * provider's minor units, so it is never rescaled).
 * @param {Account} source - The current provider.
 * @param {Account} target - The target provider.
 * @returns {void}
 * @throws {ConflictException} `ACCOUNT_ARCHIVED`.
 * @throws {UnprocessableEntityException} `CURRENCY_MISMATCH`.
 */
export function assertMoveTarget(source: Account, target: Account): void {
  if (target.archivedAt !== null) {
    throw accountArchived();
  }

  if (target.currency !== source.currency) {
    throw currencyMismatch();
  }
}
