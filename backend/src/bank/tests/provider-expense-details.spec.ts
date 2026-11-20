import {
  defaultProviderExpenseState,
  mergeProviderExpenseState,
  providerExpenseStateOf,
  serializeProviderExpense,
  type ProviderExpenseState,
} from '../account-types/provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

const STORED: ProviderExpenseState = { forAccountant: false, providerTaxId: '12.345.678/0001-90' };

const dto = (fields: Partial<ProviderExpenseDetailsDto>): ProviderExpenseDetailsDto => fields as ProviderExpenseDetailsDto;

describe('provider-expense details helpers', () => {
  describe('defaultProviderExpenseState', () => {
    it('defaults for_accountant to true and the tax id to null', () => {
      expect(defaultProviderExpenseState()).toEqual({ forAccountant: true, providerTaxId: null });
    });
  });

  describe('providerExpenseStateOf', () => {
    it('returns the defaults without a row', () => {
      expect(providerExpenseStateOf(undefined)).toEqual(defaultProviderExpenseState());
    });

    it('keeps only the provider-expense fields of a row', () => {
      const row = Object.assign(new ProviderExpenseDetails(), { ...STORED, accountId: 7, createdAt: new Date(), updatedAt: new Date() });

      expect(providerExpenseStateOf(row)).toEqual(STORED);
    });
  });

  describe('mergeProviderExpenseState', () => {
    it('keeps the base for an empty body', () => {
      expect(mergeProviderExpenseState(STORED, dto({}))).toEqual(STORED);
    });

    it('copies the sent fields, null clearing the tax id', () => {
      expect(mergeProviderExpenseState(STORED, dto({ for_accountant: true, provider_tax_id: null }))).toEqual({
        forAccountant: true,
        providerTaxId: null,
      });
    });

    it('does not mutate the base', () => {
      const base = { ...STORED };

      mergeProviderExpenseState(base, dto({ provider_tax_id: 'X' }));

      expect(base).toEqual(STORED);
    });
  });

  describe('serializeProviderExpense', () => {
    it('answers exactly for_accountant and provider_tax_id', () => {
      expect(serializeProviderExpense(STORED)).toEqual({ for_accountant: false, provider_tax_id: '12.345.678/0001-90' });
    });

    it('answers the defaults without a row', () => {
      expect(serializeProviderExpense(undefined)).toEqual({ for_accountant: true, provider_tax_id: null });
    });
  });
});
