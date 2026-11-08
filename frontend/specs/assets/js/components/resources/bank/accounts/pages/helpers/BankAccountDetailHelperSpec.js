import BankAccountDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ConfirmModal from '../../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 12, name: 'Main', currency: 'BRL', balance: '10.00', opening_balance: '0.00', opening_date: '2026-01-01', archived_at: null,
};
const LEDGER = {
  transactions: [{
    id: 1, date: '2026-05-01', amount: '10.00', description: 'Salary', notes: null, balance: '10.00',
  }],
  opening: { date: '2026-01-01', amount: '0.00', balance: '0.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 1, total_count: 1,
  },
};

const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function findAll(node, predicate, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  if (predicate(node)) {
    acc.push(node);
  }

  return findAll(node.props?.children, predicate, acc);
}

function state(overrides = {}) {
  return {
    context: { kind: 'personal' },
    accountId: '12',
    page: 1,
    data: { account: ACCOUNT, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    ...overrides,
  };
}

function output(overrides) {
  return renderedOutput(BankAccountDetailHelper.render(state(overrides), HANDLERS));
}

describe('BankAccountDetailHelper', () => {
  it('renders the header, the inline form at the top of the ledger, then the table', () => {
    expect(output().containsInOrder('Main', 'Ledger', 'New transaction', 'Salary', 'Opening balance')).toBeTrue();
  });

  it('hides Delete from the ledger total_count', () => {
    const withRows = output();
    const empty = output({
      data: { account: ACCOUNT, ledger: { ...LEDGER, transactions: [], pagination: { ...LEDGER.pagination, total_count: 0 } } },
    });

    expect(withRows.contains('btn-outline-danger')).toBeFalse();
    expect(empty.contains('btn-outline-danger')).toBeTrue();
  });

  it('hides every write on an archived account, keeping the ledger', () => {
    const page = output({ data: { account: { ...ACCOUNT, archived_at: '2026-02-01' }, ledger: LEDGER } });

    expect(page.contains('New transaction')).toBeFalse();
    expect(page.contains('>Edit<')).toBeFalse();
    expect(page.contains('Salary')).toBeTrue();
  });

  it('hides the pagination for a single page', () => {
    expect(output().contains('pagination')).toBeFalse();
  });

  it('paginates with page links in the hash', () => {
    const page = output({
      page: 2,
      data: { account: ACCOUNT, ledger: { ...LEDGER, opening: null, pagination: { ...LEDGER.pagination, page: 2, total_pages: 3 } } },
    });

    expect(page.contains('pagination')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/accounts/12?page=3')).toBeTrue();
    expect(page.contains('fst-italic')).toBeFalse();
  });

  it('shows the action alert', () => {
    expect(output({ error: classifyError(new ApiError(409, 'Archive it instead', 'ACCOUNT_HAS_TRANSACTIONS')) })
      .contains('Archive it instead')).toBeTrue();
  });

  it('renders a loading notice', () => {
    expect(output({ data: null }).contains('Loading')).toBeTrue();
  });

  it('renders the load error with Retry', () => {
    const page = output({ data: null, loadError: classifyError(new TypeError('x')) });

    expect(page.contains('Retry')).toBeTrue();
    expect(page.contains('Loading')).toBeFalse();
  });

  it('links back to the list', () => {
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/accounts')).toBeTrue();
  });

  describe('delete confirmation', () => {
    function modal(overrides) {
      return findAll(BankAccountDetailHelper.render(state(overrides), HANDLERS), (node) => node.type === ConfirmModal)[0];
    }

    it('is closed by default', () => {
      expect(modal().props.show).toBeFalse();
    });

    it('confirms the account deletion', () => {
      const element = modal({ confirmation: { kind: 'account' } });

      expect(element.props.show).toBeTrue();
      expect(element.props.title).toBe('Delete account');
    });

    it('confirms a transaction deletion, disabled while in flight', () => {
      const element = modal({ confirmation: { kind: 'transaction', transaction: LEDGER.transactions[0] }, actionPending: 'delete' });

      expect(element.props.title).toBe('Delete transaction');
      expect(element.props.children).toContain('Salary');
      expect(element.props.pending).toBeTrue();
    });
  });
});
