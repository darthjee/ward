import { AccountService } from '../account.service.js';
import { AccountantService } from '../accountant.service.js';
import { BankModuleLoader } from '../bank-module.loader.js';
import { BankModule } from '../bank.module.js';
import { BillService } from '../bill.service.js';
import { CalendarService } from '../calendar.service.js';
import { TransactionService } from '../transaction.service.js';

describe('BankModuleLoader', () => {
  it('loads BankModule through the lazy loader and resolves its services', async () => {
    const accounts = { name: 'accounts' };
    const accountant = { name: 'accountant' };
    const bills = { name: 'bills' };
    const calendar = { name: 'calendar' };
    const transactions = { name: 'transactions' };
    const byToken = new Map<unknown, object>([
      [AccountService, accounts],
      [AccountantService, accountant],
      [BillService, bills],
      [CalendarService, calendar],
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
    expect(moduleRef.get).toHaveBeenCalledWith(CalendarService);
    expect(moduleRef.get).toHaveBeenCalledWith(BillService);
    expect(services).toEqual({ accounts, accountant, bills, calendar, transactions });
  });
});
