import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import BankInvestmentListHelper from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentListHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const INVESTMENTS = [
  {
    id: 1,
    name: 'CDB',
    bank_name: 'Broker A',
    currency: 'BRL',
    balance: '10500.00',
    archived_at: null,
    investment: {
      kind: 'fixed_income', yield_rate: '1.1', yield_period: 'monthly', maturity_date: '2028-01-01', liquidity_days: 30,
    },
  },
  {
    id: 2,
    name: 'Nikkei fund',
    bank_name: null,
    currency: 'JPY',
    balance: '100000',
    archived_at: '2026-01-01T00:00:00.000Z',
    investment: {
      kind: null, yield_rate: null, yield_period: null, maturity_date: null, liquidity_days: null,
    },
  },
  {
    id: 3, name: 'Zed', bank_name: 'Broker Z', currency: 'BRL', balance: '0.00', archived_at: null, investment: null,
  },
];

const handlers = { onRetry: () => undefined, onDismiss: () => undefined };

function output(state = {}) {
  return renderedOutput(BankInvestmentListHelper.render({
    accounts: INVESTMENTS, error: null, archived: false, context: PERSONAL, ...state,
  }, handlers));
}

describe('BankInvestmentListHelper', () => {
  it('renders the title and the columns', () => {
    const page = output();

    expect(page.containsElement('h1', 'Investments')).toBeTrue();
    expect(page.containsInOrder(
      'Name', 'Institution', 'Kind', 'Current value', 'Yield rate', 'Maturity date', 'Currency',
    )).toBeTrue();
  });

  it('renders the rows in the given (name) order', () => {
    expect(output().containsInOrder('CDB', 'Nikkei fund', 'Zed')).toBeTrue();
  });

  it('formats kind, current value, rate with period and maturity date', () => {
    expect(output().containsInOrder(
      'CDB', 'Broker A', 'Fixed income', formatMoney('10500.00', 'BRL'), '1.1% / month', formatDate('2028-01-01'), 'BRL',
    )).toBeTrue();
    expect(output().containsInOrder('Nikkei fund', formatMoney('100000', 'JPY'), 'JPY')).toBeTrue();
  });

  it('leaves unset investment fields empty', () => {
    expect(output({ accounts: [INVESTMENTS[1]] }).contains('%')).toBeFalse();
    expect(output({ accounts: [INVESTMENTS[2]] }).contains('%')).toBeFalse();
  });

  it('shows no total row', () => {
    const page = output();

    expect(page.contains('Total')).toBeFalse();
    expect(page.containsTag('tfoot')).toBeFalse();
  });

  it('marks archived rows', () => {
    expect(output().containsInOrder('Nikkei fund', 'Archived')).toBeTrue();
    expect(output({ accounts: [INVESTMENTS[0]] }).contains('>Archived<')).toBeFalse();
  });

  it('links each row to its detail, the toggle and New investment, in Personal', () => {
    const page = output();

    expect(page.containsAttribute('href', '#/bank/investments/1')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/investments/new"', 'New investment')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/investments?archived=true"', 'Show archived')).toBeTrue();
  });

  it('builds the links from an organization context', () => {
    const page = output({ context: ORG, archived: true });

    expect(page.containsAttribute('href', '#/orgs/5/bank/investments/1')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/investments/new')).toBeTrue();
    expect(page.containsInOrder('href="#/orgs/5/bank/investments"', 'Hide archived')).toBeTrue();
  });

  it('renders the empty state with a create button', () => {
    const page = output({ accounts: [] });

    expect(page.contains('No investments yet')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/investments/new"', 'Create an investment')).toBeTrue();
    expect(page.containsTag('table')).toBeFalse();
  });

  it('renders the loading state, and nothing below the alert on error', () => {
    expect(output({ accounts: null }).contains('Loading')).toBeTrue();

    const page = output({ accounts: null, error: classifyError(new ApiError(500, 'boom')) });

    expect(page.contains('Loading')).toBeFalse();
    expect(page.contains('Retry')).toBeTrue();
  });

  it('escapes the name and institution', () => {
    const page = output({ accounts: [{ ...INVESTMENTS[0], name: '<img src=x>', bank_name: '<script>x</script>' }] });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
