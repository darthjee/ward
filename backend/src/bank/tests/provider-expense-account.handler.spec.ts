import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { defaultProviderExpenseState, type ProviderExpenseState } from '../account-types/provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import { Account } from '../entities/account.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';
import { todayUtc } from '../ledger-date.js';

const BRL = { currency: 'BRL' };

function stored(overrides: Partial<ProviderExpenseState> = {}): ProviderExpenseDetails {
  return Object.assign(new ProviderExpenseDetails(), {
    accountId: 1,
    forAccountant: true,
    providerTaxId: '12.345.678/0001-90',
    expectedAmount: 20000n,
    dueDay: 10,
    chargeFrequency: 'yearly',
    dueMonth: 3,
    billsFrom: null,
    showInCalendar: true,
    payingAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

// The recurring-bill repository `saveDetails` syncs through: no stored bill.
const billsRepo = () => ({ find: jest.fn(async () => []), findOne: jest.fn(async () => null), create: jest.fn((fields: object) => fields), save: jest.fn(async (row: unknown) => row) });
const monthly = (): ProviderExpenseDetails => stored({ chargeFrequency: 'monthly', dueMonth: null });
const pe = (fields: Partial<ProviderExpenseDetailsDto>): ProviderExpenseDetailsDto => fields as ProviderExpenseDetailsDto;

describe('ProviderExpenseAccountHandler', () => {
  const handler = new ProviderExpenseAccountHandler();

  it('serves provider_expense and carries a ledger', () => {
    expect(handler.type).toBe('provider_expense');
    expect(handler.carriesLedger).toBe(true);
  });

  it('has no account-level rule (any opening balance)', () => {
    expect(() => handler.validateAccount()).not.toThrow();
  });

  describe('validateCreate', () => {
    it('uses the defaults without a provider_expense object', () => {
      expect(handler.validateCreate(undefined, BRL)).toEqual({
        forAccountant: true,
        providerTaxId: null,
        expectedAmount: null,
        dueDay: null,
        chargeFrequency: 'monthly',
        dueMonth: null,
        billsFrom: null,
        showInCalendar: true,
        payingAccountId: null,
      });
    });

    it('accepts a full yearly object and parses the amount in the account currency', () => {
      expect(handler.validateCreate(pe({
        for_accountant: false,
        provider_tax_id: 'ABC',
        expected_amount: '200.5',
        charge_frequency: 'yearly',
        due_day: 31,
        due_month: 12,
      }), BRL)).toEqual({
        forAccountant: false,
        providerTaxId: 'ABC',
        expectedAmount: 20050n,
        dueDay: 31,
        chargeFrequency: 'yearly',
        dueMonth: 12,
        billsFrom: todayUtc(new Date()),
        showInCalendar: true,
        payingAccountId: null,
      });
    });

    it('parses the amount against a zero-decimal currency', () => {
      expect(handler.validateCreate(pe({ expected_amount: '200' }), { currency: 'JPY' })).toMatchObject({ expectedAmount: 200n });
      expect(() => handler.validateCreate(pe({ expected_amount: '200.5' }), { currency: 'JPY' })).toThrow(BadRequestException);
    });

    it.each([
      ['yearly without due_month (rule on the defaults)', { charge_frequency: 'yearly' }],
      ['due_month with the default monthly', { due_month: 3 }],
      ['due_month with an explicit monthly', { charge_frequency: 'monthly', due_month: 3 }],
      ['a zero expected amount', { expected_amount: '0' }],
      ['a negative expected amount', { expected_amount: '-1.00' }],
      ['an expected amount with too many decimals', { expected_amount: '1.001' }],
      ['an expected amount over the bound', { expected_amount: '100000000000.01' }],
      ['a malformed expected amount', { expected_amount: 'abc' }],
    ])('rejects %s with a 400', (_label, fields) => {
      expect(() => handler.validateCreate(pe(fields as Partial<ProviderExpenseDetailsDto>), BRL)).toThrow(BadRequestException);
    });

    it('accepts the amount bound itself', () => {
      expect(handler.validateCreate(pe({ expected_amount: '100000000000.00' }), BRL)).toMatchObject({
        expectedAmount: 10n ** 13n,
      });
    });
  });

  describe('validateUpdate', () => {
    it('keeps the stored state when no provider_expense object is sent', () => {
      expect(handler.validateUpdate(undefined, stored(), BRL)).toEqual({
        forAccountant: true,
        providerTaxId: '12.345.678/0001-90',
        expectedAmount: 20000n,
        dueDay: 10,
        chargeFrequency: 'yearly',
        dueMonth: 3,
        billsFrom: null,
        showInCalendar: true,
        payingAccountId: null,
      });
    });

    it('falls back to the defaults when there is no stored row', () => {
      expect(handler.validateUpdate(pe({ due_day: 5 }), undefined, BRL)).toEqual({
        ...defaultProviderExpenseState(),
        dueDay: 5,
        billsFrom: todayUtc(new Date()),
      });
    });

    it('clears nullable fields sent as null and flips for_accountant', () => {
      expect(handler.validateUpdate(pe({
        for_accountant: false,
        provider_tax_id: null,
        expected_amount: null,
        due_day: null,
      }), stored(), BRL)).toMatchObject({
        forAccountant: false,
        providerTaxId: null,
        expectedAmount: null,
        dueDay: null,
        dueMonth: 3,
      });
    });

    describe('paired charge_frequency <-> due_month rule on the merged state', () => {
      it('yearly + { due_day: 10 } -> ok, unchanged', () => {
        expect(handler.validateUpdate(pe({ due_day: 10 }), stored(), BRL)).toMatchObject({
          chargeFrequency: 'yearly',
          dueDay: 10,
          dueMonth: 3,
        });
      });

      it('yearly + { due_month: 7 } -> ok', () => {
        expect(handler.validateUpdate(pe({ due_month: 7 }), stored(), BRL)).toMatchObject({ chargeFrequency: 'yearly', dueMonth: 7 });
      });

      it('yearly + { due_month: null } -> 400', () => {
        expect(() => handler.validateUpdate(pe({ due_month: null }), stored(), BRL)).toThrow(BadRequestException);
      });

      it('yearly + { charge_frequency: monthly } -> ok, due_month cleared', () => {
        expect(handler.validateUpdate(pe({ charge_frequency: 'monthly' }), stored(), BRL)).toMatchObject({
          chargeFrequency: 'monthly',
          dueMonth: null,
        });
      });

      it('yearly + { charge_frequency: monthly, due_month: 5 } -> 400', () => {
        expect(() => handler.validateUpdate(pe({ charge_frequency: 'monthly', due_month: 5 }), stored(), BRL)).toThrow(
          BadRequestException,
        );
      });

      it('monthly + { due_month: 5 } -> 400', () => {
        expect(() => handler.validateUpdate(pe({ due_month: 5 }), monthly(), BRL)).toThrow(BadRequestException);
      });

      it('monthly + { charge_frequency: yearly } -> 400 (no month)', () => {
        expect(() => handler.validateUpdate(pe({ charge_frequency: 'yearly' }), monthly(), BRL)).toThrow(BadRequestException);
      });

      it('monthly + { charge_frequency: yearly, due_month: 5 } -> ok', () => {
        expect(handler.validateUpdate(pe({ charge_frequency: 'yearly', due_month: 5 }), monthly(), BRL)).toMatchObject({
          chargeFrequency: 'yearly',
          dueMonth: 5,
        });
      });
    });

    it('rescales the stored expected amount when the currency changes (200.00 BRL -> 200 JPY)', () => {
      expect(handler.validateUpdate(undefined, stored({ expectedAmount: 20000n }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toMatchObject({ expectedAmount: 200n });
      expect(handler.validateUpdate(undefined, stored({ expectedAmount: 200n }), {
        currency: 'BRL',
        previousCurrency: 'JPY',
      })).toMatchObject({ expectedAmount: 20000n });
    });

    it('rejects an unrepresentable rescale (12.50 BRL to JPY)', () => {
      expect(() => handler.validateUpdate(undefined, stored({ expectedAmount: 1250n }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toThrow(BadRequestException);
    });

    it('does not rescale an expected amount replaced in the same request, and validates it against the new currency', () => {
      const context = { currency: 'JPY', previousCurrency: 'BRL' };

      expect(handler.validateUpdate(pe({ expected_amount: '13' }), stored({ expectedAmount: 1250n }), context))
        .toMatchObject({ expectedAmount: 13n });
      expect(() => handler.validateUpdate(pe({ expected_amount: '13.5' }), stored({ expectedAmount: 1250n }), context))
        .toThrow(BadRequestException);
      expect(handler.validateUpdate(pe({ expected_amount: null }), stored({ expectedAmount: 1250n }), context))
        .toMatchObject({ expectedAmount: null });
    });

    it('keeps a null expected amount on a currency change', () => {
      expect(handler.validateUpdate(undefined, stored({ expectedAmount: null }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toMatchObject({ expectedAmount: null });
    });
  });

  describe('loadDetails', () => {
    it('loads every row in one query, keyed by account id', async () => {
      const rows = [stored(), Object.assign(stored(), { accountId: 2 })];
      const bills = [Object.assign(new ProviderBill(), { id: 5, providerAccountId: 2, payingAccountId: null })];
      const find = jest.fn(async () => rows);
      const findBills = jest.fn(async () => bills);
      const manager = { getRepository: jest.fn((entity: unknown) => ({ find: entity === ProviderBill ? findBills : find })) };

      const details = await handler.loadDetails([1, 2], manager as never);

      expect(find).toHaveBeenCalledTimes(1);
      expect(findBills).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(ProviderExpenseDetails);
      expect([...details.keys()]).toEqual([1, 2]);
      expect((details.get(1) as { recurringBills: unknown[] }).recurringBills).toEqual([]);
      expect((details.get(2) as { recurringBills: ProviderBill[] }).recurringBills.map(({ id }) => id)).toEqual([5]);
      expect(details.get(2)).toMatchObject({ dueDay: 10, expectedAmount: 20000n });
    });

    it('skips the query for no accounts', async () => {
      const manager = { getRepository: jest.fn() };

      await expect(handler.loadDetails([], manager as never)).resolves.toEqual(new Map());
      expect(manager.getRepository).not.toHaveBeenCalled();
    });
  });

  describe('saveDetails', () => {
    it('upserts the row keyed by the account id', async () => {
      const save = jest.fn(async (row: unknown) => row);
      const manager = { getRepository: jest.fn((entity: unknown) => (entity === ProviderExpenseDetails ? { save } : billsRepo())) };

      await handler.saveDetails(buildAccount({ id: 42 }), { ...defaultProviderExpenseState(), dueDay: 5 }, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(ProviderExpenseDetails);
      expect(save).toHaveBeenCalledWith({ ...defaultProviderExpenseState(), dueDay: 5, accountId: 42 });
    });

    it('saves the defaults when nothing was prepared', async () => {
      const save = jest.fn(async (row: unknown) => row);
      const manager = { getRepository: (entity: unknown) => (entity === ProviderExpenseDetails ? { save } : billsRepo()) };

      await handler.saveDetails(buildAccount({ id: 42 }), undefined, manager as never);

      expect(save).toHaveBeenCalledWith({ ...defaultProviderExpenseState(), accountId: 42 });
    });
  });

  describe('saveDetails and the recurring provider bill', () => {
    const bill = (fields: object = {}) => ({ id: 3, providerAccountId: 42, kind: 'recurring', description: 'Old', dueDay: 10, dueMonth: 3, showInCalendar: true, ...fields });
    // Prepares like the validate step does (so the write-through knows what was sent), then overrides the state.
    const prepare = (nested: object | undefined, state: object = {}, context: object = {}) => {
      const prepared = handler.validateUpdate(nested, stored(), { currency: 'BRL', previousCurrency: 'BRL', ...context });

      return Object.assign(prepared as object, state);
    };
    const run = async (prepared: object, bills: object[] = [], account = buildAccount({ id: 42, name: 'Vivo' })) => {
      const billRepo = { ...billsRepo(), find: jest.fn(async () => bills) };
      const accountRepo = { findOne: jest.fn(async () => account), findOneBy: jest.fn(async () => null) };
      const details = { save: jest.fn() };
      const manager = { getRepository: (entity: unknown) => (entity === ProviderExpenseDetails ? details : entity === Account ? accountRepo : billRepo) };
      await handler.saveDetails(account, prepared, manager as never);

      return { bills: billRepo, accounts: accountRepo, details };
    };

    it('locks the provider and loads its recurring bills when a schedule field is sent', async () => {
      const { bills, accounts } = await run(prepare(pe({ due_day: 5 }), { dueDay: 5 }));

      expect(accounts.findOne).toHaveBeenCalledWith({ where: { id: 42 }, lock: { mode: 'pessimistic_write' } });
      expect(bills.find).toHaveBeenCalledWith({ where: { providerAccountId: 42, kind: 'recurring' }, lock: { mode: 'pessimistic_write' } });
    });

    it('inserts a recurring bill named after the account when due_day is set and none exists', async () => {
      const { bills } = await run(prepare(pe({ due_day: 5 }), { dueDay: 5, expectedAmount: 100n, dueMonth: 3, chargeFrequency: 'yearly', billsFrom: '2026-01-01', payingAccountId: 9 }));

      expect(bills.save).toHaveBeenCalledWith(expect.objectContaining({
        providerAccountId: 42, kind: 'recurring', description: 'Vivo', expectedAmount: 100n, chargeFrequency: 'yearly',
        dueDay: 5, dueMonth: 3, billsFrom: '2026-01-01', showInCalendar: true, payingAccountId: 9,
      }));
    });

    it('updates the only bill (same id) keeping its description', async () => {
      const { bills } = await run(prepare(pe({ due_day: 7 }), { dueDay: 7 }), [bill({ showInCalendar: false })]);

      expect(bills.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, description: 'Old', dueDay: 7, showInCalendar: true }));
    });

    it('hides the only bill, keeping its schedule and description, when due_day is cleared', async () => {
      const { bills } = await run(prepare(pe({ due_day: null }), { dueDay: null }), [bill()]);

      expect(bills.save).toHaveBeenCalledWith({ ...bill(), showInCalendar: false });
    });

    it('does nothing when due_day is null and there is no bill', async () => {
      const { bills } = await run(prepare(pe({ due_day: null }), { dueDay: null }));

      expect(bills.save).not.toHaveBeenCalled();
    });

    it('does not touch the bills (nor lock) when no schedule field is sent and nothing was renamed', async () => {
      const { bills, accounts } = await run(prepare(pe({ for_accountant: false }), {}, { previousName: 'Vivo' }), [bill()]);

      expect(bills.save).not.toHaveBeenCalled();
      expect(bills.find).not.toHaveBeenCalled();
      expect(accounts.findOne).not.toHaveBeenCalled();
    });

    it('renames the only recurring bill after the account when the name changed', async () => {
      const { bills } = await run(prepare(undefined, {}, { previousName: 'Old name' }), [bill()]);

      expect(bills.save).toHaveBeenCalledWith({ ...bill(), description: 'Vivo' });
    });

    it('does not rename with zero or several recurring bills', async () => {
      const none = await run(prepare(undefined, {}, { previousName: 'Old name' }));
      const several = await run(prepare(undefined, {}, { previousName: 'Old name' }), [bill(), bill({ id: 4 })]);

      expect(none.bills.save).not.toHaveBeenCalled();
      expect(several.bills.save).not.toHaveBeenCalled();
    });

    it('answers 409 PROVIDER_HAS_MULTIPLE_BILLS before writing when a schedule field meets several bills', async () => {
      const prepared = prepare(pe({ due_day: 5 }), { dueDay: 5 });
      const billRepo = { ...billsRepo(), find: jest.fn(async () => [bill(), bill({ id: 4 })]) };
      const details = { save: jest.fn() };
      const manager = { getRepository: (entity: unknown) => (entity === ProviderExpenseDetails ? details : entity === Account ? { findOne: jest.fn() } : billRepo) };

      await expect(handler.saveDetails(buildAccount({ id: 42 }), prepared, manager as never)).rejects.toMatchObject({ response: { code: 'PROVIDER_HAS_MULTIPLE_BILLS' } });
      expect(details.save).not.toHaveBeenCalled();
    });

    it('rescales every bill on a currency change and re-checks their paying accounts', async () => {
      const prepared = prepare(undefined, {}, { previousCurrency: 'BRL', currency: 'USD' });
      const rows = [bill({ expectedAmount: 1250n, payingAccountId: 5, kind: 'recurring' }), bill({ id: 4, kind: 'one_off', expectedAmount: 700n, payingAccountId: null })];
      const billRepo = { ...billsRepo(), find: jest.fn(async () => rows) };
      const paying = { findOneBy: jest.fn(async () => buildAccount({ id: 5, currency: 'USD' })), findOne: jest.fn() };
      const manager = { getRepository: (entity: unknown) => (entity === ProviderExpenseDetails ? { save: jest.fn() } : entity === Account ? paying : billRepo) };

      await handler.saveDetails(buildAccount({ id: 42, currency: 'USD' }), prepared, manager as never);

      expect(paying.findOneBy).toHaveBeenCalledWith(expect.objectContaining({ id: 5, type: 'regular' }));
      expect(billRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('serialize', () => {
    it('serializes snake_case with the amount in the currency exponent', () => {
      expect(handler.serialize(stored(), buildAccount({ currency: 'BRL' }))).toEqual({
        for_accountant: true,
        provider_tax_id: '12.345.678/0001-90',
        expected_amount: '200.00',
        charge_frequency: 'yearly',
        due_day: 10,
        due_month: 3,
        bills_from: null,
        show_in_calendar: true,
        paying_account: null,
      });
      expect(handler.serialize(stored({ expectedAmount: 200n }), buildAccount({ currency: 'JPY' })))
        .toMatchObject({ expected_amount: '200' });
    });

    describe('source of the schedule fields', () => {
      const bill = (overrides: Partial<ProviderBill> = {}) => Object.assign(new ProviderBill(), {
        id: 5,
        kind: 'recurring',
        expectedAmount: 1500n,
        chargeFrequency: 'monthly',
        dueDay: 7,
        dueMonth: null,
        billsFrom: '2026-02-01',
        showInCalendar: false,
        payingAccountId: 9,
        payingAccount: { id: 9, name: 'Checking' },
        ...overrides,
      });
      const withBills = (bills: ProviderBill[]) => Object.assign(stored(), { recurringBills: bills });

      it('reads the single recurring bill as stored, keeping the details row\'s accountant fields', () => {
        expect(handler.serialize(withBills([bill()]), buildAccount({ currency: 'BRL' }))).toEqual({
          for_accountant: true,
          provider_tax_id: '12.345.678/0001-90',
          expected_amount: '15.00',
          charge_frequency: 'monthly',
          due_day: 7,
          due_month: null,
          bills_from: '2026-02-01',
          show_in_calendar: false,
          paying_account: { id: 9, name: 'Checking' },
        });
      });

      it('reads the details row when there is no recurring bill', () => {
        expect(handler.serialize(withBills([]), buildAccount({ currency: 'BRL' }))).toMatchObject({ due_day: 10, expected_amount: '200.00' });
      });

      it('answers null for all seven schedule fields with two or more recurring bills', () => {
        expect(handler.serialize(withBills([bill(), bill({ id: 6 })]), buildAccount({ currency: 'BRL' }))).toEqual({
          for_accountant: true,
          provider_tax_id: '12.345.678/0001-90',
          expected_amount: null,
          charge_frequency: null,
          due_day: null,
          due_month: null,
          bills_from: null,
          show_in_calendar: null,
          paying_account: null,
        });
      });

      it('does not leak the bills into the merge base', () => {
        expect(handler.validateUpdate(undefined, withBills([bill()]), BRL)).not.toHaveProperty('recurringBills');
      });
    });

    it('returns unset fields as null (and the defaults without a row)', () => {
      expect(handler.serialize(undefined, buildAccount())).toEqual({
        for_accountant: true,
        provider_tax_id: null,
        expected_amount: null,
        charge_frequency: 'monthly',
        due_day: null,
        due_month: null,
        bills_from: null,
        show_in_calendar: true,
        paying_account: null,
      });
    });
  });
});
