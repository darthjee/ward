import StatementsHistoryHelper, {
  EMPTY_STATEMENTS_TEXT,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/helpers/StatementsHistoryHelper.jsx';
import UndoReconciliationConfirm from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/UndoReconciliationConfirm.jsx';
import BankPagination from '../../../../../../../../../assets/js/components/resources/bank/common/BankPagination.jsx';
import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const OPEN = {
  id: 3, status: 'open', statement_date: '2026-04-30', statement_balance: '500.00', reconciled_at: null, transaction_count: 2, undoable: false,
};
const LATEST = {
  id: 2, status: 'finished', statement_date: '2026-03-31', statement_balance: '300.00', reconciled_at: '2026-04-02T10:00:00.000Z', transaction_count: 12, undoable: true,
};
const OLD = {
  id: 1, status: 'finished', statement_date: '2026-02-28', statement_balance: '100.00', reconciled_at: '2026-03-01T10:00:00.000Z', transaction_count: 7, undoable: false,
};
const ACCOUNT = { id: 7, currency: 'BRL', type: 'regular' };
const noop = () => undefined;
const HANDLERS = {
  onNavigate: noop, onUndo: noop, onConfirmUndo: noop, onCancelUndo: noop, onRetry: noop, onDismiss: noop,
};

function state(overrides = {}) {
  return {
    account: ACCOUNT,
    page: 1,
    data: { reconciliations: [OPEN, LATEST, OLD], pagination: { page: 1, total_pages: 1, total_count: 3 } },
    error: null,
    pending: false,
    confirmation: null,
    selfHref: '#/bank/accounts/7',
    canUndo: true,
    ...overrides,
  };
}

function output(overrides) {
  return renderedOutput(StatementsHistoryHelper.render(state(overrides), HANDLERS));
}

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

function element(type, overrides, handlers = HANDLERS) {
  return findAll(StatementsHistoryHelper.render(state(overrides), handlers), (node) => node.type === type)[0];
}

describe('StatementsHistoryHelper', () => {
  it('lists the rows as returned, the open statement on top', () => {
    expect(output().containsInOrder(
      'Statements history', formatDate('2026-04-30'), formatDate('2026-03-31'), formatDate('2026-02-28'),
    )).toBeTrue();
  });

  it('shows a finished row: date, balance, reconciled-on and count', () => {
    expect(output().containsInOrder(
      formatDate('2026-03-31'), formatMoney('300.00', 'BRL'), formatDate('2026-04-02'), '12',
    )).toBeTrue();
  });

  it('shows Open for an unfinished statement', () => {
    expect(output().containsInOrder(formatDate('2026-04-30'), formatMoney('500.00', 'BRL'), 'Open', '2')).toBeTrue();
  });

  it('shows the amount owed, negated, on a debt', () => {
    const page = output({
      account: { ...ACCOUNT, type: 'debt' },
      data: { reconciliations: [{ ...LATEST, statement_balance: '-300.00' }], pagination: { total_pages: 1 } },
    });

    expect(page.containsInOrder('Amount owed', formatMoney('300.00', 'BRL'))).toBeTrue();
  });

  it('shows Undo only on the undoable statement', () => {
    const buttons = findAll(
      StatementsHistoryHelper.render(state(), HANDLERS),
      (node) => node.props?.children === 'Undo',
    );

    expect(buttons.length).toBe(1);
  });

  it('hides Undo for a role that may not undo, even on the undoable statement', () => {
    const page = output({ canUndo: false });

    expect(page.contains('>Undo<')).toBeFalse();
    expect(page.contains('aria-label="Actions"')).toBeFalse();
  });

  it('calls onUndo with the row', () => {
    const onUndo = jasmine.createSpy('onUndo');
    const [button] = findAll(
      StatementsHistoryHelper.render(state(), { ...HANDLERS, onUndo }),
      (node) => node.props?.children === 'Undo',
    );

    button.props.onClick();

    expect(onUndo).toHaveBeenCalledWith(LATEST);
  });

  it('disables Undo while pending', () => {
    const [button] = findAll(
      StatementsHistoryHelper.render(state({ pending: true }), HANDLERS),
      (node) => node.props?.children === 'Undo',
    );

    expect(button.props.disabled).toBeTrue();
  });

  it('shows the empty state', () => {
    expect(output({ data: { reconciliations: [], pagination: { total_pages: 0 } } }).contains(EMPTY_STATEMENTS_TEXT)).toBeTrue();
  });

  it('shows the loading notice, or nothing after a failed load', () => {
    expect(output({ data: null }).contains('Loading')).toBeTrue();
    expect(output({ data: null, error: { kind: 'transient', message: 'Down', messages: [] } }).contains('Loading')).toBeFalse();
  });

  it('renders the error', () => {
    expect(output({ error: { kind: 'conflict', message: 'Boom', messages: ['Boom'] } }).contains('Boom')).toBeTrue();
  });

  it('paginates, linking to the page itself and intercepting clicks', () => {
    const pagination = element(BankPagination, {
      data: { reconciliations: [OPEN], pagination: { total_pages: 3 } },
    });

    expect(pagination.props.totalPages).toBe(3);
    expect(pagination.props.hrefFor(2)).toBe('#/bank/accounts/7');
    expect(pagination.props.onNavigate).toBe(HANDLERS.onNavigate);
  });

  it('opens the confirmation for the selected row, wired to the handlers', () => {
    const confirm = element(UndoReconciliationConfirm, { confirmation: LATEST, pending: true });

    expect(confirm.props.show).toBeTrue();
    expect(confirm.props.pending).toBeTrue();
    expect(confirm.props.onConfirm).toBe(HANDLERS.onConfirmUndo);
    expect(confirm.props.onCancel).toBe(HANDLERS.onCancelUndo);
  });

  it('keeps the confirmation closed without a selected row', () => {
    expect(element(UndoReconciliationConfirm, {}).props.show).toBeFalse();
  });

  it('escapes the values', () => {
    const page = output({
      data: { reconciliations: [{ ...OPEN, transaction_count: '<b>x</b>' }], pagination: { total_pages: 1 } },
    });

    expect(page.contains('<b>x</b>')).toBeFalse();
  });
});
