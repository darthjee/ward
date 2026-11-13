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
  provider_account_id: '3',
  paying_account_id: '1',
  due_date: '2020-01-31',
  amount: '120,50',
  description: '  Boiler repair ',
  notes: '',
};
const BILL = {
  id: 9,
  provider_account: { id: 3, name: 'Plumber' },
  paying_account: { id: 1, name: 'Main' },
  due_date: '2026-03-10',
  amount: '120.50',
  currency: 'BRL',
  description: 'Boiler repair',
  notes: null,
  payment: null,
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
        provider_account_id: '3', paying_account_id: '', due_date: '2026-05-10', amount: '', description: '', notes: '',
      });
    });

    it('defaults to no provider and the local today', () => {
      expect(emptyBillFields().provider_account_id).toBe('');
      expect(emptyBillFields().due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('billFieldsFromBill', () => {
    it('reads the account ids from their objects', () => {
      expect(billFieldsFromBill(BILL)).toEqual({
        provider_account_id: '3',
        paying_account_id: '1',
        due_date: '2026-03-10',
        amount: '120.50',
        description: 'Boiler repair',
        notes: '',
      });
    });

    it('tolerates a bill without a paying account', () => {
      expect(billFieldsFromBill({ id: 1, paying_account: null }).paying_account_id).toBe('');
      expect(billFieldsFromBill({ id: 1 })).toEqual(jasmine.objectContaining({ provider_account_id: '', amount: '' }));
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

    it('clears the paying account when the provider is unset', () => {
      expect(withBillFieldChange(VALID, 'provider_account_id', '', lists).paying_account_id).toBe('');
    });

    it('only sets other fields', () => {
      expect(withBillFieldChange(VALID, 'amount', '5', lists)).toEqual({ ...VALID, amount: '5' });
      expect(withBillFieldChange({ ...VALID, paying_account_id: '' }, 'provider_account_id', '4', lists).paying_account_id).toBe('');
    });
  });

  describe('validateBillFields', () => {
    it('builds the whitelisted body, a past due date allowed', () => {
      expect(validate()).toEqual({
        errors: {},
        body: {
          provider_account_id: 3,
          paying_account_id: 1,
          due_date: '2020-01-31',
          amount: '120.50',
          description: 'Boiler repair',
          notes: null,
        },
      });
    });

    it('requires the provider, the paying account, the due date, the amount and the description', () => {
      expect(validate({
        provider_account_id: '', paying_account_id: '', due_date: '', amount: ' ', description: '   ',
      }).errors).toEqual({
        provider_account_id: jasmine.any(String),
        paying_account_id: jasmine.any(String),
        due_date: jasmine.any(String),
        amount: jasmine.any(String),
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
          expect(validate({ amount }).errors.amount).toBeDefined();
        });
      });

    it('checks the decimals against the provider currency', () => {
      expect(validate({ amount: '10.5' }, 'JPY').errors.amount).toBeDefined();
      expect(validate({ amount: '10' }, 'JPY').body.amount).toBe('10');
    });

    it('parses the amount without a known currency', () => {
      expect(validateBillFields(VALID).body.amount).toBe('120.50');
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

    it('keeps only the changed fields', () => {
      const body = validateBillFields({ ...billFieldsFromBill(BILL), amount: '99', notes: 'n' }, { currency: 'BRL' }).body;

      expect(changedBillFields(body, original)).toEqual({ amount: '99', notes: 'n' });
    });
  });
});
