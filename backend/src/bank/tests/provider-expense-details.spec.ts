import { BadRequestException } from '@nestjs/common';
import {
  assertProviderExpensePairs,
  defaultProviderExpenseState,
  EXPECTED_AMOUNT_FIELD,
  mergeProviderExpenseState,
  parseExpectedAmount,
  providerExpenseStateOf,
  rescaleProviderExpenseState,
  serializeProviderExpenseState,
  type ProviderExpenseState,
} from '../account-types/provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

const YEARLY: ProviderExpenseState = {
  forAccountant: false,
  providerTaxId: '12.345.678/0001-90',
  expectedAmount: 20000n,
  dueDay: 10,
  chargeFrequency: 'yearly',
  dueMonth: 3,
};

const dto = (fields: Partial<ProviderExpenseDetailsDto>): ProviderExpenseDetailsDto => fields as ProviderExpenseDetailsDto;

describe('provider-expense details helpers', () => {
  describe('defaultProviderExpenseState', () => {
    it('defaults for_accountant to true, the frequency to monthly and the rest to null', () => {
      expect(defaultProviderExpenseState()).toEqual({
        forAccountant: true,
        providerTaxId: null,
        expectedAmount: null,
        dueDay: null,
        chargeFrequency: 'monthly',
        dueMonth: null,
      });
    });
  });

  describe('providerExpenseStateOf', () => {
    it('returns the defaults without a row', () => {
      expect(providerExpenseStateOf(undefined)).toEqual(defaultProviderExpenseState());
    });

    it('keeps only the provider-expense fields of a row', () => {
      const row = Object.assign(new ProviderExpenseDetails(), { ...YEARLY, accountId: 7, createdAt: new Date(), updatedAt: new Date() });

      expect(providerExpenseStateOf(row)).toEqual(YEARLY);
    });
  });

  describe('parseExpectedAmount', () => {
    it('parses into minor units of the currency', () => {
      expect(parseExpectedAmount('200', 'BRL')).toBe(20000n);
      expect(parseExpectedAmount('200.5', 'BRL')).toBe(20050n);
      expect(parseExpectedAmount('200', 'JPY')).toBe(200n);
    });

    it.each([
      ['zero', '0', 'BRL'],
      ['a negative amount', '-1', 'BRL'],
      ['too many decimals', '1.001', 'BRL'],
      ['decimals on a zero-decimal currency', '1.5', 'JPY'],
      ['an amount over the bound', '100000000000.01', 'BRL'],
      ['a malformed amount', 'abc', 'BRL'],
    ])('rejects %s', (_label, value, currency) => {
      expect(() => parseExpectedAmount(value, currency)).toThrow(BadRequestException);
    });

    it('names the field in its errors', () => {
      expect(() => parseExpectedAmount('0', 'BRL')).toThrow(EXPECTED_AMOUNT_FIELD);
    });
  });

  describe('rescaleProviderExpenseState', () => {
    it('keeps the decimal value in the new exponent (200.00 BRL -> 200 JPY)', () => {
      expect(rescaleProviderExpenseState(YEARLY, 'BRL', 'JPY')).toEqual({ ...YEARLY, expectedAmount: 200n });
    });

    it('rejects an unrepresentable amount (12.50 BRL -> JPY)', () => {
      expect(() => rescaleProviderExpenseState({ ...YEARLY, expectedAmount: 1250n }, 'BRL', 'JPY')).toThrow(BadRequestException);
    });

    it('is a copy and a no-op without an amount or a currency change', () => {
      const noAmount = { ...YEARLY, expectedAmount: null };

      expect(rescaleProviderExpenseState(noAmount, 'BRL', 'JPY')).toEqual(noAmount);
      expect(rescaleProviderExpenseState(YEARLY, 'BRL', 'BRL')).toEqual(YEARLY);
      expect(rescaleProviderExpenseState(YEARLY, 'BRL', 'BRL')).not.toBe(YEARLY);
    });
  });

  describe('mergeProviderExpenseState', () => {
    it('copies sent fields and keeps omitted ones', () => {
      expect(mergeProviderExpenseState(YEARLY, dto({ due_day: 5, for_accountant: true }), 'BRL')).toEqual({
        ...YEARLY,
        dueDay: 5,
        forAccountant: true,
      });
    });

    it('clears nullable fields sent as null', () => {
      expect(mergeProviderExpenseState(YEARLY, dto({ provider_tax_id: null, expected_amount: null, due_day: null }), 'BRL'))
        .toMatchObject({ providerTaxId: null, expectedAmount: null, dueDay: null });
    });

    it('parses expected_amount against the given currency', () => {
      expect(mergeProviderExpenseState(YEARLY, dto({ expected_amount: '99.9' }), 'BRL')).toMatchObject({ expectedAmount: 9990n });
      expect(() => mergeProviderExpenseState(YEARLY, dto({ expected_amount: '99.9' }), 'JPY')).toThrow(BadRequestException);
    });

    it('clears due_month on a merged monthly frequency', () => {
      expect(mergeProviderExpenseState(YEARLY, dto({ charge_frequency: 'monthly' }), 'BRL')).toMatchObject({
        chargeFrequency: 'monthly',
        dueMonth: null,
      });
    });

    it('rejects a sent non-null due_month on a merged monthly frequency', () => {
      expect(() => mergeProviderExpenseState(defaultProviderExpenseState(), dto({ due_month: 5 }), 'BRL')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertProviderExpensePairs', () => {
    it('requires due_month with a yearly frequency', () => {
      expect(() => assertProviderExpensePairs({ ...YEARLY, dueMonth: null })).toThrow(BadRequestException);
      expect(() => assertProviderExpensePairs(YEARLY)).not.toThrow();
      expect(() => assertProviderExpensePairs(defaultProviderExpenseState())).not.toThrow();
    });
  });

  describe('serializeProviderExpenseState', () => {
    it('serializes snake_case with the amount in the currency exponent', () => {
      expect(serializeProviderExpenseState(YEARLY, 'BRL')).toEqual({
        for_accountant: false,
        provider_tax_id: '12.345.678/0001-90',
        expected_amount: '200.00',
        charge_frequency: 'yearly',
        due_day: 10,
        due_month: 3,
      });
      expect(serializeProviderExpenseState({ ...YEARLY, expectedAmount: 200n }, 'JPY')).toMatchObject({ expected_amount: '200' });
    });

    it('returns unset fields as null', () => {
      expect(serializeProviderExpenseState(defaultProviderExpenseState(), 'BRL')).toEqual({
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
