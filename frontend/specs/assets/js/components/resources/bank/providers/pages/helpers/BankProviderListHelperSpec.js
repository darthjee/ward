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
      for_accountant: true, provider_tax_id: '123',
    },
    bills_summary: { count: 3, monthly: '250.00', yearly: '1200.00' },
  },
  {
    id: 2,
    name: 'Domain',
    bank_name: 'Registrar',
    currency: 'JPY',
    balance: '0',
    archived_at: '2026-01-01T00:00:00.000Z',
    provider_expense: {
      for_accountant: false, provider_tax_id: null,
    },
    bills_summary: { count: 1, monthly: null, yearly: '1500' },
  },
  {
    id: 3,
    name: 'Zed',
    bank_name: null,
    currency: 'BRL',
    balance: '0.00',
    archived_at: null,
    provider_expense: {
      for_accountant: false, provider_tax_id: null,
    },
    bills_summary: { count: 0, monthly: null, yearly: null },
  },
];

const LEGACY = {
  id: 4,
  name: 'Legacy',
  bank_name: 'Old bank',
  currency: 'BRL',
  balance: '0.00',
  archived_at: null,
  provider_expense: {
    for_accountant: true, provider_tax_id: null,
  },
};

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
    expect(page.containsInOrder('Name', 'Provider', 'Balance', 'Bills', 'For accountant', 'Currency')).toBeTrue();
    expect(page.contains('Expected amount')).toBeFalse();
  });

  it('renders the rows in the given (name) order', () => {
    expect(output().containsInOrder('Office rent', 'Domain', 'Zed')).toBeTrue();
  });

  it('formats the balance, the bills summary and the for-accountant marker', () => {
    expect(output().containsInOrder(
      'Office rent', 'Landlord Ltd', formatMoney('-200.00', 'BRL'),
      '3 bills', ' · ', `${formatMoney('250.00', 'BRL')} / month`, ' + ', `${formatMoney('1200.00', 'BRL')} / year`,
      'Yes', 'BRL',
    )).toBeTrue();
  });

  it('summarises an archived provider\'s bills the same way', () => {
    expect(output().containsInOrder(
      'Domain', formatMoney('0', 'JPY'), '1 bill', ' · ', `${formatMoney('1500', 'JPY')} / year`, '—', 'JPY',
    )).toBeTrue();
  });

  it('shows "—" without bills', () => {
    expect(output({ accounts: [PROVIDERS[2]] }).containsInOrder('Zed', formatMoney('0.00', 'BRL'), '—', '—', 'BRL')).toBeTrue();
  });

  it('leaves the cell empty without a bills summary', () => {
    const page = output({ accounts: [LEGACY] });

    expect(page.containsInOrder('Legacy', formatMoney('0.00', 'BRL'), '<td class="text-end"></td>', 'Yes', 'BRL')).toBeTrue();
    expect(page.contains('—')).toBeFalse();
  });

  it('keeps each part of the bills summary on one line', () => {
    const page = output({ accounts: [PROVIDERS[0]] });

    expect(page.containsAttribute('class', 'text-nowrap')).toBeTrue();
    expect(page.containsElement('span', '3 bills')).toBeTrue();
    expect(page.containsElement('span', `${formatMoney('250.00', 'BRL')} / month`)).toBeTrue();
    expect(page.containsElement('span', `${formatMoney('1200.00', 'BRL')} / year`)).toBeTrue();
    expect(page.containsInOrder('<span class="text-nowrap">3 bills</span> · <span class="text-nowrap">')).toBeTrue();
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
