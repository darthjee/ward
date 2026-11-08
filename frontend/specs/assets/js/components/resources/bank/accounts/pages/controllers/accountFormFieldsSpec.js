import {
  NAME_MAX_LENGTH,
  changedFields,
  emptyAccountFields,
  fieldsFromAccount,
  validateAccountFields,
} from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/accountFormFields.js';

const NOW = new Date(2026, 4, 10, 12);

const FIELDS = {
  name: '  Main ',
  bank_name: ' Bank ',
  branch: '',
  account_number: '12345',
  currency: 'BRL',
  opening_date: '2026-05-10',
  opening_balance: '-10,5',
  notes: '  ',
};

describe('accountFormFields', () => {
  describe('emptyAccountFields', () => {
    it('defaults the opening date to today and the balance to 0', () => {
      expect(emptyAccountFields('BRL', '2026-05-10')).toEqual({
        name: '', bank_name: '', branch: '', account_number: '', currency: 'BRL', opening_date: '2026-05-10', opening_balance: '0', notes: '',
      });
    });

    it('has no currency and local today by default', () => {
      const fields = emptyAccountFields();

      expect(fields.currency).toBe('');
      expect(fields.opening_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('fieldsFromAccount', () => {
    it('maps nulls to empty strings', () => {
      expect(fieldsFromAccount({
        name: 'Main', bank_name: null, branch: null, account_number: '123', currency: 'USD', opening_date: '2026-01-01', opening_balance: '5.00', notes: null,
      })).toEqual({
        name: 'Main', bank_name: '', branch: '', account_number: '123', currency: 'USD', opening_date: '2026-01-01', opening_balance: '5.00', notes: '',
      });
    });

    it('tolerates a sparse account', () => {
      expect(fieldsFromAccount({}).opening_balance).toBe('0');
    });
  });

  describe('validateAccountFields', () => {
    it('builds the trimmed snake_case body, blanks as null and , normalised', () => {
      expect(validateAccountFields(FIELDS, { now: NOW })).toEqual({
        errors: {},
        body: {
          name: 'Main',
          bank_name: 'Bank',
          branch: null,
          account_number: '12345',
          notes: null,
          currency: 'BRL',
          opening_date: '2026-05-10',
          opening_balance: '-10.5',
        },
      });
    });

    it('accepts a zero opening balance', () => {
      expect(validateAccountFields({ ...FIELDS, opening_balance: '0' }, { now: NOW }).body.opening_balance).toBe('0');
    });

    it('requires the name', () => {
      expect(validateAccountFields({ ...FIELDS, name: ' ' }, { now: NOW }))
        .toEqual({ errors: { name: 'Name is required' }, body: null });
    });

    it('limits the name length', () => {
      const { errors } = validateAccountFields({ ...FIELDS, name: 'x'.repeat(NAME_MAX_LENGTH + 1) }, { now: NOW });

      expect(errors.name).toContain('at most');
    });

    it('requires a currency', () => {
      expect(validateAccountFields({ ...FIELDS, currency: '' }, { now: NOW }).errors.currency).toBe('Choose a currency');
    });

    it('requires the opening date', () => {
      expect(validateAccountFields({ ...FIELDS, opening_date: '' }, { now: NOW }).errors.opening_date)
        .toBe('Opening date is required');
    });

    it('rejects an opening date after local today', () => {
      expect(validateAccountFields({ ...FIELDS, opening_date: '2026-05-11' }, { now: NOW }).errors.opening_date)
        .toContain('future');
    });

    it('rejects too many decimals for the currency', () => {
      expect(validateAccountFields({ ...FIELDS, currency: 'JPY', opening_balance: '1.5' }, { now: NOW }).errors.opening_balance)
        .toEqual(jasmine.any(String));
    });

    it('rejects thousands separators', () => {
      expect(validateAccountFields({ ...FIELDS, opening_balance: '1.234,56' }, { now: NOW }).errors.opening_balance)
        .toEqual(jasmine.any(String));
    });

    it('builds a name-only body', () => {
      expect(validateAccountFields({ ...FIELDS, currency: '' }, { nameOnly: true }))
        .toEqual({ errors: {}, body: { name: 'Main' } });
    });

    it('validates the name in name-only mode', () => {
      expect(validateAccountFields({ ...FIELDS, name: '' }, { nameOnly: true }))
        .toEqual({ errors: { name: 'Name is required' }, body: null });
    });

    it('uses the current date by default', () => {
      expect(validateAccountFields({ ...FIELDS, opening_date: '2000-01-01' }).errors).toEqual({});
    });
  });

  describe('changedFields', () => {
    it('keeps only the changed entries', () => {
      expect(changedFields({ name: 'B', currency: 'BRL', notes: null }, { name: 'A', currency: 'BRL', notes: null }))
        .toEqual({ name: 'B' });
    });

    it('keeps everything without an original', () => {
      expect(changedFields({ name: 'B' }, null)).toEqual({ name: 'B' });
    });
  });
});
