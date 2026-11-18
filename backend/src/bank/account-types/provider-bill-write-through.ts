import type { EntityManager } from 'typeorm';
import type { ProviderExpenseState } from './provider-expense-details.js';
import type { Account } from '../entities/account.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';

/**
 * The schedule columns of a provider's details copied to its recurring bill.
 * The `description` is not among them: it is the account name only when the
 * bill is created, and is kept in sync on a rename by {@link syncBillDescription}.
 * @param {ProviderExpenseState} state - The merged provider-expense details.
 * @returns {Partial<ProviderBill>} The recurring bill's schedule fields.
 */
function scheduleFields(state: ProviderExpenseState): Partial<ProviderBill> {
  return {
    expectedAmount: state.expectedAmount,
    chargeFrequency: state.chargeFrequency,
    dueDay: state.dueDay,
    dueMonth: state.dueMonth,
    billsFrom: state.billsFrom,
    showInCalendar: state.showInCalendar,
    payingAccountId: state.payingAccountId,
  };
}

/**
 * The schedule write-through, inside the caller's transaction (so a failure
 * rolls back both writes). It only runs when the request sent a schedule field
 * and the provider has at most one recurring bill (the caller checks both), and
 * it writes onto that one bill (`bill`), already loaded under the provider lock:
 *
 * - `dueDay` set: the bill is created (description = account name) or updated
 *   from the state, its description left alone;
 * - `dueDay` cleared: an existing bill is hidden (`showInCalendar = false`) but
 *   kept, with its last `dueDay` / `dueMonth`, because deleting it would
 *   cascade its payment history;
 * - no `dueDay` and no bill: nothing happens.
 * @param {Account} account - The saved provider account.
 * @param {ProviderExpenseState} state - The merged provider-expense details.
 * @param {ProviderBill | undefined} bill - The provider's only recurring bill, if any.
 * @param {EntityManager} manager - The transactional entity manager.
 * @returns {Promise<void>}
 */
export async function syncProviderBill(
  account: Account,
  state: ProviderExpenseState,
  bill: ProviderBill | undefined,
  manager: EntityManager,
): Promise<void> {
  const bills = manager.getRepository(ProviderBill);

  if (state.dueDay !== null) {
    const base = bill ?? { providerAccountId: account.id, kind: 'recurring', dueDate: null, notes: null, description: account.name };

    await bills.save(bills.create({ ...base, ...scheduleFields(state) }));
  } else if (bill) {
    await bills.save({ ...bill, showInCalendar: false });
  }
}

/**
 * Renames the provider's only recurring bill after the account (the provider
 * `PATCH` changed its `name`).
 * @param {Account} account - The saved provider account.
 * @param {ProviderBill} bill - The provider's only recurring bill.
 * @param {EntityManager} manager - The transactional entity manager.
 * @returns {Promise<void>}
 */
export async function syncBillDescription(account: Account, bill: ProviderBill, manager: EntityManager): Promise<void> {
  await manager.getRepository(ProviderBill).save({ ...bill, description: account.name });
}
