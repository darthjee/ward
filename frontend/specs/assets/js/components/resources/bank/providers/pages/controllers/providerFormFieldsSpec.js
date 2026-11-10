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
    expected_amount: '200.00',
    charge_frequency: 'yearly',
    due_day: 10,
    due_month: 3,
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
    expect(PROVIDER_FIELD_NAMES).toEqual([
      'for_accountant', 'provider_tax_id', 'expected_amount', 'charge_frequency', 'due_day', 'due_month',
    ]);
  });

  describe('emptyProviderFields', () => {
    it('defaults For accountant on and the frequency to monthly', () => {
      expect(emptyProviderFields('BRL', '2026-05-01')).toEqual(jasmine.objectContaining({
        currency: 'BRL',
        opening_date: '2026-05-01',
        opening_balance: '0',
        for_accountant: true,
        provider_tax_id: '',
        expected_amount: '',
        charge_frequency: 'monthly',
        due_day: '',
        due_month: '',
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
        expected_amount: '200.00',
        charge_frequency: 'yearly',
        due_day: '10',
        due_month: '3',
      }));
    });

    it('fills the defaults without a provider_expense object', () => {
      expect(providerFieldsFromAccount({ ...STORED, provider_expense: null })).toEqual(jasmine.objectContaining({
        for_accountant: true, provider_tax_id: '', expected_amount: '', charge_frequency: 'monthly', due_day: '', due_month: '',
      }));
    });
  });

  describe('validateProviderFields', () => {
    it('builds the body with the nested provider_expense object', () => {
      expect(validate({
        provider_tax_id: '  12.345  ', expected_amount: '200,5', due_day: '10', opening_balance: '-30',
      })).toEqual({
        errors: {},
        body: jasmine.objectContaining({
          name: 'Rent',
          opening_balance: '-30',
          provider_expense: {
            for_accountant: true,
            provider_tax_id: '12.345',
            expected_amount: '200.5',
            charge_frequency: 'monthly',
            due_day: 10,
            due_month: null,
          },
        }),
      });
    });

    it('sends nulls for blank optional fields', () => {
      expect(validate({ for_accountant: false }).body.provider_expense).toEqual({
        for_accountant: false,
        provider_tax_id: null,
        expected_amount: null,
        charge_frequency: 'monthly',
        due_day: null,
        due_month: null,
      });
    });

    it('rejects a tax id longer than 32 characters', () => {
      expect(validate({ provider_tax_id: 'x'.repeat(33) }).errors.provider_tax_id).toBeDefined();
      expect(validate({ provider_tax_id: 'x'.repeat(32) }).errors).toEqual({});
    });

    [['0', 'zero'], ['-5', 'negative'], ['1.234', 'too many decimals'], ['abc', 'not a number'], ['100000000000.01', 'too large']]
      .forEach(([amount, label]) => {
        it(`rejects a ${label} expected amount`, () => {
          expect(validate({ expected_amount: amount }).errors.expected_amount).toBeDefined();
        });
      });

    it('rejects decimals on a zero-decimal currency', () => {
      expect(validate({ currency: 'JPY', expected_amount: '1.5' }).errors.expected_amount).toBeDefined();
      expect(validate({ currency: 'JPY', expected_amount: '1500' }).body.provider_expense.expected_amount).toBe('1500');
    });

    ['0', '32', '1.5', 'x'].forEach((day) => {
      it(`rejects the due day ${day}`, () => {
        expect(validate({ due_day: day }).errors.due_day).toBeDefined();
      });
    });

    it('requires the due month for a yearly frequency', () => {
      expect(validate({ charge_frequency: 'yearly' }).errors.due_month).toBeDefined();
      expect(validate({ charge_frequency: 'yearly', due_month: '13' }).errors.due_month).toBeDefined();
      expect(validate({ charge_frequency: 'yearly', due_month: '3' }).body.provider_expense)
        .toEqual(jasmine.objectContaining({ charge_frequency: 'yearly', due_month: 3 }));
    });

    it('drops the due month for a monthly frequency', () => {
      expect(validate({ charge_frequency: 'monthly', due_month: '3' }).body.provider_expense.due_month).toBeNull();
    });

    it('reads an unknown frequency as monthly', () => {
      expect(validate({ charge_frequency: 'weekly' }).body.provider_expense.charge_frequency).toBe('monthly');
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
      const body = validate({
        ...providerFieldsFromAccount(STORED), bank_name: 'New Ltd', charge_frequency: 'monthly', expected_amount: '',
      }).body;

      expect(changedProviderFields(body, original)).toEqual({
        bank_name: 'New Ltd',
        provider_expense: { expected_amount: null, charge_frequency: 'monthly', due_month: null },
      });
    });

    it('omits provider_expense when nothing in it changed', () => {
      const original = validate(providerFieldsFromAccount(STORED)).body;

      expect(changedProviderFields({ ...original, name: 'X' }, original)).toEqual({ name: 'X' });
    });
  });
});
