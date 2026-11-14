import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import DebtInfoHelper from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/DebtInfoHelper.jsx';
import { monthName } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const DEBT = {
  id: 7,
  name: 'Car loan',
  bank_name: 'Bank A',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-10000.00',
  notes: 'Some notes',
  debt: {
    interest_rate: '1.99',
    interest_period: 'monthly',
    instalment_amount: '500.00',
    instalment_frequency: 'yearly',
    due_day: 10,
    due_month: 3,
    instalment_count: 24,
  },
};

function output(account = {}) {
  return renderedOutput(DebtInfoHelper.render({ ...DEBT, ...account }));
}

describe('DebtInfoHelper', () => {
  it('renders the common fields with the debt labels, the amount owed shown positive', () => {
    expect(output().containsInOrder(
      'Creditor',
      'Bank A',
      'Currency',
      'BRL',
      'Loan date',
      formatDate('2026-01-01'),
      'Amount owed',
      formatMoney('10000.00', 'BRL'),
      'Notes',
      'Some notes',
    )).toBeTrue();
  });

  it('renders the debt info block', () => {
    expect(output().containsInOrder(
      'Debt info',
      'Interest rate',
      '1.99% / month',
      'Instalment amount',
      formatMoney('500.00', 'BRL'),
      'Frequency',
      'Yearly',
      'Due day',
      '10',
      'Due month',
      monthName(3),
      'Instalment count',
      '24',
    )).toBeTrue();
  });

  it('shows a dash for every unset debt field', () => {
    const page = output({
      debt: {
        interest_rate: null,
        interest_period: null,
        instalment_amount: null,
        instalment_frequency: null,
        due_day: null,
        due_month: null,
        instalment_count: null,
      },
    });

    expect(page.contains('%')).toBeFalse();
    expect(page.containsInOrder('Interest rate', '—', 'Instalment amount', '—', 'Frequency', '—', 'Due day', '—', 'Due month', '—', 'Instalment count', '—'))
      .toBeTrue();
  });

  it('renders the schedule values after the debt info', () => {
    const page = output({
      debt: {
        ...DEBT.debt, bills_from: '2026-02-01', show_in_calendar: true, paying_account: { id: 9, name: 'Main' },
      },
    });

    expect(page.containsInOrder(
      'Instalment count', 'Bills from', formatDate('2026-02-01'), 'Show in Calendar', 'Yes', 'Default paying account', 'Main',
    )).toBeTrue();
  });

  it('shows "—" for blank schedule values and No when hidden from the Calendar', () => {
    const page = output({ debt: { ...DEBT.debt, bills_from: null, show_in_calendar: false, paying_account: null } });

    expect(page.containsInOrder('Bills from', '—', 'Show in Calendar', 'No', 'Default paying account', '—')).toBeTrue();
  });

  it('escapes the default paying account name', () => {
    const page = output({ debt: { ...DEBT.debt, paying_account: { id: 9, name: '<script>alert(1)</script>' } } });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('&lt;script&gt;')).toBeTrue();
  });

  it('copes with a missing debt object', () => {
    expect(output({ debt: undefined }).contains('Interest rate')).toBeTrue();
  });

  it('escapes the creditor and notes', () => {
    const page = output({ bank_name: '<img src=x>', notes: '<script>x</script>' });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
