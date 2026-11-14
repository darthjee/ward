import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import BillHistoryHelper, {
  EMPTY_HISTORY_TEXT,
} from '../../../../../../../../../assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx';
import UndoPaymentConfirm from '../../../../../../../../../assets/js/components/resources/bank/common/bills/UndoPaymentConfirm.jsx';
import BankPagination from '../../../../../../../../../assets/js/components/resources/bank/common/BankPagination.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PAID = {
  id: 3,
  status: 'paid',
  paid_on: '2026-04-11',
  amount: '120.50',
  paying_account: { id: 1, name: 'Main' },
  due_date: '2026-04-10',
  bill: null,
  off_schedule: false,
};
const SKIPPED = {
  id: 2, status: 'skipped', paid_on: null, amount: null, paying_account: null, due_date: '2026-03-10', bill: null, off_schedule: false,
};
const ONE_OFF = {
  ...PAID, id: 1, due_date: '2026-02-20', bill: { id: 30, description: 'Boiler repair' }, off_schedule: true,
};
const ACCOUNT = { id: 7, currency: 'BRL', archived_at: null };

const noop = () => undefined;
const HANDLERS = {
  onNavigate: noop, onUndo: noop, onConfirmUndo: noop, onCancelUndo: noop, onRetry: noop, onDismiss: noop,
};

function state(overrides = {}) {
  return {
    account: ACCOUNT,
    sourceType: 'provider_expense',
    page: 1,
    data: { payments: [PAID, SKIPPED, ONE_OFF], pagination: { page: 1, total_pages: 1, total_count: 3 } },
    error: null,
    pending: false,
    confirmation: null,
    selfHref: '#/bank/providers/7',
    ...overrides,
  };
}

function output(overrides) {
  return renderedOutput(BillHistoryHelper.render(state(overrides), HANDLERS));
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
  return findAll(BillHistoryHelper.render(state(overrides), handlers), (node) => node.type === type)[0];
}

describe('BillHistoryHelper', () => {
  it('lists the rows as returned (newest due date first)', () => {
    expect(output().containsInOrder('Bill history', formatDate('2026-04-10'), formatDate('2026-03-10'), formatDate('2026-02-20'))).toBeTrue();
  });

  it('shows a paid row: status, due date, paid-on, amount and paying account', () => {
    expect(output().containsInOrder('Paid', formatDate('2026-04-10'), formatDate('2026-04-11'), formatMoney('120.50', 'BRL'), 'Main')).toBeTrue();
  });

  it('shows a skipped row with dashes for the payment fields', () => {
    expect(output({ data: { payments: [SKIPPED], pagination: { total_pages: 1 } } }).containsInOrder(
      'Skipped', formatDate('2026-03-10'), '—', '—', '—',
    )).toBeTrue();
  });

  it('marks off-schedule rows and shows the one-off description', () => {
    const page = output({ data: { payments: [PAID, ONE_OFF], pagination: { total_pages: 1 } } });

    expect(page.containsInOrder(formatDate('2026-04-10'), 'Paid', 'Off-schedule', formatDate('2026-02-20'), 'Boiler repair')).toBeTrue();
    expect(output({ data: { payments: [PAID], pagination: { total_pages: 1 } } }).contains('Off-schedule')).toBeFalse();
  });

  it('shows an Undo button per row', () => {
    expect(output().containsInOrder('Undo', 'Undo', 'Undo')).toBeTrue();
  });

  it('hides Undo while the account is archived', () => {
    const page = output({ account: { ...ACCOUNT, archived_at: '2026-05-01T00:00:00Z' } });

    expect(page.contains('>Undo<')).toBeFalse();
    expect(page.contains('Boiler repair')).toBeTrue();
  });

  it('disables Undo while an undo runs', () => {
    expect(output({ pending: true }).containsInOrder('disabled=""', 'Undo')).toBeTrue();
  });

  it('opens the undo with the row', () => {
    const onUndo = jasmine.createSpy('onUndo');
    const [button] = findAll(
      BillHistoryHelper.render(state(), { ...HANDLERS, onUndo }),
      (node) => node.props?.children === 'Undo',
    );

    button.props.onClick();

    expect(onUndo).toHaveBeenCalledWith(PAID);
  });

  it('shows the empty state', () => {
    expect(output({ data: { payments: [], pagination: { total_pages: 0 } } }).contains(EMPTY_HISTORY_TEXT)).toBeTrue();
  });

  it('shows a loading notice, or nothing besides the alert on a load failure', () => {
    expect(output({ data: null }).contains('Loading')).toBeTrue();

    const failed = output({ data: null, error: { kind: 'transient', message: 'Down', messages: [] } });

    expect(failed.contains('Loading')).toBeFalse();
    expect(failed.contains('Down')).toBeTrue();
  });

  it('shows the error alert', () => {
    expect(output({ error: { kind: 'conflict', message: 'No payment', messages: ['No payment'] } }).contains('No payment')).toBeTrue();
  });

  it('paginates through state, linking to the current page', () => {
    const pagination = element(BankPagination, {
      page: 2, data: { payments: [PAID], pagination: { total_pages: 3 } },
    });

    expect(pagination.props.page).toBe(2);
    expect(pagination.props.totalPages).toBe(3);
    expect(pagination.props.hrefFor(3)).toBe('#/bank/providers/7');
    expect(pagination.props.onNavigate).toBe(HANDLERS.onNavigate);
    expect(output({ data: { payments: [PAID], pagination: { total_pages: 3 } } }).contains('href="#/bank/providers/7"')).toBeTrue();
  });

  describe('the Undo confirmation', () => {
    it('is closed without a selected row', () => {
      const confirm = element(UndoPaymentConfirm);

      expect(confirm.props.show).toBeFalse();
      expect(confirm.props.showChargeWarning).toBeFalse();
      expect(confirm.props.onConfirm).toBe(HANDLERS.onConfirmUndo);
      expect(confirm.props.onCancel).toBe(HANDLERS.onCancelUndo);
    });

    it('warns about a sent charge for a paid provider row', () => {
      expect(element(UndoPaymentConfirm, { confirmation: PAID }).props).toEqual(jasmine.objectContaining({
        show: true, showChargeWarning: true,
      }));
    });

    it('warns about a sent charge for a paid one-off row', () => {
      expect(element(UndoPaymentConfirm, { confirmation: ONE_OFF }).props.showChargeWarning).toBeTrue();
    });

    it('does not warn for a debt row', () => {
      expect(element(UndoPaymentConfirm, { sourceType: 'debt', confirmation: PAID }).props.showChargeWarning).toBeFalse();
    });

    it('does not warn for a skipped row', () => {
      expect(element(UndoPaymentConfirm, { confirmation: SKIPPED }).props.showChargeWarning).toBeFalse();
    });

    it('passes the pending flag', () => {
      expect(element(UndoPaymentConfirm, { confirmation: PAID, pending: true }).props.pending).toBeTrue();
    });
  });

  it('escapes the paying account name and the bill description', () => {
    const page = output({
      data: {
        payments: [{ ...ONE_OFF, paying_account: { id: 1, name: '<b>x</b>' }, bill: { id: 30, description: '<script>x</script>' } }],
        pagination: { total_pages: 1 },
      },
    });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('<b>')).toBeFalse();
    expect(page.contains('&lt;script&gt;')).toBeTrue();
    expect(page.contains('&lt;b&gt;')).toBeTrue();
  });
});
