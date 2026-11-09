import { AccountService } from '../account.service.js';
import { AccountantService } from '../accountant.service.js';
import { BankModuleLoader } from '../bank-module.loader.js';
import { BankModule } from '../bank.module.js';
import { TransactionService } from '../transaction.service.js';

describe('BankModuleLoader', () => {
  it('loads BankModule through the lazy loader and resolves its services', async () => {
    const accounts = { name: 'accounts' };
    const accountant = { name: 'accountant' };
    const transactions = { name: 'transactions' };
    const byToken = new Map<unknown, object>([
      [AccountService, accounts],
      [AccountantService, accountant],
      [TransactionService, transactions],
    ]);
    const moduleRef = { get: jest.fn((token: unknown) => byToken.get(token)) };
    const lazy = { loadOnFirstRequest: jest.fn(async (load: () => unknown) => {
      expect(await load()).toBe(BankModule);
      return moduleRef;
    }) };

    const services = await new BankModuleLoader(lazy as never).services();

    expect(lazy.loadOnFirstRequest).toHaveBeenCalledTimes(1);
    expect(moduleRef.get).toHaveBeenCalledWith(AccountService);
    expect(moduleRef.get).toHaveBeenCalledWith(AccountantService);
    expect(moduleRef.get).toHaveBeenCalledWith(TransactionService);
    expect(services).toEqual({ accounts, accountant, transactions });
  });
});
