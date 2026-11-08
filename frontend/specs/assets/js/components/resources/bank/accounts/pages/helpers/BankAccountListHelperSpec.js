import BankAccountListHelper from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountListHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const ACCOUNTS = [
  {
    id: 1, name: 'Alpha', bank_name: 'Bank A', branch: '001', account_number: '•••• 1234', currency: 'BRL', balance: '-1234.56', archived_at: null,
  },
  {
    id: 2, name: 'Beta', bank_name: 'Bank B', branch: null, account_number: null, currency: 'JPY', balance: '500', archived_at: '2026-01-01T00:00:00.000Z',
  },
];

const handlers = { onRetry: () => undefined, onDismiss: () => undefined };

function output(state = {}) {
  return renderedOutput(BankAccountListHelper.render({
    accounts: ACCOUNTS, error: null, archived: false, context: PERSONAL, ...state,
  }, handlers));
}

describe('BankAccountListHelper', () => {
  it('renders the columns', () => {
    expect(output().containsInOrder('Name', 'Bank', 'Branch', 'Account number', 'Currency', 'Balance')).toBeTrue();
  });

  it('renders the rows in the given (name) order', () => {
    expect(output().containsInOrder('Alpha', 'Bank A', '001', '•••• 1234', 'BRL', 'Beta')).toBeTrue();
  });

  it('formats each balance in the account currency, with no grand total', () => {
    const page = output();

    expect(page.contains(formatMoney('-1234.56', 'BRL'))).toBeTrue();
    expect(page.contains(formatMoney('500', 'JPY'))).toBeTrue();
    expect(page.contains('Total')).toBeFalse();
  });

  it('marks archived rows', () => {
    expect(output().containsInOrder('Beta', 'Archived')).toBeTrue();
    expect(output().containsInOrder('Alpha', 'Archived', 'Beta')).toBeFalse();
  });

  it('links each row to its detail page in Personal', () => {
    expect(output().containsAttribute('href', '#/bank/accounts/1')).toBeTrue();
  });

  it('links each row to its detail page in an organization', () => {
    const page = output({ context: ORG });

    expect(page.containsAttribute('href', '#/orgs/5/bank/accounts/2')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/accounts/new')).toBeTrue();
  });

  it('offers Show archived when hidden', () => {
    const page = output();

    expect(page.contains('Show archived')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/accounts?archived=true')).toBeTrue();
  });

  it('offers Hide archived when shown', () => {
    const page = output({ archived: true, context: ORG });

    expect(page.contains('Hide archived')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/accounts')).toBeTrue();
  });

  it('renders a New account button', () => {
    expect(output().containsInOrder('href="#/bank/accounts/new"', 'New account')).toBeTrue();
  });

  it('renders the empty state with a create button', () => {
    const page = output({ accounts: [] });

    expect(page.contains('No accounts yet')).toBeTrue();
    expect(page.contains('Create an account')).toBeTrue();
    expect(page.containsTag('table')).toBeFalse();
  });

  it('renders a loading notice', () => {
    expect(output({ accounts: null }).contains('Loading')).toBeTrue();
  });

  it('renders the transient alert with Retry instead of the loading notice', () => {
    const page = output({ accounts: null, error: classifyError(new TypeError('x')) });

    expect(page.contains('Retry')).toBeTrue();
    expect(page.contains('Loading')).toBeFalse();
  });

  it('escapes user input', () => {
    const page = output({ accounts: [{ ...ACCOUNTS[0], name: '<script>x</script>' }] });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('&lt;script&gt;')).toBeTrue();
  });
});
