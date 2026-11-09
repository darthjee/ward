import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { defaultProviderExpenseState, type ProviderExpenseState } from '../account-types/provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

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
      });
    });

    it('falls back to the defaults when there is no stored row', () => {
      expect(handler.validateUpdate(pe({ due_day: 5 }), undefined, BRL)).toEqual({ ...defaultProviderExpenseState(), dueDay: 5 });
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
      const find = jest.fn(async () => rows);
      const manager = { getRepository: jest.fn(() => ({ find })) };

      const details = await handler.loadDetails([1, 2], manager as never);

      expect(find).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(ProviderExpenseDetails);
      expect([...details.keys()]).toEqual([1, 2]);
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
      const manager = { getRepository: jest.fn(() => ({ save })) };

      await handler.saveDetails(buildAccount({ id: 42 }), { ...defaultProviderExpenseState(), dueDay: 5 }, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(ProviderExpenseDetails);
      expect(save).toHaveBeenCalledWith({ ...defaultProviderExpenseState(), dueDay: 5, accountId: 42 });
    });

    it('saves the defaults when nothing was prepared', async () => {
      const save = jest.fn(async (row: unknown) => row);
      const manager = { getRepository: () => ({ save }) };

      await handler.saveDetails(buildAccount({ id: 42 }), undefined, manager as never);

      expect(save).toHaveBeenCalledWith({ ...defaultProviderExpenseState(), accountId: 42 });
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
      });
      expect(handler.serialize(stored({ expectedAmount: 200n }), buildAccount({ currency: 'JPY' })))
        .toMatchObject({ expected_amount: '200' });
    });

    it('returns unset fields as null (and the defaults without a row)', () => {
      expect(handler.serialize(undefined, buildAccount())).toEqual({
        for_accountant: true,
        provider_tax_id: null,
        expected_amount: null,
        charge_frequency: 'monthly',
        due_day: null,
        due_month: null,
      });
    });
  });
});
