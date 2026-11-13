import {
  SCHEDULE_FIELD_NAMES,
  buildScheduleHandlers,
  clearMismatchedPayingAccount,
  emptyScheduleFields,
  payingAccountOptions,
  scheduleFieldsFromAccount,
  validateScheduleFields,
  withBillsFromAutofill,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/scheduleFields.js';

const ACCOUNTS = [
  { id: 1, name: 'Main', currency: 'BRL', type: 'regular' },
  { id: 2, name: 'Travel', currency: 'USD', type: 'regular' },
  { id: 3, name: 'Loan', currency: 'BRL', type: 'debt' },
  { id: 4, name: 'Savings', currency: 'BRL' },
];

describe('scheduleFields', () => {
  it('lists the schedule fields', () => {
    expect(SCHEDULE_FIELD_NAMES).toEqual(['bills_from', 'show_in_calendar', 'paying_account_id']);
  });

  describe('emptyScheduleFields', () => {
    it('starts blank, shown in the Calendar and without a default paying account', () => {
      expect(emptyScheduleFields()).toEqual({ bills_from: '', show_in_calendar: true, paying_account_id: '' });
    });
  });

  describe('scheduleFieldsFromAccount', () => {
    it('reads the paying account id from its object', () => {
      expect(scheduleFieldsFromAccount({
        bills_from: '2026-01-05', show_in_calendar: false, paying_account: { id: 9, name: 'Main' },
      })).toEqual({ bills_from: '2026-01-05', show_in_calendar: false, paying_account_id: '9' });
    });

    it('defaults unset values', () => {
      expect(scheduleFieldsFromAccount({ bills_from: null, paying_account: null })).toEqual(emptyScheduleFields());
      expect(scheduleFieldsFromAccount(null)).toEqual(emptyScheduleFields());
    });
  });

  describe('validateScheduleFields', () => {
    it('sends blanks as null and Show in Calendar as a boolean', () => {
      expect(validateScheduleFields({ bills_from: ' ', show_in_calendar: '', paying_account_id: '' })).toEqual({
        errors: [['bills_from', null]],
        values: { bills_from: null, show_in_calendar: false, paying_account_id: null },
      });
    });

    it('sends the date and the paying account id as a number', () => {
      expect(validateScheduleFields({ bills_from: '2026-02-01', show_in_calendar: true, paying_account_id: '9' }).values)
        .toEqual({ bills_from: '2026-02-01', show_in_calendar: true, paying_account_id: 9 });
    });

    it('rejects a malformed date', () => {
      expect(validateScheduleFields({ bills_from: '2026-2-1', show_in_calendar: true, paying_account_id: '' }).errors)
        .toEqual([['bills_from', jasmine.any(String)]]);
    });
  });

  describe('withBillsFromAutofill', () => {
    it('fills Bills from with today when a due day is first entered', () => {
      expect(withBillsFromAutofill({ due_day: '', bills_from: '' }, 'due_day', '10', '2026-05-10'))
        .toEqual({ due_day: '10', bills_from: '2026-05-10' });
    });

    it('keeps a Bills from already set', () => {
      expect(withBillsFromAutofill({ due_day: '10', bills_from: '2026-01-01' }, 'due_day', '12', '2026-05-10'))
        .toEqual({ due_day: '12', bills_from: '2026-01-01' });
    });

    it('does not fill on a blank due day', () => {
      expect(withBillsFromAutofill({ due_day: '1', bills_from: '' }, 'due_day', ' ', '2026-05-10'))
        .toEqual({ due_day: ' ', bills_from: '' });
    });

    it('only reacts to the due day', () => {
      expect(withBillsFromAutofill({ name: '', bills_from: '' }, 'name', 'Rent', '2026-05-10'))
        .toEqual({ name: 'Rent', bills_from: '' });
    });
  });

  describe('payingAccountOptions', () => {
    it('lists only the regular accounts in the currency', () => {
      expect(payingAccountOptions(ACCOUNTS, 'BRL')).toEqual([['1', 'Main'], ['4', 'Savings']]);
      expect(payingAccountOptions(ACCOUNTS, 'USD')).toEqual([['2', 'Travel']]);
    });

    it('lists nothing while loading', () => {
      expect(payingAccountOptions(null, 'BRL')).toEqual([]);
    });
  });

  describe('clearMismatchedPayingAccount', () => {
    it('clears a default paying account in another currency', () => {
      expect(clearMismatchedPayingAccount({ currency: 'USD', paying_account_id: '1' }, ACCOUNTS))
        .toEqual({ currency: 'USD', paying_account_id: '' });
    });

    it('keeps a matching or empty default', () => {
      const matching = { currency: 'BRL', paying_account_id: '1' };
      const empty = { currency: 'USD', paying_account_id: '' };

      expect(clearMismatchedPayingAccount(matching, ACCOUNTS)).toBe(matching);
      expect(clearMismatchedPayingAccount(empty, ACCOUNTS)).toBe(empty);
    });
  });

  describe('buildScheduleHandlers', () => {
    let fields;
    let setFields;

    beforeEach(() => {
      fields = { currency: 'BRL', due_day: '', bills_from: '', paying_account_id: '1' };
      setFields = jasmine.createSpy('setFields').and.callFake((update) => {
        fields = update(fields);
      });
    });

    it('autofills Bills from on a due day change', () => {
      buildScheduleHandlers(setFields, ACCOUNTS, () => '2026-05-10')
        .onFieldChange({ target: { name: 'due_day', value: '5' } });

      expect(fields).toEqual(jasmine.objectContaining({ due_day: '5', bills_from: '2026-05-10' }));
    });

    it('defaults today to the local date', () => {
      buildScheduleHandlers(setFields, ACCOUNTS).onFieldChange({ target: { name: 'due_day', value: '5' } });

      expect(fields.bills_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('clears a mismatching default paying account on a currency change', () => {
      buildScheduleHandlers(setFields, ACCOUNTS).onCurrencyChange('USD');

      expect(fields).toEqual(jasmine.objectContaining({ currency: 'USD', paying_account_id: '' }));
    });
  });
});
