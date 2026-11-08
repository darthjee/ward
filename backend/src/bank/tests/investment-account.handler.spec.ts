import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import type { AccountTypeHandler } from '../account-types/account-type-handler.js';
import { InvestmentAccountHandler } from '../account-types/investment-account.handler.js';
import { defaultInvestmentState, type InvestmentState } from '../account-types/investment-details.js';
import type { InvestmentDetailsDto } from '../dto/investment-details.dto.js';
import { InvestmentDetails } from '../entities/investment-details.entity.js';

function stored(overrides: Partial<InvestmentState> = {}): InvestmentDetails {
  return Object.assign(new InvestmentDetails(), {
    accountId: 1,
    kind: 'fixed_income',
    yieldRate: '1.1000',
    yieldPeriod: 'monthly',
    maturityDate: '2030-01-15',
    liquidityDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const investment = (fields: Partial<InvestmentDetailsDto>): InvestmentDetailsDto => fields as InvestmentDetailsDto;

describe('InvestmentAccountHandler', () => {
  const handler = new InvestmentAccountHandler();

  it('serves investment and carries a ledger', () => {
    expect(handler.type).toBe('investment');
    expect(handler.carriesLedger).toBe(true);
  });

  describe('validateAccount', () => {
    it('accepts a zero opening balance', () => {
      expect(() => handler.validateAccount(buildAccount({ type: 'investment', openingBalance: 0n }))).not.toThrow();
    });

    it.each([1n, -1n, 100000n])('rejects the opening balance %p with a 400', (openingBalance) => {
      expect(() => handler.validateAccount(buildAccount({ type: 'investment', openingBalance }))).toThrow(
        new BadRequestException('opening_balance must be 0 on investment accounts'),
      );
    });
  });

  describe('validateCreate', () => {
    it('uses all-null details without an investment object', () => {
      expect(handler.validateCreate(undefined)).toEqual(defaultInvestmentState());
    });

    it('accepts a full investment', () => {
      expect(handler.validateCreate(investment({
        kind: 'fund',
        yield_rate: '12.5',
        yield_period: 'yearly',
        maturity_date: '2020-01-01',
        liquidity_days: 0,
      }))).toEqual({ kind: 'fund', yieldRate: '12.5', yieldPeriod: 'yearly', maturityDate: '2020-01-01', liquidityDays: 0 });
    });

    it.each([
      ['a rate without a period', { yield_rate: '1' }],
      ['a period without a rate', { yield_period: 'monthly' }],
    ])('rejects %s with a 400', (_label, fields) => {
      expect(() => handler.validateCreate(investment(fields as Partial<InvestmentDetailsDto>))).toThrow(BadRequestException);
    });

    it('accepts a zero rate with a period', () => {
      expect(handler.validateCreate(investment({ yield_rate: '0', yield_period: 'monthly' }))).toMatchObject({ yieldRate: '0' });
    });
  });

  describe('validateUpdate', () => {
    it('keeps the stored state when no investment object is sent', () => {
      expect(handler.validateUpdate(undefined, stored())).toEqual({
        kind: 'fixed_income',
        yieldRate: '1.1000',
        yieldPeriod: 'monthly',
        maturityDate: '2030-01-15',
        liquidityDays: 30,
      });
    });

    it('falls back to all-null details when there is no stored row', () => {
      expect(handler.validateUpdate(investment({ kind: 'other' }), undefined)).toEqual({ ...defaultInvestmentState(), kind: 'other' });
    });

    it('accepts a rate alone when a period is stored (merged state)', () => {
      expect(handler.validateUpdate(investment({ yield_rate: '3' }), stored())).toMatchObject({
        yieldRate: '3',
        yieldPeriod: 'monthly',
        kind: 'fixed_income',
      });
    });

    it('rejects clearing only one of rate and period (merged state)', () => {
      expect(() => handler.validateUpdate(investment({ yield_period: null }), stored())).toThrow(BadRequestException);
      expect(() => handler.validateUpdate(investment({ yield_rate: null }), stored())).toThrow(BadRequestException);
    });

    it('rejects a rate alone when nothing is stored', () => {
      expect(() => handler.validateUpdate(investment({ yield_rate: '3' }), stored({ yieldRate: null, yieldPeriod: null })))
        .toThrow(BadRequestException);
    });

    it('clears the rate with both rate and period null', () => {
      expect(handler.validateUpdate(investment({ yield_rate: null, yield_period: null }), stored())).toMatchObject({
        yieldRate: null,
        yieldPeriod: null,
        liquidityDays: 30,
      });
    });

    it('ignores a currency change (no amounts to rescale)', () => {
      const generic: AccountTypeHandler = handler;

      expect(generic.validateUpdate(undefined, stored(), { currency: 'JPY', previousCurrency: 'BRL' })).toEqual(
        handler.validateUpdate(undefined, stored()),
      );
    });
  });

  describe('loadDetails', () => {
    it('loads every row in one query, keyed by account id', async () => {
      const rows = [stored(), Object.assign(stored(), { accountId: 2 })];
      const find = jest.fn(async () => rows);
      const manager = { getRepository: jest.fn(() => ({ find })) };

      const details = await handler.loadDetails([1, 2], manager as never);

      expect(find).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(InvestmentDetails);
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

      await handler.saveDetails(buildAccount({ id: 42 }), { ...defaultInvestmentState(), kind: 'stocks' }, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(InvestmentDetails);
      expect(save).toHaveBeenCalledWith({ ...defaultInvestmentState(), kind: 'stocks', accountId: 42 });
    });

    it('writes an all-null row when nothing was prepared', async () => {
      const save = jest.fn(async (row: unknown) => row);
      const manager = { getRepository: () => ({ save }) };

      await handler.saveDetails(buildAccount({ id: 42 }), undefined, manager as never);

      expect(save).toHaveBeenCalledWith({
        kind: null,
        yieldRate: null,
        yieldPeriod: null,
        maturityDate: null,
        liquidityDays: null,
        accountId: 42,
      });
    });
  });

  describe('serialize', () => {
    it('serializes snake_case with the rate normalised', () => {
      expect(handler.serialize(stored())).toEqual({
        kind: 'fixed_income',
        yield_rate: '1.1',
        yield_period: 'monthly',
        maturity_date: '2030-01-15',
        liquidity_days: 30,
      });
    });

    it('returns unset fields as null without a row', () => {
      expect(handler.serialize(undefined)).toEqual({
        kind: null,
        yield_rate: null,
        yield_period: null,
        maturity_date: null,
        liquidity_days: null,
      });
    });
  });
});
