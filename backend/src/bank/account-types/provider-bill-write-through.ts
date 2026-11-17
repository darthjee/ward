import type { EntityManager } from 'typeorm';
import type { ProviderExpenseState } from './provider-expense-details.js';
import type { Account } from '../entities/account.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';

/**
 * The schedule columns of a provider's details copied to its recurring bill.
 * @param {Account} account - The provider account (its name is the bill description).
 * @param {ProviderExpenseState} state - The merged provider-expense details.
 * @returns {Partial<ProviderBill>} The recurring bill's fields.
 */
function recurringFields(account: Account, state: ProviderExpenseState): Partial<ProviderBill> {
  return {
    description: account.name,
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
 * Keeps the provider's single recurring bill in sync with its schedule columns, inside the
 * caller's transaction (so a failure rolls back both writes). It only touches the bill of the
 * account being saved, which `AccountService` has already loaded owner-scoped.
 *
 * - `dueDay` set: the bill is created or updated from the state (description = account name);
 * - `dueDay` cleared: an existing bill is hidden (`showInCalendar = false`) but kept, with its
 *   last `dueDay` / `dueMonth`, because deleting it would cascade its payment history;
 * - no `dueDay` and no bill: nothing happens.
 *
 * It is idempotent, so name-only and archived-account PATCHes re-run it harmlessly.
 * @param {Account} account - The saved provider account.
 * @param {ProviderExpenseState} state - The merged provider-expense details.
 * @param {EntityManager} manager - The transactional entity manager.
 * @returns {Promise<void>}
 */
export async function syncProviderBill(account: Account, state: ProviderExpenseState, manager: EntityManager): Promise<void> {
  const bills = manager.getRepository(ProviderBill);
  const bill = await bills.findOne({
    where: { providerAccountId: account.id, kind: 'recurring' },
    lock: { mode: 'pessimistic_write' },
  });

  if (state.dueDay !== null) {
    await bills.save(bills.create({ ...(bill ?? { providerAccountId: account.id, kind: 'recurring', dueDate: null, notes: null }), ...recurringFields(account, state) }));
  } else if (bill) {
    await bills.save({ ...bill, description: account.name, showInCalendar: false });
  }
}
