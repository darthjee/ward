import type { EntityManager, Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { ProviderBill } from './entities/provider-bill.entity.js';
import { buildPagination, LEDGER_PER_PAGE } from './pagination.js';
import { PROVIDER_BILL_RECURRING_LIMIT, providerBillLimit, providerBillNameTaken, sameDescription } from './provider-bill-conflicts.js';
import type { ProviderBillListResponse } from './provider-bill-response.js';
import { serializeProviderBill } from './provider-bill-response.js';

// Recurring-bill constraints and the list query of `ProviderBillService`.

/**
 * Locks the provider account row `FOR UPDATE`, so recurring creates / renames
 * of one provider (and the provider write-through) serialize.
 * @param {EntityManager} manager - The transactional manager.
 * @param {number} providerAccountId - The provider account id.
 * @returns {Promise<void>}
 */
export async function lockProvider(manager: EntityManager, providerAccountId: number): Promise<void> {
  await manager.getRepository(Account).findOne({ where: { id: providerAccountId }, lock: { mode: 'pessimistic_write' } });
}

/**
 * Loads the provider's recurring bills with a locking read. Under REPEATABLE READ a plain read
 * would use the snapshot opened by the transaction's first read and miss a concurrent commit
 * that the provider lock just waited for; a locking read always sees the latest committed rows.
 * @param {EntityManager} manager - The transactional manager.
 * @param {number} providerAccountId - The provider account id.
 * @returns {Promise<ProviderBill[]>} The provider's recurring bills.
 */
export function lockedRecurringBills(manager: EntityManager, providerAccountId: number): Promise<ProviderBill[]> {
  return manager.getRepository(ProviderBill).find({
    where: { providerAccountId, kind: 'recurring' },
    lock: { mode: 'pessimistic_write' },
  });
}

/**
 * Checks a recurring bill's description against the provider's other recurring
 * bills and, for a new bill, the 50-bill cap. Locks the provider row first.
 * @param {EntityManager} manager - The transactional manager.
 * @param {number} providerAccountId - The provider account id.
 * @param {string} description - The (new) description.
 * @param {number | undefined} excludeId - The bill being renamed (none on create).
 * @returns {Promise<void>}
 * @throws {ConflictException} `PROVIDER_BILL_LIMIT` / `PROVIDER_BILL_NAME_TAKEN`.
 */
export async function assertRecurringRoom(
  manager: EntityManager,
  providerAccountId: number,
  description: string,
  excludeId?: number,
): Promise<void> {
  await lockProvider(manager, providerAccountId);
  const others = (await lockedRecurringBills(manager, providerAccountId)).filter(({ id }) => id !== excludeId);

  if (excludeId === undefined && others.length >= PROVIDER_BILL_RECURRING_LIMIT) {
    throw providerBillLimit();
  }

  if (others.some((other) => sameDescription(other.description, description))) {
    throw providerBillNameTaken();
  }
}

/**
 * Lists a provider's bills: recurring first (by description), then one-offs
 * (newest `due_date`, then newest id); 50 per page. Two queries, with the
 * offset arithmetic done here.
 * @param {Repository<ProviderBill>} repository - The bill repository.
 * @param {Account} provider - The provider account.
 * @param {string | undefined} kind - The `kind` filter; an unknown value gives an empty list.
 * @param {number} page - The 1-based page.
 * @returns {Promise<ProviderBillListResponse>} `{ provider_bills, pagination }`.
 */
export async function listProviderBills(
  repository: Repository<ProviderBill>,
  provider: Account,
  kind: string | undefined,
  page: number,
): Promise<ProviderBillListResponse> {
  const withRecurring = kind === undefined || kind === 'recurring';
  const withOneOff = kind === undefined || kind === 'one_off';
  const recurring = withRecurring
    ? (await repository.find({ where: { providerAccountId: provider.id, kind: 'recurring' } }))
      .sort((a, b) => a.description.localeCompare(b.description, undefined, { sensitivity: 'base' }) || a.id - b.id)
    : [];
  const offset = (page - 1) * LEDGER_PER_PAGE;
  const recurringSlice = recurring.slice(offset, offset + LEDGER_PER_PAGE);
  const slots = LEDGER_PER_PAGE - recurringSlice.length;
  const [oneOffs, oneOffTotal] = withOneOff
    ? await repository.findAndCount({
      where: { providerAccountId: provider.id, kind: 'one_off' },
      order: { dueDate: 'DESC', id: 'DESC' },
      skip: Math.max(0, offset - recurring.length),
      // `take: 0` would mean "no limit" to TypeORM: always ask for one row, then trim to the free slots.
      take: Math.max(1, slots),
    })
    : [[], 0];

  return {
    provider_bills: [...recurringSlice, ...oneOffs.slice(0, slots)].map((bill) => serializeProviderBill(bill, provider.currency)),
    pagination: buildPagination(page, LEDGER_PER_PAGE, recurring.length + oneOffTotal),
  };
}
