import { buildAccount, NO_BILLS_SUMMARY } from './account.test-support.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { defaultProviderExpenseState, type ProviderExpenseState } from '../account-types/provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import { Account } from '../entities/account.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

const BRL = { currency: 'BRL' };

function stored(overrides: Partial<ProviderExpenseState> = {}): ProviderExpenseDetails {
  return Object.assign(new ProviderExpenseDetails(), {
    accountId: 1,
    forAccountant: true,
    providerTaxId: '12.345.678/0001-90',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const pe = (fields: Partial<ProviderExpenseDetailsDto>): ProviderExpenseDetailsDto => fields as ProviderExpenseDetailsDto;

describe('ProviderExpenseAccountHandler', () => {
  const handler = new ProviderExpenseAccountHandler(NO_BILLS_SUMMARY);

  it('serves provider_expense, carries a ledger and has no schedule', () => {
    expect(handler.type).toBe('provider_expense');
    expect(handler.carriesLedger).toBe(true);
    expect((handler as { hasSchedule?: boolean }).hasSchedule).toBeUndefined();
  });

  it('has no account-level rule (any opening balance)', () => {
    expect(() => handler.validateAccount()).not.toThrow();
  });

  describe('validateCreate', () => {
    it('uses the defaults without a provider_expense object', () => {
      expect(handler.validateCreate(undefined)).toEqual({ forAccountant: true, providerTaxId: null });
    });

    it('accepts both accountant fields', () => {
      expect(handler.validateCreate(pe({ for_accountant: false, provider_tax_id: 'ABC' }))).toEqual({
        forAccountant: false,
        providerTaxId: 'ABC',
      });
    });
  });

  describe('validateUpdate', () => {
    it('keeps the stored state when no provider_expense object is sent', () => {
      expect(handler.validateUpdate(undefined, stored(), BRL)).toEqual({
        forAccountant: true,
        providerTaxId: '12.345.678/0001-90',
      });
    });

    it('falls back to the defaults when there is no stored row', () => {
      expect(handler.validateUpdate(pe({ provider_tax_id: 'X' }), undefined, BRL)).toEqual({
        ...defaultProviderExpenseState(),
        providerTaxId: 'X',
      });
    });

    it('clears the tax id sent as null and flips for_accountant', () => {
      expect(handler.validateUpdate(pe({ for_accountant: false, provider_tax_id: null }), stored(), BRL)).toEqual({
        forAccountant: false,
        providerTaxId: null,
      });
    });

    it('never carries the stored row\'s extra properties into the merge base', () => {
      const row = Object.assign(stored(), { recurringBills: [] });

      expect(handler.validateUpdate(undefined, row, BRL)).not.toHaveProperty('recurringBills');
      expect(handler.validateUpdate(undefined, row, BRL)).not.toHaveProperty('accountId');
    });
  });

  describe('loadDetails', () => {
    it('loads every row in one query, keyed by account id, without reading bills', async () => {
      const rows = [stored(), Object.assign(stored(), { accountId: 2 })];
      const find = jest.fn(async () => rows);
      const manager = { getRepository: jest.fn(() => ({ find })) };

      const details = await handler.loadDetails([1, 2], manager as never);

      expect(find).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(ProviderExpenseDetails);
      expect([...details.keys()]).toEqual([1, 2]);
      expect(details.get(2)).toBe(rows[1]);
    });

    it('skips the query for no accounts', async () => {
      const manager = { getRepository: jest.fn() };

      await expect(handler.loadDetails([], manager as never)).resolves.toEqual(new Map());
      expect(manager.getRepository).not.toHaveBeenCalled();
    });
  });

  describe('saveDetails', () => {
    const bill = (fields: object = {}) => ({ id: 3, providerAccountId: 42, kind: 'recurring', description: 'Old', ...fields });
    const run = async (prepared: unknown, bills: object[] = [], account = buildAccount({ id: 42, name: 'Vivo' })) => {
      const billRepo = { find: jest.fn(async () => bills), save: jest.fn(async (row: unknown) => row) };
      const accountRepo = { findOne: jest.fn(async () => account), findOneBy: jest.fn(async () => buildAccount({ id: 5, currency: account.currency })) };
      const details = { save: jest.fn(async (row: unknown) => row) };
      const manager = { getRepository: (entity: unknown) => (entity === ProviderExpenseDetails ? details : entity === Account ? accountRepo : billRepo) };
      await handler.saveDetails(account, prepared, manager as never);

      return { bills: billRepo, accounts: accountRepo, details };
    };

    it('upserts the row keyed by the account id', async () => {
      const { details } = await run({ ...defaultProviderExpenseState(), providerTaxId: 'X' });

      expect(details.save).toHaveBeenCalledWith({ forAccountant: true, providerTaxId: 'X', accountId: 42 });
    });

    it('saves the defaults when nothing was prepared', async () => {
      const { details } = await run(undefined);

      expect(details.save).toHaveBeenCalledWith({ ...defaultProviderExpenseState(), accountId: 42 });
    });

    it('never touches the bills (nor locks) without a currency change, even on a rename', async () => {
      const prepared = handler.validateUpdate(pe({ for_accountant: false }), stored(), { currency: 'BRL', previousCurrency: 'BRL' });
      const { bills, accounts } = await run(prepared, [bill()]);

      expect(bills.find).not.toHaveBeenCalled();
      expect(bills.save).not.toHaveBeenCalled();
      expect(accounts.findOne).not.toHaveBeenCalled();
    });

    it('locks the provider, rescales every bill on a currency change and re-checks their paying accounts', async () => {
      const prepared = handler.validateUpdate(undefined, stored(), { currency: 'USD', previousCurrency: 'BRL' });
      const rows = [bill({ expectedAmount: 1250n, payingAccountId: 5 }), bill({ id: 4, kind: 'one_off', expectedAmount: 700n, payingAccountId: null })];

      const { bills, accounts } = await run(prepared, rows, buildAccount({ id: 42, currency: 'USD' }));

      expect(accounts.findOne).toHaveBeenCalledWith({ where: { id: 42 }, lock: { mode: 'pessimistic_write' } });
      expect(accounts.findOneBy).toHaveBeenCalledWith(expect.objectContaining({ id: 5, type: 'regular' }));
      expect(bills.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('serialize', () => {
    it('serializes only the two accountant fields, snake_case', () => {
      expect(handler.serialize(stored())).toEqual({ for_accountant: true, provider_tax_id: '12.345.678/0001-90' });
    });

    it('returns the defaults without a row', () => {
      expect(handler.serialize(undefined)).toEqual({ for_accountant: true, provider_tax_id: null });
    });
  });

  describe('listExtras', () => {
    const summaries = jest.fn(async () => new Map([
      [1, { count: 3, monthly: 25000n, yearly: 120000n }],
      [5, { count: 2, monthly: 250n, yearly: 0n }],
    ]));
    const withSummaries = new ProviderExpenseAccountHandler({ summaries } as never);

    it('maps every account to its bills_summary from one summaries call', async () => {
      const accounts = [buildAccount({ id: 1, type: 'provider_expense' }), buildAccount({ id: 5, type: 'provider_expense', currency: 'JPY' })];

      const extras = await withSummaries.listExtras(accounts);

      expect(summaries).toHaveBeenCalledTimes(1);
      expect(summaries).toHaveBeenCalledWith([1, 5]);
      expect(extras.get(1)).toEqual({ bills_summary: { count: 3, monthly: '250.00', yearly: '1200.00' } });
      expect(extras.get(5)).toEqual({ bills_summary: { count: 2, monthly: '250', yearly: '0' } });
    });

    it.each([
      ['BRL', '0.00'],
      ['JPY', '0'],
      ['BHD', '0.000'],
    ])('defaults an account without a summary row to zeros in %s (%p)', async (currency, zero) => {
      const extras = await withSummaries.listExtras([buildAccount({ id: 9, type: 'provider_expense', currency })]);

      expect(extras.get(9)).toEqual({ bills_summary: { count: 0, monthly: zero, yearly: zero } });
    });

    it('never exposes owner or organization ids', async () => {
      const extras = await withSummaries.listExtras([buildAccount({ id: 1, type: 'provider_expense', userId: 7, organizationId: 3 })]);

      expect(JSON.stringify(extras.get(1))).not.toMatch(/user_id|organization_id|userId|organizationId/);
    });
  });
});
