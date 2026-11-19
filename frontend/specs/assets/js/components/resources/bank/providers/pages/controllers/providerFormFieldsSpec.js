import {
  PROVIDER_FIELD_NAMES,
  changedProviderFields,
  emptyProviderFields,
  providerFieldsFromAccount,
  validateProviderFields,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js';

const NOW = new Date(2026, 4, 10);
const STORED = {
  id: 4,
  name: 'Office rent',
  bank_name: 'Landlord Ltd',
  branch: null,
  account_number: 'C-1',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-50.00',
  notes: null,
  type: 'provider_expense',
  provider_expense: {
    for_accountant: false,
    provider_tax_id: '12.345',
  },
};

function valid(overrides = {}) {
  return {
    ...emptyProviderFields('BRL', '2026-05-01'), name: 'Rent', ...overrides,
  };
}

function validate(overrides, options = {}) {
  return validateProviderFields(valid(overrides), { now: NOW, ...options });
}

describe('providerFormFields', () => {
  it('lists the provider fields', () => {
    expect(PROVIDER_FIELD_NAMES).toEqual(['for_accountant', 'provider_tax_id']);
  });

  describe('emptyProviderFields', () => {
    it('defaults For accountant on, without schedule fields', () => {
      const fields = emptyProviderFields('BRL', '2026-05-01');

      ['expected_amount', 'charge_frequency', 'due_day', 'due_month', 'bills_from', 'show_in_calendar', 'paying_account_id']
        .forEach((name) => expect(name in fields).toBeFalse());
      expect(emptyProviderFields('BRL', '2026-05-01')).toEqual(jasmine.objectContaining({
        currency: 'BRL',
        opening_date: '2026-05-01',
        opening_balance: '0',
        for_accountant: true,
        provider_tax_id: '',
      }));
    });

    it('defaults to an unknown currency and today', () => {
      expect(emptyProviderFields().currency).toBe('');
      expect(emptyProviderFields().opening_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('providerFieldsFromAccount', () => {
    it('builds the form from the provider', () => {
      expect(providerFieldsFromAccount(STORED)).toEqual(jasmine.objectContaining({
        name: 'Office rent',
        opening_balance: '-50.00',
        for_accountant: false,
        provider_tax_id: '12.345',
      }));
    });

    it('does not load schedule fields', () => {
      const fields = providerFieldsFromAccount({
        ...STORED, provider_expense: { ...STORED.provider_expense, due_day: 3, bills_from: '2026-02-01' },
      });

      expect('due_day' in fields).toBeFalse();
      expect('bills_from' in fields).toBeFalse();
    });

    it('fills the defaults without a provider_expense object', () => {
      expect(providerFieldsFromAccount({ ...STORED, provider_expense: null })).toEqual(jasmine.objectContaining({
        for_accountant: true, provider_tax_id: '',
      }));
    });
  });

  describe('validateProviderFields', () => {
    it('builds the body with the nested provider_expense object, without schedule fields', () => {
      expect(validate({ provider_tax_id: '  12.345  ', opening_balance: '-30' })).toEqual({
        errors: {},
        body: jasmine.objectContaining({
          name: 'Rent',
          opening_balance: '-30',
          provider_expense: { for_accountant: true, provider_tax_id: '12.345' },
        }),
      });
    });

    it('sends null for a blank tax id', () => {
      expect(validate({ for_accountant: false }).body.provider_expense).toEqual({
        for_accountant: false, provider_tax_id: null,
      });
    });

    it('rejects a tax id longer than 32 characters', () => {
      expect(validate({ provider_tax_id: 'x'.repeat(33) }).errors.provider_tax_id).toBeDefined();
      expect(validate({ provider_tax_id: 'x'.repeat(32) }).errors).toEqual({});
    });

    it('keeps the common errors', () => {
      expect(validate({ name: '' }).errors.name).toBeDefined();
      expect(validate({ name: '' }).body).toBeNull();
    });

    it('validates only the name of an archived provider', () => {
      expect(validate({ name: 'Old', provider_tax_id: 'x'.repeat(40) }, { nameOnly: true })).toEqual({
        errors: {}, body: { name: 'Old' },
      });
    });

    it('defaults its options', () => {
      expect(validateProviderFields(valid()).errors).toEqual({});
    });
  });

  describe('changedProviderFields', () => {
    it('keeps the changed common fields and provider keys only', () => {
      const original = validate(providerFieldsFromAccount(STORED)).body;
      const body = validate({ ...providerFieldsFromAccount(STORED), bank_name: 'New Ltd', provider_tax_id: '' }).body;

      expect(changedProviderFields(body, original)).toEqual({
        bank_name: 'New Ltd', provider_expense: { provider_tax_id: null },
      });
    });

    it('omits provider_expense when nothing in it changed', () => {
      const original = validate(providerFieldsFromAccount(STORED)).body;

      expect(changedProviderFields({ ...original, name: 'X' }, original)).toEqual({ name: 'X' });
    });
  });
});
