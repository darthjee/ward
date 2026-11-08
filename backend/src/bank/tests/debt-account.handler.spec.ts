import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import { DebtAccountHandler } from '../account-types/debt-account.handler.js';
import { defaultDebtState, type DebtState } from '../account-types/debt-details.js';
import { normaliseRate } from '../account-types/rate.js';
import type { DebtDetailsDto } from '../dto/debt-details.dto.js';
import { DebtDetails } from '../entities/debt-details.entity.js';

const BRL = { currency: 'BRL' };

function stored(overrides: Partial<DebtState> = {}): DebtDetails {
  return Object.assign(new DebtDetails(), {
    accountId: 1,
    ...defaultDebtState(),
    interestRate: '1.9900',
    interestPeriod: 'monthly',
    instalmentAmount: 50000n,
    instalmentFrequency: 'yearly',
    dueDay: 10,
    dueMonth: 3,
    instalmentCount: 12,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const debt = (fields: Partial<DebtDetailsDto>): DebtDetailsDto => fields as DebtDetailsDto;

describe('DebtAccountHandler', () => {
  const handler = new DebtAccountHandler();

  it('serves debt and carries a ledger', () => {
    expect(handler.type).toBe('debt');
    expect(handler.carriesLedger).toBe(true);
  });

  describe('validateCreate', () => {
    it('uses the defaults without a debt object', () => {
      expect(handler.validateCreate(undefined, BRL)).toEqual(defaultDebtState());
      expect(defaultDebtState()).toEqual({
        interestRate: null,
        interestPeriod: null,
        instalmentAmount: null,
        instalmentFrequency: 'monthly',
        dueDay: null,
        dueMonth: null,
        instalmentCount: null,
      });
    });

    it('accepts a full yearly debt and parses the amount in the account currency', () => {
      expect(handler.validateCreate(debt({
        interest_rate: '1.99',
        interest_period: 'yearly',
        instalment_amount: '500.5',
        instalment_frequency: 'yearly',
        due_day: 31,
        due_month: 12,
        instalment_count: 1,
      }), BRL)).toEqual({
        interestRate: '1.99',
        interestPeriod: 'yearly',
        instalmentAmount: 50050n,
        instalmentFrequency: 'yearly',
        dueDay: 31,
        dueMonth: 12,
        instalmentCount: 1,
      });
    });

    it('parses the amount against a zero-decimal currency', () => {
      expect(handler.validateCreate(debt({ instalment_amount: '500' }), { currency: 'JPY' })).toMatchObject({
        instalmentAmount: 500n,
      });
      expect(() => handler.validateCreate(debt({ instalment_amount: '500.5' }), { currency: 'JPY' })).toThrow(
        BadRequestException,
      );
    });

    it.each([
      ['a rate without a period', { interest_rate: '1' }],
      ['a period without a rate', { interest_period: 'monthly' }],
      ['yearly without due_month', { instalment_frequency: 'yearly' }],
      ['due_month with monthly', { due_month: 3 }],
      ['due_month with an explicit monthly', { instalment_frequency: 'monthly', due_month: 3 }],
      ['a zero instalment amount', { instalment_amount: '0' }],
      ['a negative instalment amount', { instalment_amount: '-1.00' }],
      ['an instalment amount with too many decimals', { instalment_amount: '1.001' }],
      ['an instalment amount over the bound', { instalment_amount: '100000000000.01' }],
      ['a malformed instalment amount', { instalment_amount: 'abc' }],
    ])('rejects %s with a 400', (_label, fields) => {
      expect(() => handler.validateCreate(debt(fields as Partial<DebtDetailsDto>), BRL)).toThrow(BadRequestException);
    });

    it('accepts a zero rate with a period and the amount bound itself', () => {
      expect(handler.validateCreate(debt({ interest_rate: '0', interest_period: 'monthly' }), BRL)).toMatchObject({
        interestRate: '0',
      });
      expect(handler.validateCreate(debt({ instalment_amount: '100000000000.00' }), BRL)).toMatchObject({
        instalmentAmount: 10n ** 13n,
      });
    });
  });

  describe('validateUpdate', () => {
    it('keeps the stored state when no debt object is sent', () => {
      expect(handler.validateUpdate(undefined, stored(), BRL)).toEqual({
        interestRate: '1.9900',
        interestPeriod: 'monthly',
        instalmentAmount: 50000n,
        instalmentFrequency: 'yearly',
        dueDay: 10,
        dueMonth: 3,
        instalmentCount: 12,
      });
    });

    it('falls back to the defaults when there is no stored row', () => {
      expect(handler.validateUpdate(debt({ due_day: 5 }), undefined, BRL)).toEqual({ ...defaultDebtState(), dueDay: 5 });
    });

    it('merges partially: omitted fields are unchanged', () => {
      expect(handler.validateUpdate(debt({ interest_rate: '2.5', due_day: 1 }), stored(), BRL)).toMatchObject({
        interestRate: '2.5',
        interestPeriod: 'monthly',
        instalmentAmount: 50000n,
        dueDay: 1,
        dueMonth: 3,
      });
    });

    it('clears fields sent as null', () => {
      expect(handler.validateUpdate(debt({
        interest_rate: null,
        interest_period: null,
        instalment_amount: null,
        due_day: null,
        instalment_count: null,
      }), stored(), BRL)).toMatchObject({
        interestRate: null,
        interestPeriod: null,
        instalmentAmount: null,
        dueDay: null,
        instalmentCount: null,
      });
    });

    it('rejects clearing only one of rate and period (merged state)', () => {
      expect(() => handler.validateUpdate(debt({ interest_period: null }), stored(), BRL)).toThrow(BadRequestException);
      expect(() => handler.validateUpdate(debt({ interest_rate: null }), stored(), BRL)).toThrow(BadRequestException);
    });

    it('clears due_month when switching yearly to monthly', () => {
      expect(handler.validateUpdate(debt({ instalment_frequency: 'monthly' }), stored(), BRL)).toMatchObject({
        instalmentFrequency: 'monthly',
        dueMonth: null,
      });
      expect(handler.validateUpdate(debt({ instalment_frequency: 'monthly', due_month: null }), stored(), BRL))
        .toMatchObject({ dueMonth: null });
    });

    it('rejects a non-null due_month with a merged monthly frequency', () => {
      expect(() => handler.validateUpdate(debt({ instalment_frequency: 'monthly', due_month: 4 }), stored(), BRL))
        .toThrow(BadRequestException);
      expect(() => handler.validateUpdate(debt({ due_month: 4 }), stored({ instalmentFrequency: 'monthly', dueMonth: null }), BRL))
        .toThrow(BadRequestException);
    });

    it('requires due_month when switching monthly to yearly', () => {
      const monthly = stored({ instalmentFrequency: 'monthly', dueMonth: null });

      expect(() => handler.validateUpdate(debt({ instalment_frequency: 'yearly' }), monthly, BRL)).toThrow(BadRequestException);
      expect(handler.validateUpdate(debt({ instalment_frequency: 'yearly', due_month: 1 }), monthly, BRL)).toMatchObject({
        instalmentFrequency: 'yearly',
        dueMonth: 1,
      });
    });

    it('rejects clearing due_month on a yearly debt', () => {
      expect(() => handler.validateUpdate(debt({ due_month: null }), stored(), BRL)).toThrow(BadRequestException);
    });

    it('rescales the stored instalment amount when the currency changes', () => {
      expect(handler.validateUpdate(undefined, stored({ instalmentAmount: 50000n }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toMatchObject({ instalmentAmount: 500n });
      expect(handler.validateUpdate(undefined, stored({ instalmentAmount: 500n }), {
        currency: 'BRL',
        previousCurrency: 'JPY',
      })).toMatchObject({ instalmentAmount: 50000n });
    });

    it('rejects an unrepresentable rescale (12.50 BRL to JPY)', () => {
      expect(() => handler.validateUpdate(undefined, stored({ instalmentAmount: 1250n }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toThrow(BadRequestException);
    });

    it('does not rescale an instalment amount replaced in the same request', () => {
      expect(handler.validateUpdate(debt({ instalment_amount: '13' }), stored({ instalmentAmount: 1250n }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toMatchObject({ instalmentAmount: 13n });
    });

    it('keeps a null instalment amount on a currency change', () => {
      expect(handler.validateUpdate(undefined, stored({ instalmentAmount: null }), {
        currency: 'JPY',
        previousCurrency: 'BRL',
      })).toMatchObject({ instalmentAmount: null });
    });
  });

  describe('loadDetails', () => {
    it('loads every row in one query, keyed by account id', async () => {
      const rows = [stored({}), Object.assign(stored(), { accountId: 2 })];
      const find = jest.fn(async () => rows);
      const manager = { getRepository: jest.fn(() => ({ find })) };

      const details = await handler.loadDetails([1, 2], manager as never);

      expect(find).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(DebtDetails);
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

      await handler.saveDetails(buildAccount({ id: 42 }), { ...defaultDebtState(), dueDay: 5 }, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(DebtDetails);
      expect(save).toHaveBeenCalledWith({ ...defaultDebtState(), dueDay: 5, accountId: 42 });
    });

    it('saves the defaults when nothing was prepared', async () => {
      const save = jest.fn(async (row: unknown) => row);
      const manager = { getRepository: () => ({ save }) };

      await handler.saveDetails(buildAccount({ id: 42 }), undefined, manager as never);

      expect(save).toHaveBeenCalledWith({ ...defaultDebtState(), accountId: 42 });
    });
  });

  describe('serialize', () => {
    it('serializes snake_case, with the amount in the currency exponent and the rate normalised', () => {
      expect(handler.serialize(stored(), buildAccount({ currency: 'BRL' }))).toEqual({
        interest_rate: '1.99',
        interest_period: 'monthly',
        instalment_amount: '500.00',
        instalment_frequency: 'yearly',
        due_day: 10,
        due_month: 3,
        instalment_count: 12,
      });
      expect(handler.serialize(stored({ instalmentAmount: 500n }), buildAccount({ currency: 'JPY' })))
        .toMatchObject({ instalment_amount: '500' });
    });

    it('returns unset fields as null (and the defaults without a row)', () => {
      expect(handler.serialize(undefined, buildAccount())).toEqual({
        interest_rate: null,
        interest_period: null,
        instalment_amount: null,
        instalment_frequency: 'monthly',
        due_day: null,
        due_month: null,
        instalment_count: null,
      });
    });
  });
});

describe('normaliseRate', () => {
  it.each([
    ['1.9900', '1.99'],
    ['0.0000', '0'],
    ['100.0000', '100'],
    ['2.5000', '2.5'],
    ['0.0001', '0.0001'],
    ['10', '10'],
    ['1.99', '1.99'],
  ])('normalises %p to %p', (stored, expected) => {
    expect(normaliseRate(stored)).toBe(expected);
  });
});
