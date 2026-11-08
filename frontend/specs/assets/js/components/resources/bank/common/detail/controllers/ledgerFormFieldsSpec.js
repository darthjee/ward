import {
  DESCRIPTION_MAX_LENGTH,
  DISCARD_QUESTION,
  confirmDiscard,
  emptyLedgerValues,
  isDirty,
  validateLedgerValues,
  valuesFromTransaction,
} from '../../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/ledgerFormFields.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

const NOW = new Date(2026, 4, 10, 12);
const VALUES = {
  date: '2026-05-10', direction: 'out', amount: '12,50', description: ' Coffee ', notes: '',
};

describe('ledgerFormFields', () => {
  it('starts empty, on local today, as Out', () => {
    expect(emptyLedgerValues('2026-05-10')).toEqual({
      date: '2026-05-10', direction: 'out', amount: '', description: '', notes: '',
    });
    expect(emptyLedgerValues().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe('valuesFromTransaction', () => {
    it('sets Out and the absolute value for a negative amount', () => {
      expect(valuesFromTransaction({
        date: '2026-05-01', amount: '-12.50', description: 'Coffee', notes: 'beans',
      })).toEqual({
        date: '2026-05-01', direction: 'out', amount: '12.50', description: 'Coffee', notes: 'beans',
      });
    });

    it('sets In for a positive amount and blank notes', () => {
      expect(valuesFromTransaction({ date: '2026-05-01', amount: '500', description: null, notes: null }))
        .toEqual({
          date: '2026-05-01', direction: 'in', amount: '500', description: '', notes: '',
        });
    });
  });

  describe('validateLedgerValues', () => {
    it('signs the amount by the toggle and normalises ,', () => {
      expect(validateLedgerValues(VALUES, { currency: 'BRL', now: NOW })).toEqual({
        errors: {},
        body: { date: '2026-05-10', amount: '-12.50', description: 'Coffee' },
      });
    });

    it('sends In as a positive amount', () => {
      expect(validateLedgerValues({ ...VALUES, direction: 'in' }, { currency: 'BRL', now: NOW }).body.amount)
        .toBe('12.50');
    });

    it('sends trimmed notes when present', () => {
      expect(validateLedgerValues({ ...VALUES, notes: ' n ' }, { currency: 'BRL', now: NOW }).body.notes).toBe('n');
    });

    it('omits blank notes on create', () => {
      expect('notes' in validateLedgerValues(VALUES, { currency: 'BRL', now: NOW }).body).toBeFalse();
    });

    it('clears blank notes on edit', () => {
      expect(validateLedgerValues(VALUES, { currency: 'BRL', editing: true, now: NOW }).body.notes).toBeNull();
    });

    it('rejects a zero amount', () => {
      expect(validateLedgerValues({ ...VALUES, amount: '0' }, { currency: 'BRL', now: NOW }).errors.amount)
        .toContain('zero');
    });

    it('rejects too many decimals for the currency', () => {
      expect(validateLedgerValues({ ...VALUES, amount: '1.5' }, { currency: 'JPY', now: NOW }).errors.amount)
        .toEqual(jasmine.any(String));
    });

    it('rejects an amount over the cap', () => {
      expect(validateLedgerValues({ ...VALUES, amount: '100000000000.01' }, { currency: 'BRL', now: NOW }).errors.amount)
        .toContain('too large');
    });

    it('rejects a typed sign (the toggle carries it)', () => {
      expect(validateLedgerValues({ ...VALUES, amount: '-5' }, { currency: 'BRL', now: NOW }).errors.amount)
        .toEqual(jasmine.any(String));
    });

    it('requires the description', () => {
      expect(validateLedgerValues({ ...VALUES, description: ' ' }, { currency: 'BRL', now: NOW }).errors.description)
        .toBe('Description is required');
    });

    it('limits the description', () => {
      const description = 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1);

      expect(validateLedgerValues({ ...VALUES, description }, { currency: 'BRL', now: NOW }).errors.description)
        .toContain('at most');
    });

    it('requires the date', () => {
      expect(validateLedgerValues({ ...VALUES, date: '' }, { currency: 'BRL', now: NOW }).errors.date).toBe('Date is required');
    });

    it('rejects a date after local today', () => {
      expect(validateLedgerValues({ ...VALUES, date: '2026-05-11' }, { currency: 'BRL', now: NOW }))
        .toEqual({ errors: { date: 'Date cannot be in the future' }, body: null });
    });

    it('uses the current date by default', () => {
      expect(validateLedgerValues({ ...VALUES, date: '2000-01-01' }, { currency: 'BRL' }).errors).toEqual({});
    });
  });

  describe('isDirty', () => {
    it('is false for unchanged values', () => {
      expect(isDirty(VALUES, { ...VALUES })).toBeFalse();
    });

    it('is true when a value changed', () => {
      expect(isDirty({ ...VALUES, amount: '1' }, VALUES)).toBeTrue();
    });

    it('tolerates missing values', () => {
      expect(isDirty(undefined, undefined)).toBeFalse();
    });
  });

  describe('confirmDiscard', () => {
    afterEach(() => {
      uninstallFakeWindow();
    });

    it('does not ask for a clean form', () => {
      const confirm = jasmine.createSpy('confirm');

      expect(confirmDiscard(false, confirm)).toBeTrue();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('asks for a dirty form', () => {
      const confirm = jasmine.createSpy('confirm').and.returnValue(false);

      expect(confirmDiscard(true, confirm)).toBeFalse();
      expect(confirm).toHaveBeenCalledWith(DISCARD_QUESTION);
    });

    it('uses window.confirm by default', () => {
      const confirm = jasmine.createSpy('confirm').and.returnValue(true);

      installFakeWindow({ confirm });

      expect(confirmDiscard(true)).toBeTrue();
      expect(confirm).toHaveBeenCalled();
    });

    it('allows discarding outside the browser', () => {
      expect(confirmDiscard(true)).toBeTrue();
    });
  });
});
