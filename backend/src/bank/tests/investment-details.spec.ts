import { BadRequestException } from '@nestjs/common';
import {
  assertInvestmentPairs,
  defaultInvestmentState,
  investmentStateOf,
  mergeInvestmentState,
  serializeInvestmentState,
  type InvestmentState,
} from '../account-types/investment-details.js';
import type { InvestmentDetailsDto } from '../dto/investment-details.dto.js';
import { InvestmentDetails } from '../entities/investment-details.entity.js';

const FULL: InvestmentState = {
  kind: 'fixed_income',
  yieldRate: '1.1000',
  yieldPeriod: 'monthly',
  maturityDate: '2030-01-15',
  liquidityDays: 30,
};

const dto = (fields: Partial<InvestmentDetailsDto>): InvestmentDetailsDto => fields as InvestmentDetailsDto;

describe('investment details helpers', () => {
  describe('defaultInvestmentState', () => {
    it('has every field null', () => {
      expect(defaultInvestmentState()).toEqual({
        kind: null,
        yieldRate: null,
        yieldPeriod: null,
        maturityDate: null,
        liquidityDays: null,
      });
    });
  });

  describe('investmentStateOf', () => {
    it('returns the defaults without a row', () => {
      expect(investmentStateOf(undefined)).toEqual(defaultInvestmentState());
    });

    it('keeps only the investment fields of a row', () => {
      const row = Object.assign(new InvestmentDetails(), { ...FULL, accountId: 4, createdAt: new Date(), updatedAt: new Date() });

      expect(investmentStateOf(row)).toEqual(FULL);
    });
  });

  describe('mergeInvestmentState', () => {
    it('keeps the fields that are not sent', () => {
      expect(mergeInvestmentState(FULL, dto({ liquidity_days: 0 }))).toEqual({ ...FULL, liquidityDays: 0 });
    });

    it('clears the fields sent as null', () => {
      expect(mergeInvestmentState(FULL, dto({
        kind: null,
        yield_rate: null,
        yield_period: null,
        maturity_date: null,
        liquidity_days: null,
      }))).toEqual(defaultInvestmentState());
    });

    it('copies every sent field', () => {
      expect(mergeInvestmentState(defaultInvestmentState(), dto({
        kind: 'crypto',
        yield_rate: '12.5',
        yield_period: 'yearly',
        maturity_date: '2020-02-29',
        liquidity_days: 2,
      }))).toEqual({ kind: 'crypto', yieldRate: '12.5', yieldPeriod: 'yearly', maturityDate: '2020-02-29', liquidityDays: 2 });
    });

    it('does not mutate the base', () => {
      const base = { ...FULL };

      mergeInvestmentState(base, dto({ kind: 'fund' }));

      expect(base).toEqual(FULL);
    });
  });

  describe('assertInvestmentPairs', () => {
    it.each([
      ['both set', { ...FULL }],
      ['both unset', defaultInvestmentState()],
      ['a zero rate with a period', { ...FULL, yieldRate: '0' }],
    ])('accepts %s', (_label, state) => {
      expect(() => assertInvestmentPairs(state)).not.toThrow();
    });

    it.each([
      ['a rate without a period', { ...FULL, yieldPeriod: null }],
      ['a period without a rate', { ...FULL, yieldRate: null }],
    ])('rejects %s with a 400', (_label, state) => {
      expect(() => assertInvestmentPairs(state)).toThrow(BadRequestException);
    });
  });

  describe('serializeInvestmentState', () => {
    it('serializes snake_case with the rate normalised', () => {
      expect(serializeInvestmentState(FULL)).toEqual({
        kind: 'fixed_income',
        yield_rate: '1.1',
        yield_period: 'monthly',
        maturity_date: '2030-01-15',
        liquidity_days: 30,
      });
    });

    it.each([
      ['1.1000', '1.1'],
      ['0.0000', '0'],
      ['100.0000', '100'],
      ['12.3456', '12.3456'],
    ])('serializes the stored rate %p as %p', (stored, expected) => {
      expect(serializeInvestmentState({ ...FULL, yieldRate: stored }).yield_rate).toBe(expected);
    });

    it('returns unset fields as null', () => {
      expect(serializeInvestmentState(defaultInvestmentState())).toEqual({
        kind: null,
        yield_rate: null,
        yield_period: null,
        maturity_date: null,
        liquidity_days: null,
      });
    });
  });
});
