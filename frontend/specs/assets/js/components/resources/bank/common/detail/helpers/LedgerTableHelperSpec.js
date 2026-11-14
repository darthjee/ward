import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import LedgerTableHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import DisplayLocale from '../../../../../../../../../assets/js/utils/locale/DisplayLocale.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ROWS = [
  {
    id: 2, date: '2026-05-02', amount: '-12.50', description: 'Coffee', notes: 'beans', balance: '87.50',
  },
  {
    id: 1, date: '2026-05-01', amount: '100.00', description: 'Salary', notes: null, balance: '100.00',
  },
];
const OPENING = { date: '2026-04-01', amount: '0.00', balance: '0.00' };

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

describe('LedgerTableHelper', () => {
  let handlers;

  beforeEach(() => {
    handlers = { onEdit: jasmine.createSpy('onEdit'), onDeleteTransaction: jasmine.createSpy('onDeleteTransaction') };
  });

  function state(overrides = {}) {
    return {
      ledger: { transactions: ROWS, opening: null },
      currency: 'BRL',
      editingId: null,
      readOnly: false,
      busy: false,
      page: 1,
      firstPageHref: '#/bank/accounts/12?page=1',
      ...overrides,
    };
  }

  function output(overrides) {
    return renderedOutput(LedgerTableHelper.render(state(overrides), handlers));
  }

  it('renders the columns', () => {
    expect(output().containsInOrder('Date', 'Description', 'Amount', 'Balance')).toBeTrue();
  });

  it('renders rows newest first, as returned, with formatted amounts and running balances', () => {
    expect(output().containsInOrder(
      formatDate('2026-05-02'), 'Coffee', 'beans', formatMoney('-12.50', 'BRL'), formatMoney('87.50', 'BRL'), formatDate('2026-05-01'), 'Salary',
    )).toBeTrue();
  });

  it('renders the opening row last, without actions, only when present', () => {
    const withOpening = output({ ledger: { transactions: ROWS, opening: OPENING } });

    expect(withOpening.containsInOrder('Salary', 'Opening balance')).toBeTrue();
    expect(withOpening.containsInOrder('Opening balance', 'Edit')).toBeFalse();
    expect(output().contains('Opening balance')).toBeFalse();
  });

  it('renders only the opening row on a single page without transactions', () => {
    const page = output({ ledger: { transactions: [], opening: OPENING } });

    expect(page.contains('Opening balance')).toBeTrue();
    expect(page.contains('No transactions on this page')).toBeFalse();
  });

  it('shows the past-the-end message with a link to page 1', () => {
    const page = output({ ledger: { transactions: [], opening: null }, page: 9 });

    expect(page.contains('No transactions on this page')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/accounts/12?page=1')).toBeTrue();
  });

  it('highlights the row being edited', () => {
    expect(output({ editingId: 1 }).containsInOrder('Coffee', 'table-warning', 'Salary')).toBeTrue();
  });

  it('wires Edit and Delete per row', () => {
    const buttons = findAll(LedgerTableHelper.render(state(), handlers), (node) => typeof node.props?.onClick === 'function');

    buttons[0].props.onClick();
    buttons[1].props.onClick();

    expect(handlers.onEdit).toHaveBeenCalledWith(ROWS[0]);
    expect(handlers.onDeleteTransaction).toHaveBeenCalledWith(ROWS[0]);
  });

  it('hides every action on an archived account, keeping the ledger readable', () => {
    const page = output({ readOnly: true, ledger: { transactions: ROWS, opening: OPENING } });

    expect(page.contains('Edit')).toBeFalse();
    expect(page.contains('Delete')).toBeFalse();
    expect(page.containsInOrder('Coffee', 'Salary', 'Opening balance')).toBeTrue();
  });

  it('renders the optional per-row slot under the description', () => {
    const renderRowExtra = jasmine.createSpy('renderRowExtra').and.callFake((row) => (row.id === 2 ? 'EXTRA' : null));
    const page = output({ renderRowExtra });

    expect(page.containsInOrder('Coffee', 'beans', 'EXTRA', formatMoney('-12.50', 'BRL'), 'Salary')).toBeTrue();
    expect(renderRowExtra).toHaveBeenCalledWith(ROWS[1]);
  });

  it('keeps the per-row slot on an archived account, without Edit / Delete', () => {
    const page = output({ readOnly: true, renderRowExtra: () => 'EXTRA' });

    expect(page.containsInOrder('Coffee', 'EXTRA')).toBeTrue();
    expect(page.contains('Delete')).toBeFalse();
  });

  it('disables Delete while an action is in flight', () => {
    expect(output({ busy: true }).contains('disabled=""')).toBeTrue();
  });

  it('escapes descriptions and notes', () => {
    const page = output({ ledger: { transactions: [{ ...ROWS[0], description: '<b>x</b>', notes: '<i>y</i>' }], opening: null } });

    expect(page.contains('<b>x</b>')).toBeFalse();
    expect(page.contains('<i>y</i>')).toBeFalse();
    expect(page.contains('&lt;b&gt;x&lt;/b&gt;')).toBeTrue();
  });

  it('renders dates in the display locale', () => {
    DisplayLocale.set('pt-BR');
    const page = output();
    DisplayLocale.set(null);

    expect(page.containsInOrder('02/05/2026', 'Coffee', '01/05/2026', 'Salary')).toBeTrue();
  });
});
