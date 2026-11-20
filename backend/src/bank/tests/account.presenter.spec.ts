import { buildAccount } from './account.test-support.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';
import { AccountPresenter } from '../account.presenter.js';
import type { Account } from '../entities/account.entity.js';

function setup() {
  const summaries = jest.fn(async (ids: number[]) => new Map(ids.map((id) => [id, { count: 2, monthly: 1000n, yearly: 0n }])));
  const registry = new AccountTypeRegistry([new RegularAccountHandler(), new ProviderExpenseAccountHandler({ summaries } as never)]);
  const loadDetails = jest.spyOn(registry, 'loadDetails').mockResolvedValue(new Map());
  const balances = {
    currentBalances: jest.fn(async (accounts: Account[]) => new Map(accounts.map((account) => [account.id, 500n]))),
  };
  const manager = {};
  const presenter = new AccountPresenter({ manager } as never, registry, balances as never);

  return { presenter, summaries, loadDetails, balances, manager };
}

describe('AccountPresenter', () => {
  const regular = buildAccount({ id: 1 });
  const provider = buildAccount({ id: 2, type: 'provider_expense', accountNumber: '0001234' });

  it('serializes with one balance query and one details load, masked when asked', async () => {
    const { presenter, balances, loadDetails, manager } = setup();

    const [first, second] = await presenter.present([regular, provider], { mask: true });

    expect(balances.currentBalances).toHaveBeenCalledTimes(1);
    expect(loadDetails).toHaveBeenCalledWith([regular, provider], manager);
    expect(first.balance).toBe('5.00');
    expect(second.account_number).toBe('•••• 1234');
  });

  it('falls back to the opening balance when the balance query has none', async () => {
    const { presenter, balances } = setup();
    balances.currentBalances.mockResolvedValue(new Map());

    const response = await presenter.presentOne(regular, false);

    expect(response.balance).toBe('1000.00');
    expect(response.account_number).toBe('12345-6');
  });

  it('adds the list extras only when asked', async () => {
    const { presenter, summaries } = setup();

    const [, listed] = await presenter.present([regular, provider], { mask: true, listExtras: true });
    const single = await presenter.presentOne(provider, true);

    expect(listed.bills_summary).toEqual({ count: 2, monthly: '10.00', yearly: '0.00' });
    expect(single).not.toHaveProperty('bills_summary');
    expect(summaries).toHaveBeenCalledTimes(1);
  });
});
