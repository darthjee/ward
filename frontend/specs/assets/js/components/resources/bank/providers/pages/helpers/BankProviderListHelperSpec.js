import BankProviderListHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const PROVIDERS = [
  {
    id: 1,
    name: 'Office rent',
    bank_name: 'Landlord Ltd',
    currency: 'BRL',
    balance: '-200.00',
    archived_at: null,
    provider_expense: {
      for_accountant: true, provider_tax_id: '123', expected_amount: '200.00', charge_frequency: 'monthly', due_day: 10, due_month: null,
    },
  },
  {
    id: 2,
    name: 'Domain',
    bank_name: 'Registrar',
    currency: 'JPY',
    balance: '0',
    archived_at: '2026-01-01T00:00:00.000Z',
    provider_expense: {
      for_accountant: false, provider_tax_id: null, expected_amount: '1500', charge_frequency: 'yearly', due_day: null, due_month: 3,
    },
  },
  {
    id: 3,
    name: 'Zed',
    bank_name: null,
    currency: 'BRL',
    balance: '0.00',
    archived_at: null,
    provider_expense: {
      for_accountant: false, provider_tax_id: null, expected_amount: null, charge_frequency: 'monthly', due_day: null, due_month: null,
    },
  },
];

const handlers = { onRetry: () => undefined, onDismiss: () => undefined };

function output(state = {}) {
  return renderedOutput(BankProviderListHelper.render({
    accounts: PROVIDERS, error: null, archived: false, context: PERSONAL, ...state,
  }, handlers));
}

describe('BankProviderListHelper', () => {
  it('renders the title and the columns', () => {
    const page = output();

    expect(page.containsElement('h1', 'Providers')).toBeTrue();
    expect(page.containsInOrder('Name', 'Provider', 'Balance', 'Expected amount', 'For accountant', 'Currency')).toBeTrue();
  });

  it('renders the rows in the given (name) order', () => {
    expect(output().containsInOrder('Office rent', 'Domain', 'Zed')).toBeTrue();
  });

  it('formats the balance, the expected amount with its frequency and the for-accountant marker', () => {
    expect(output().containsInOrder(
      'Office rent', 'Landlord Ltd', formatMoney('-200.00', 'BRL'), `${formatMoney('200.00', 'BRL')} / month`, 'Yes', 'BRL',
    )).toBeTrue();
    expect(output().containsInOrder('Domain', formatMoney('0', 'JPY'), `${formatMoney('1500', 'JPY')} / year`, '—', 'JPY'))
      .toBeTrue();
  });

  it('shows "—" without an expected amount', () => {
    expect(output({ accounts: [PROVIDERS[2]] }).containsInOrder('Zed', formatMoney('0.00', 'BRL'), '—', '—', 'BRL')).toBeTrue();
  });

  it('tolerates a row without its provider_expense object', () => {
    expect(output({ accounts: [{ ...PROVIDERS[0], provider_expense: null }] }).containsInOrder('Office rent', '—')).toBeTrue();
  });

  it('shows no total row', () => {
    const page = output();

    expect(page.contains('Total')).toBeFalse();
    expect(page.containsTag('tfoot')).toBeFalse();
  });

  it('marks archived rows', () => {
    expect(output().containsInOrder('Domain', 'Archived')).toBeTrue();
    expect(output({ accounts: [PROVIDERS[0]] }).contains('>Archived<')).toBeFalse();
  });

  it('links each row, the toggle, the hand-off and New provider, in Personal', () => {
    const page = output();

    expect(page.containsAttribute('href', '#/bank/providers/1')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/providers?archived=true"', 'Show archived')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/providers/accountant"', 'Accountant hand-off', 'href="#/bank/providers/new"', 'New provider'))
      .toBeTrue();
  });

  it('builds the links from an organization context', () => {
    const page = output({ context: ORG, archived: true });

    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/1')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/new')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/accountant')).toBeTrue();
    expect(page.containsInOrder('href="#/orgs/5/bank/providers"', 'Hide archived')).toBeTrue();
  });

  it('renders the empty state with a create button and keeps the hand-off link', () => {
    const page = output({ accounts: [] });

    expect(page.contains('No providers yet')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/providers/new"', 'Create a provider')).toBeTrue();
    expect(page.contains('Accountant hand-off')).toBeTrue();
    expect(page.containsTag('table')).toBeFalse();
  });

  it('renders the loading state, and nothing below the alert on error', () => {
    expect(output({ accounts: null }).contains('Loading')).toBeTrue();

    const page = output({ accounts: null, error: classifyError(new ApiError(500, 'boom')) });

    expect(page.contains('Loading')).toBeFalse();
    expect(page.contains('Retry')).toBeTrue();
  });

  it('escapes the name and the provider', () => {
    const page = output({ accounts: [{ ...PROVIDERS[0], name: '<img src=x>', bank_name: '<script>x</script>' }] });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
