import {
  changedDebtFields,
  debtFieldsFromAccount,
  emptyDebtFields,
  validateDebtFields,
} from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/debtFormFields.js';

const NOW = new Date(2026, 4, 10, 12);

const FIELDS = {
  ...emptyDebtFields('BRL', '2026-01-01'),
  name: ' Car loan ',
  bank_name: 'Bank A',
  opening_balance: '10000,00',
};

function validate(overrides = {}, options = {}) {
  return validateDebtFields({ ...FIELDS, ...overrides }, { now: NOW, ...options });
}

const STORED = {
  id: 7,
  name: 'Car loan',
  bank_name: 'Bank A',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-10000.00',
  notes: null,
  archived_at: null,
  debt: {
    interest_rate: '1.99',
    interest_period: 'monthly',
    instalment_amount: '500.00',
    instalment_frequency: 'monthly',
    due_day: 10,
    due_month: null,
    instalment_count: 24,
  },
};

describe('debtFormFields', () => {
  describe('emptyDebtFields', () => {
    it('adds empty debt fields to the common fields, frequency monthly', () => {
      expect(emptyDebtFields('BRL', '2026-01-01')).toEqual(jasmine.objectContaining({
        name: '',
        currency: 'BRL',
        opening_date: '2026-01-01',
        opening_balance: '0',
        interest_rate: '',
        interest_period: '',
        instalment_amount: '',
        instalment_frequency: 'monthly',
        due_day: '',
        due_month: '',
        instalment_count: '',
      }));
    });
  });

  describe('debtFieldsFromAccount', () => {
    it('shows the stored opening balance negated as the amount owed', () => {
      expect(debtFieldsFromAccount(STORED).opening_balance).toBe('10000.00');
      expect(debtFieldsFromAccount({ ...STORED, opening_balance: '250.00' }).opening_balance).toBe('-250.00');
      expect(debtFieldsFromAccount({ ...STORED, opening_balance: '0.00' }).opening_balance).toBe('0.00');
    });

    it('loads the debt fields as text, empty when unset', () => {
      expect(debtFieldsFromAccount(STORED)).toEqual(jasmine.objectContaining({
        interest_rate: '1.99',
        interest_period: 'monthly',
        instalment_amount: '500.00',
        instalment_frequency: 'monthly',
        due_day: '10',
        due_month: '',
        instalment_count: '24',
      }));
    });

    it('defaults the frequency without a debt object', () => {
      expect(debtFieldsFromAccount({ ...STORED, debt: null })).toEqual(jasmine.objectContaining({
        interest_rate: '', instalment_frequency: 'monthly',
      }));
    });
  });

  describe('validateDebtFields', () => {
    it('sends a positive amount owed as a negative opening balance, with the debt object', () => {
      expect(validate()).toEqual({
        errors: {},
        body: {
          name: 'Car loan',
          bank_name: 'Bank A',
          branch: null,
          account_number: null,
          notes: null,
          currency: 'BRL',
          opening_date: '2026-01-01',
          opening_balance: '-10000.00',
          debt: {
            interest_rate: null,
            interest_period: null,
            instalment_amount: null,
            instalment_frequency: 'monthly',
            due_day: null,
            due_month: null,
            instalment_count: null,
          },
        },
      });
    });

    it('sends a negative amount owed as a positive opening balance', () => {
      expect(validate({ opening_balance: '-50' }).body.opening_balance).toBe('50');
    });

    it('keeps a zero amount owed', () => {
      expect(validate({ opening_balance: '0' }).body.opening_balance).toBe('0');
    });

    it('reports an invalid amount owed on its field', () => {
      expect(validate({ opening_balance: '1.234' }).errors.opening_balance).toEqual(jasmine.any(String));
    });

    it('requires the period once a rate is entered', () => {
      expect(validate({ interest_rate: '1.99' }).errors).toEqual({ interest_period: jasmine.any(String) });
    });

    it('sends the rate with its period', () => {
      expect(validate({ interest_rate: '1,99', interest_period: 'yearly' }).body.debt).toEqual(jasmine.objectContaining({
        interest_rate: '1.99', interest_period: 'yearly',
      }));
    });

    it('clears the rate and the period together when the rate is emptied', () => {
      expect(validate({ interest_rate: '  ', interest_period: 'monthly' }).body.debt).toEqual(jasmine.objectContaining({
        interest_rate: null, interest_period: null,
      }));
    });

    it('accepts rates from 0 to 100 with up to 4 decimals', () => {
      ['0', '100', '99.9999', '0.5'].forEach((rate) => {
        expect(validate({ interest_rate: rate, interest_period: 'monthly' }).errors).toEqual({});
      });
    });

    it('rejects rates out of range or with 5 decimals', () => {
      ['-1', '100.01', '1.23456', 'abc', '1000'].forEach((rate) => {
        expect(validate({ interest_rate: rate, interest_period: 'monthly' }).errors.interest_rate).toEqual(jasmine.any(String));
      });
    });

    it('parses the instalment amount in the currency, positive and non-zero', () => {
      expect(validate({ instalment_amount: '500,5' }).body.debt.instalment_amount).toBe('500.5');
      expect(validate({ instalment_amount: '0' }).errors.instalment_amount).toEqual(jasmine.any(String));
      expect(validate({ instalment_amount: '-5' }).errors.instalment_amount).toEqual(jasmine.any(String));
      expect(validate({ instalment_amount: '1.234' }).errors.instalment_amount).toEqual(jasmine.any(String));
    });

    it('validates the due day between 1 and 31', () => {
      expect(validate({ due_day: '31' }).body.debt.due_day).toBe(31);
      expect(validate({ due_day: '1' }).body.debt.due_day).toBe(1);
      ['0', '32', '1.5', 'x'].forEach((day) => {
        expect(validate({ due_day: day }).errors.due_day).toEqual(jasmine.any(String));
      });
    });

    it('requires the due month for a yearly frequency', () => {
      expect(validate({ instalment_frequency: 'yearly' }).errors).toEqual({ due_month: jasmine.any(String) });
      expect(validate({ instalment_frequency: 'yearly', due_month: '13' }).errors.due_month).toEqual(jasmine.any(String));
      expect(validate({ instalment_frequency: 'yearly', due_month: '12' }).body.debt).toEqual(jasmine.objectContaining({
        instalment_frequency: 'yearly', due_month: 12,
      }));
    });

    it('never sends a due month for a monthly frequency', () => {
      expect(validate({ instalment_frequency: 'monthly', due_month: '3' }).body.debt.due_month).toBeNull();
    });

    it('validates the instalment count, empty meaning open-ended', () => {
      expect(validate({ instalment_count: '2147483647' }).body.debt.instalment_count).toBe(2147483647);
      expect(validate({ instalment_count: '' }).body.debt.instalment_count).toBeNull();
      ['0', '2147483648', '-1'].forEach((count) => {
        expect(validate({ instalment_count: count }).errors.instalment_count).toEqual(jasmine.any(String));
      });
    });

    it('sends only the name for an archived debt', () => {
      expect(validate({ interest_rate: 'bad' }, { nameOnly: true })).toEqual({ errors: {}, body: { name: 'Car loan' } });
    });
  });

  describe('changedDebtFields', () => {
    const original = validateDebtFields(debtFieldsFromAccount(STORED), { now: NOW }).body;

    it('keeps nothing when nothing changed', () => {
      expect(changedDebtFields(original, original)).toEqual({});
    });

    it('keeps the changed common fields and the changed debt keys', () => {
      const body = validateDebtFields({ ...debtFieldsFromAccount(STORED), name: 'Car', due_day: '5' }, { now: NOW }).body;

      expect(changedDebtFields(body, original)).toEqual({ name: 'Car', debt: { due_day: 5 } });
    });

    it('sends both nulls when the rate is cleared', () => {
      const body = validateDebtFields({ ...debtFieldsFromAccount(STORED), interest_rate: '' }, { now: NOW }).body;

      expect(changedDebtFields(body, original)).toEqual({ debt: { interest_rate: null, interest_period: null } });
    });

    it('keeps a name-only body as-is', () => {
      expect(changedDebtFields({ name: 'X' }, original)).toEqual({ name: 'X' });
    });
  });
});
