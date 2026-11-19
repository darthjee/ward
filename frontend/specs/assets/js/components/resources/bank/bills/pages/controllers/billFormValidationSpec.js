import { validateBillFields } from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/billFormValidation.js';

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

describe('billFormValidation for a recurring bill', () => {
  function recurring(overrides = {}) {
    return validateBillFields({ ...RECURRING, ...overrides }, { currency: 'BRL' });
  }

  it('builds the recurring body, without the one-off date and with optional values null', () => {
    expect(recurring()).toEqual({
      errors: {},
      body: {
        kind: 'recurring',
        provider_account_id: 3,
        expected_amount: null,
        description: 'Rent',
        notes: null,
        charge_frequency: 'monthly',
        due_day: 5,
        due_month: null,
        bills_from: null,
        show_in_calendar: true,
        paying_account_id: null,
      },
    });
  });

  it('requires the description, the frequency and the due day', () => {
    expect(recurring({ description: '', charge_frequency: '', due_day: '' }).errors).toEqual({
      description: jasmine.any(String), charge_frequency: jasmine.any(String), due_day: jasmine.any(String),
    });
  });

  [['0'], ['32'], ['abc']].forEach(([day]) => {
    it(`rejects the due day ${day}`, () => {
      expect(recurring({ due_day: day }).errors.due_day).toBeDefined();
    });
  });

  it('requires the due month only for yearly bills', () => {
    expect(recurring({ charge_frequency: 'yearly' }).errors.due_month).toBeDefined();
    expect(recurring({ charge_frequency: 'yearly', due_month: '3' }).body.due_month).toBe(3);
    expect(recurring({ charge_frequency: 'yearly', due_month: '13' }).errors.due_month).toBeDefined();
  });

  it('drops the due month of a monthly bill', () => {
    expect(recurring({ due_month: '3' }).body.due_month).toBeNull();
  });

  it('accepts an optional amount, Bills from and paying account', () => {
    const { body } = recurring({ expected_amount: '10', bills_from: '2026-01-01', paying_account_id: '1' });

    expect(body).toEqual(jasmine.objectContaining({ expected_amount: '10', bills_from: '2026-01-01', paying_account_id: 1 }));
    expect(recurring({ bills_from: 'x' }).errors.bills_from).toBeDefined();
  });

  it('validates a given amount', () => {
    expect(recurring({ expected_amount: 'abc' }).errors.expected_amount).toBeDefined();
  });
});
