import BankDebtListHelper from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtListHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const DEBTS = [
  {
    id: 1,
    name: 'Car loan',
    bank_name: 'Bank A',
    currency: 'BRL',
    balance: '-9500.00',
    archived_at: null,
    debt: {
      interest_rate: '1.99', interest_period: 'monthly', instalment_amount: '500.00', instalment_frequency: 'monthly',
    },
  },
  {
    id: 2,
    name: 'House',
    bank_name: null,
    currency: 'JPY',
    balance: '-100000',
    archived_at: '2026-01-01T00:00:00.000Z',
    debt: {
      interest_rate: null, interest_period: null, instalment_amount: '1200', instalment_frequency: 'yearly',
    },
  },
  {
    id: 3, name: 'Zed', bank_name: 'Bank Z', currency: 'BRL', balance: '0.00', archived_at: null, debt: null,
  },
];

const handlers = { onRetry: () => undefined, onDismiss: () => undefined };

function output(state = {}) {
  return renderedOutput(BankDebtListHelper.render({
    accounts: DEBTS, error: null, archived: false, context: PERSONAL, ...state,
  }, handlers));
}

describe('BankDebtListHelper', () => {
  it('renders the columns', () => {
    expect(output().containsInOrder('Name', 'Creditor', 'Balance', 'Instalment', 'Interest rate', 'Currency')).toBeTrue();
  });

  it('renders the rows in the given (name) order', () => {
    expect(output().containsInOrder('Car loan', 'House', 'Zed')).toBeTrue();
  });

  it('formats balance, instalment with frequency and rate with period', () => {
    expect(output().containsInOrder(
      'Car loan',
      'Bank A',
      formatMoney('-9500.00', 'BRL'),
      `${formatMoney('500.00', 'BRL')} / month`,
      '1.99% / month',
      'BRL',
    )).toBeTrue();
    expect(output().containsInOrder('House', formatMoney('-100000', 'JPY'), `${formatMoney('1200', 'JPY')} / year`, 'JPY'))
      .toBeTrue();
  });

  it('leaves unset debt fields empty', () => {
    expect(output({ accounts: [DEBTS[2]] }).contains('%')).toBeFalse();
    expect(output({ accounts: [DEBTS[1]] }).contains('%')).toBeFalse();
  });

  it('shows no grand total', () => {
    expect(output().contains('Total')).toBeFalse();
  });

  it('marks archived rows', () => {
    expect(output().containsInOrder('House', 'Archived')).toBeTrue();
    expect(output({ accounts: [DEBTS[0]] }).contains('>Archived<')).toBeFalse();
  });

  it('links each row to its debt detail and New debt, in Personal', () => {
    const page = output();

    expect(page.containsAttribute('href', '#/bank/debts/1')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/debts/new"', 'New debt')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts?archived=true')).toBeTrue();
  });

  it('builds the links from an organization context', () => {
    const page = output({ context: ORG, archived: true });

    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/1')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/new')).toBeTrue();
    expect(page.containsInOrder('href="#/orgs/5/bank/debts"', 'Hide archived')).toBeTrue();
  });

  it('renders the empty state with a create button', () => {
    const page = output({ accounts: [] });

    expect(page.contains('No debts yet')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/debts/new"', 'Create a debt')).toBeTrue();
    expect(page.containsTag('table')).toBeFalse();
  });

  it('renders the loading state, and nothing below the alert on error', () => {
    expect(output({ accounts: null }).contains('Loading')).toBeTrue();

    const page = output({ accounts: null, error: classifyError(new ApiError(500, 'boom')) });

    expect(page.contains('Loading')).toBeFalse();
    expect(page.contains('Retry')).toBeTrue();
  });

  it('escapes the name and creditor', () => {
    const page = output({ accounts: [{ ...DEBTS[0], name: '<img src=x>', bank_name: '<script>x</script>' }] });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
