import {
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  billFieldsFromBill,
  changedBillFields,
  emptyBillFields,
  findProvider,
  providerOptions,
  validateBillFields,
  withBillFieldChange,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/billFormFields.js';

const PROVIDERS = [
  { id: 3, name: 'Plumber', currency: 'BRL' },
  { id: 4, name: 'Host', currency: 'USD' },
];
const ACCOUNTS = [
  { id: 1, name: 'Main', currency: 'BRL', type: 'regular' },
  { id: 2, name: 'Travel', currency: 'USD', type: 'regular' },
];
const VALID = {
  kind: 'one_off',
  provider_account_id: '3',
  paying_account_id: '1',
  due_date: '2020-01-31',
  expected_amount: '120,50',
  description: '  Boiler repair ',
  notes: '',
};
const BILL = {
  id: 9,
  kind: 'one_off',
  provider_account_id: 3,
  paying_account_id: 1,
  due_date: '2026-03-10',
  expected_amount: '120.50',
  description: 'Boiler repair',
  notes: null,
};
const RECURRING = {
  kind: 'recurring',
  provider_account_id: '3',
  paying_account_id: '',
  due_date: '',
  expected_amount: '',
  description: 'Rent',
  notes: '',
  charge_frequency: 'monthly',
  due_day: '5',
  due_month: '',
  bills_from: '',
  show_in_calendar: true,
};

function validate(overrides = {}, currency = 'BRL') {
  return validateBillFields({ ...VALID, ...overrides }, { currency });
}

describe('billFormFields', () => {
  it('mirrors the backend limits', () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(255);
    expect(NOTES_MAX_LENGTH).toBe(2000);
  });

  describe('emptyBillFields', () => {
    it('pre-selects the given provider and is due today', () => {
      expect(emptyBillFields('3', '2026-05-10')).toEqual({
        kind: 'one_off',
        provider_account_id: '3',
        paying_account_id: '',
        due_date: '2026-05-10',
        expected_amount: '',
        description: '',
        notes: '',
        charge_frequency: 'monthly',
        due_day: '',
        due_month: '',
        bills_from: '',
        show_in_calendar: true,
      });
    });

    it('defaults to no provider and the local today', () => {
      expect(emptyBillFields().provider_account_id).toBe('');
      expect(emptyBillFields().due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('billFieldsFromBill', () => {
    it('reads the raw account ids', () => {
      expect(billFieldsFromBill(BILL)).toEqual({
        kind: 'one_off',
        provider_account_id: '3',
        paying_account_id: '1',
        due_date: '2026-03-10',
        expected_amount: '120.50',
        description: 'Boiler repair',
        notes: '',
        charge_frequency: 'monthly',
        due_day: '',
        due_month: '',
        bills_from: '',
        show_in_calendar: true,
      });
    });

    it('reads the recurring fields', () => {
      expect(billFieldsFromBill({
        kind: 'recurring', charge_frequency: 'yearly', due_day: 5, due_month: 3, bills_from: '2026-01-01', show_in_calendar: false,
      })).toEqual(jasmine.objectContaining({
        kind: 'recurring', charge_frequency: 'yearly', due_day: '5', due_month: '3', bills_from: '2026-01-01', show_in_calendar: false,
      }));
    });

    it('tolerates a bill without a paying account', () => {
      expect(billFieldsFromBill({ id: 1, paying_account_id: null }).paying_account_id).toBe('');
      expect(billFieldsFromBill({ id: 1 })).toEqual(jasmine.objectContaining({ provider_account_id: '', expected_amount: '', kind: 'one_off' }));
    });
  });

  describe('findProvider and providerOptions', () => {
    it('finds a provider by its typed id', () => {
      expect(findProvider(PROVIDERS, '4')).toBe(PROVIDERS[1]);
      expect(findProvider(PROVIDERS, '')).toBeUndefined();
      expect(findProvider(null, '3')).toBeUndefined();
    });

    it('lists the providers as options', () => {
      expect(providerOptions(PROVIDERS)).toEqual([['3', 'Plumber'], ['4', 'Host']]);
      expect(providerOptions(null)).toEqual([]);
    });
  });

  describe('withBillFieldChange', () => {
    const lists = { providers: PROVIDERS, accounts: ACCOUNTS };

    it('clears a paying account in another currency when the provider changes', () => {
      expect(withBillFieldChange(VALID, 'provider_account_id', '4', lists))
        .toEqual({ ...VALID, provider_account_id: '4', paying_account_id: '' });
    });

    it('keeps a paying account in the new provider currency', () => {
      expect(withBillFieldChange({ ...VALID, provider_account_id: '4', paying_account_id: '1' }, 'provider_account_id', '3', lists))
        .toEqual({ ...VALID, provider_account_id: '3', paying_account_id: '1' });
    });

    it('fills Bills from the first time a due day is entered', () => {
      const next = withBillFieldChange({ ...RECURRING, due_day: '' }, 'due_day', '5', lists);

      expect(next.bills_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('clears the paying account when the provider is unset', () => {
      expect(withBillFieldChange(VALID, 'provider_account_id', '', lists).paying_account_id).toBe('');
    });

    it('only sets other fields', () => {
      expect(withBillFieldChange(VALID, 'expected_amount', '5', lists)).toEqual({ ...VALID, expected_amount: '5' });
      expect(withBillFieldChange({ ...VALID, paying_account_id: '' }, 'provider_account_id', '4', lists).paying_account_id).toBe('');
    });
  });

  describe('validateBillFields', () => {
    it('builds the whitelisted body, a past due date allowed', () => {
      expect(validate()).toEqual({
        errors: {},
        body: {
          kind: 'one_off',
          provider_account_id: 3,
          paying_account_id: 1,
          due_date: '2020-01-31',
          expected_amount: '120.50',
          description: 'Boiler repair',
          notes: null,
        },
      });
    });

    it('requires the provider, the paying account, the due date, the amount and the description', () => {
      expect(validate({
        provider_account_id: '', paying_account_id: '', due_date: '', expected_amount: ' ', description: '   ',
      }).errors).toEqual({
        provider_account_id: jasmine.any(String),
        paying_account_id: jasmine.any(String),
        due_date: jasmine.any(String),
        expected_amount: jasmine.any(String),
        description: jasmine.any(String),
      });
      expect(validate({ description: '' }).body).toBeNull();
    });

    it('rejects a malformed due date', () => {
      expect(validate({ due_date: '10/03/2026' }).errors.due_date).toBeDefined();
    });

    [['0', 'zero'], ['-5', 'negative'], ['1.234', 'too many decimals'], ['abc', 'not a number'], ['100000000000.01', 'too large']]
      .forEach(([amount, label]) => {
        it(`rejects a ${label} amount`, () => {
          expect(validate({ expected_amount: amount }).errors.expected_amount).toBeDefined();
        });
      });

    it('checks the decimals against the provider currency', () => {
      expect(validate({ expected_amount: '10.5' }, 'JPY').errors.expected_amount).toBeDefined();
      expect(validate({ expected_amount: '10' }, 'JPY').body.expected_amount).toBe('10');
    });

    it('parses the amount without a known currency', () => {
      expect(validateBillFields(VALID).body.expected_amount).toBe('120.50');
    });

    it('bounds the description to 255 and the notes to 2000 characters', () => {
      expect(validate({ description: 'x'.repeat(255) }).errors).toEqual({});
      expect(validate({ description: 'x'.repeat(256) }).errors.description).toBeDefined();
      expect(validate({ notes: 'x'.repeat(2000) }).body.notes).toBe('x'.repeat(2000));
      expect(validate({ notes: 'x'.repeat(2001) }).errors.notes).toBeDefined();
    });

    it('sends trimmed notes, blank as null', () => {
      expect(validate({ notes: ' Call first ' }).body.notes).toBe('Call first');
      expect(validate({ notes: '   ' }).body.notes).toBeNull();
    });
  });

  describe('changedBillFields', () => {
    const original = validateBillFields(billFieldsFromBill(BILL), { currency: 'BRL' }).body;

    it('keeps nothing when nothing changed', () => {
      expect(changedBillFields(original, original)).toEqual({});
    });

    it('never keeps the kind, nor the provider of a recurring bill', () => {
      const before = validateBillFields(RECURRING, { currency: 'BRL' }).body;
      const after = validateBillFields({ ...RECURRING, provider_account_id: '4', due_day: '6' }, { currency: 'BRL' }).body;

      expect(changedBillFields(after, before)).toEqual({ due_day: 6 });
      expect(changedBillFields({ ...after, kind: 'one_off' }, { ...before, kind: 'recurring' })).toEqual({ due_day: 6, provider_account_id: 4 });
    });

    it('keeps only the changed fields', () => {
      const body = validateBillFields({ ...billFieldsFromBill(BILL), expected_amount: '99', notes: 'n' }, { currency: 'BRL' }).body;

      expect(changedBillFields(body, original)).toEqual({ expected_amount: '99', notes: 'n' });
    });
  });
});
