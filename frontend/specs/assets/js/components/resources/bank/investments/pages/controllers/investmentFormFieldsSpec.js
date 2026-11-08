import {
  INVESTMENT_FIELD_NAMES,
  changedInvestmentFields,
  emptyInvestmentFields,
  investmentFieldsFromAccount,
  validateInvestmentFields,
} from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/investmentFormFields.js';

const NOW = new Date(2026, 4, 10, 12);

const FIELDS = {
  ...emptyInvestmentFields('BRL', '2026-01-01'),
  name: ' CDB ',
  bank_name: 'Broker A',
};

function validate(overrides = {}, options = {}) {
  return validateInvestmentFields({ ...FIELDS, ...overrides }, { now: NOW, ...options });
}

const STORED = {
  id: 3,
  name: 'CDB',
  bank_name: 'Broker A',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0.00',
  notes: null,
  archived_at: null,
  investment: {
    kind: 'fixed_income', yield_rate: '12.5', yield_period: 'yearly', maturity_date: '2028-01-01', liquidity_days: 0,
  },
};

const EMPTY_INVESTMENT = {
  kind: null, yield_rate: null, yield_period: null, maturity_date: null, liquidity_days: null,
};

describe('investmentFormFields', () => {
  it('names the investment fields', () => {
    expect(INVESTMENT_FIELD_NAMES).toEqual(['kind', 'yield_rate', 'yield_period', 'maturity_date', 'liquidity_days']);
  });

  describe('emptyInvestmentFields', () => {
    it('adds empty investment fields, with a 0 opening balance', () => {
      expect(emptyInvestmentFields('BRL', '2026-01-01')).toEqual(jasmine.objectContaining({
        name: '',
        currency: 'BRL',
        opening_date: '2026-01-01',
        opening_balance: '0',
        kind: '',
        yield_rate: '',
        yield_period: '',
        maturity_date: '',
        liquidity_days: '',
      }));
    });

    it('defaults the currency to empty', () => {
      expect(emptyInvestmentFields().currency).toBe('');
    });
  });

  describe('investmentFieldsFromAccount', () => {
    it('loads the investment fields as text', () => {
      expect(investmentFieldsFromAccount(STORED)).toEqual(jasmine.objectContaining({
        bank_name: 'Broker A',
        opening_balance: '0.00',
        kind: 'fixed_income',
        yield_rate: '12.5',
        yield_period: 'yearly',
        maturity_date: '2028-01-01',
        liquidity_days: '0',
      }));
    });

    it('leaves unset fields empty, also without an investment object', () => {
      expect(investmentFieldsFromAccount({ ...STORED, investment: EMPTY_INVESTMENT }).kind).toBe('');
      expect(investmentFieldsFromAccount({ ...STORED, investment: null }).liquidity_days).toBe('');
    });
  });

  describe('validateInvestmentFields', () => {
    it('builds the body with opening balance 0 and every investment key null when empty', () => {
      expect(validate()).toEqual({
        errors: {},
        body: {
          name: 'CDB',
          bank_name: 'Broker A',
          branch: null,
          account_number: null,
          notes: null,
          currency: 'BRL',
          opening_date: '2026-01-01',
          opening_balance: '0',
          investment: EMPTY_INVESTMENT,
        },
      });
    });

    it('builds the filled investment object', () => {
      expect(validate({
        kind: 'fund', yield_rate: '1,1', yield_period: 'monthly', maturity_date: '2020-06-30', liquidity_days: '30',
      }).body.investment).toEqual({
        kind: 'fund', yield_rate: '1.1', yield_period: 'monthly', maturity_date: '2020-06-30', liquidity_days: 30,
      });
    });

    it('labels the date errors "Start date"', () => {
      expect(validate({ opening_date: '' }).errors.opening_date).toBe('Start date is required');
      expect(validate({ opening_date: '2026-05-11' }).errors.opening_date).toBe('Start date cannot be in the future');
    });

    it('requires the period once a rate is entered', () => {
      expect(validate({ yield_rate: '3' })).toEqual({ errors: { yield_period: 'Choose the yield period' }, body: null });
    });

    it('accepts a 0 rate with a period', () => {
      expect(validate({ yield_rate: '0', yield_period: 'yearly' }).body.investment.yield_rate).toBe('0');
    });

    it('clears the rate and period together for an empty rate', () => {
      const { investment } = validate({ yield_rate: ' ', yield_period: 'monthly' }).body;

      expect(investment.yield_rate).toBeNull();
      expect(investment.yield_period).toBeNull();
    });

    ['100.5', '1.23456', 'abc'].forEach((rate) => {
      it(`rejects the rate ${rate}`, () => {
        expect(validate({ yield_rate: rate, yield_period: 'monthly' }).errors.yield_rate)
          .toBe('Enter a rate between 0 and 100, with at most 4 decimals');
      });
    });

    ['-1', '1.5', 'x', '2147483648'].forEach((days) => {
      it(`rejects the liquidity ${days}`, () => {
        expect(validate({ liquidity_days: days }).errors.liquidity_days).toBe('Enter a whole number of days (0 or more)');
      });
    });

    it('accepts the liquidity bounds', () => {
      expect(validate({ liquidity_days: '0' }).body.investment.liquidity_days).toBe(0);
      expect(validate({ liquidity_days: '2147483647' }).body.investment.liquidity_days).toBe(2147483647);
    });

    it('rejects a kind outside the enum', () => {
      expect(validate({ kind: 'bonds' }).errors.kind).toBe('Choose a valid kind');
    });

    it('rejects an invalid maturity date, allowing a past one', () => {
      expect(validate({ maturity_date: '2026-02-30' }).errors.maturity_date).toBe('Enter a valid date');
      expect(validate({ maturity_date: '01/02/2026' }).errors.maturity_date).toBe('Enter a valid date');
      expect(validate({ maturity_date: '1999-12-31' }).errors).toEqual({});
    });

    it('builds a name-only body for an archived investment', () => {
      expect(validate({ kind: 'bonds' }, { nameOnly: true })).toEqual({ errors: {}, body: { name: 'CDB' } });
    });

    it('uses the current date by default', () => {
      expect(validateInvestmentFields({ ...FIELDS, opening_date: '2000-01-01' }).errors).toEqual({});
    });
  });

  describe('changedInvestmentFields', () => {
    const original = validateInvestmentFields(investmentFieldsFromAccount(STORED), { now: NOW }).body;

    it('drops everything unchanged, including the stored 0.00 opening balance', () => {
      expect(changedInvestmentFields(original, original)).toEqual({});
    });

    it('keeps only the changed common fields and investment keys', () => {
      const body = validate({ ...investmentFieldsFromAccount(STORED), notes: 'CDI', liquidity_days: '30' }).body;

      expect(changedInvestmentFields(body, original)).toEqual({ notes: 'CDI', investment: { liquidity_days: 30 } });
    });

    it('sends both nulls when the rate is emptied', () => {
      const body = validate({ ...investmentFieldsFromAccount(STORED), yield_rate: '' }).body;

      expect(changedInvestmentFields(body, original)).toEqual({ investment: { yield_rate: null, yield_period: null } });
    });
  });
});
