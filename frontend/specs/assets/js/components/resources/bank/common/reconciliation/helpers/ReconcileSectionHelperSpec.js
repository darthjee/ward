import ReconcileSectionHelper from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/helpers/ReconcileSectionHelper.jsx';
import ConfirmModal from '../../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = { id: 7, type: 'regular', currency: 'BRL' };
const ROWS = [{ id: 1 }];
const STATEMENT = {
  id: 4, statement_date: '2026-03-31', statement_balance: '100.00', cleared_balance: '60.00', difference: '40.00',
};

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

describe('ReconcileSectionHelper', () => {
  let handlers;

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', [
      'onFinish', 'onEditStatement', 'onCancel', 'onConfirmCancel', 'onDismissCancel', 'onToggleOnlyUncleared',
      'onTickAll', 'onUntickAll', 'onDismissError', 'onFieldChange', 'onSubmitStatement', 'onCloseForm',
    ]);
  });

  function reconcile(overrides = {}) {
    return {
      mode: 'active',
      statement: STATEMENT,
      formKind: 'start',
      fields: {},
      fieldErrors: {},
      onlyUncleared: false,
      pending: false,
      error: null,
      cancelConfirm: false,
      canWrite: true,
      canCancel: true,
      ...overrides,
    };
  }

  function tree(overrides, account = ACCOUNT) {
    return ReconcileSectionHelper.render({
      account, today: '2026-05-01', rows: ROWS, reconcile: reconcile(overrides),
    }, handlers);
  }

  function output(overrides, account) {
    return renderedOutput(tree(overrides, account));
  }

  function button(overrides, label) {
    return findAll(tree(overrides), (node) => node.props?.children === label)[0];
  }

  it('renders nothing when the mode is off', () => {
    expect(output({ mode: 'off' }).isEmpty()).toBeTrue();
  });

  it('renders nothing without a reconcile state', () => {
    expect(renderedOutput(ReconcileSectionHelper.render({ account: ACCOUNT, rows: ROWS }, handlers)).isEmpty()).toBeTrue();
  });

  it('renders the statement form in form mode', () => {
    const page = output({ mode: 'form', fields: { statement_date: '2026-03-31', statement_balance: '' } });

    expect(page.contains('Start reconciliation')).toBeTrue();
    expect(page.contains('Show only uncleared')).toBeFalse();
  });

  describe('summary bar', () => {
    it('is sticky and shows the four values', () => {
      const page = output();

      expect(page.contains('sticky-top')).toBeTrue();
      expect(page.containsInOrder(
        'Statement date', 'Statement balance', formatMoney('100.00', 'BRL'),
        'Cleared balance', formatMoney('60.00', 'BRL'), 'Difference', formatMoney('40.00', 'BRL'),
      )).toBeTrue();
    });

    it('highlights a non-zero difference', () => {
      expect(output().contains('text-bg-warning')).toBeTrue();
    });

    it('does not highlight a zero difference', () => {
      expect(output({ statement: { ...STATEMENT, difference: '0.00' } }).contains('text-bg-warning')).toBeFalse();
    });

    it('shows the amount owed, negated, on a debt', () => {
      const page = output({ statement: { ...STATEMENT, statement_balance: '-100.00' } }, { ...ACCOUNT, type: 'debt' });

      expect(page.containsInOrder('Amount owed', formatMoney('100.00', 'BRL'))).toBeTrue();
    });
  });

  describe('Finish', () => {
    it('is disabled at a non-zero difference', () => {
      expect(button({}, 'Finish').props.disabled).toBeTrue();
    });

    it('is enabled at 0', () => {
      const finish = button({ statement: { ...STATEMENT, difference: '0.00' } }, 'Finish');

      expect(finish.props.disabled).toBeFalse();
      expect(finish.props.onClick).toBe(handlers.onFinish);
    });

    it('is disabled while a request is in flight', () => {
      expect(button({ statement: { ...STATEMENT, difference: '0.00' }, pending: true }, 'Finish').props.disabled).toBeTrue();
    });
  });

  describe('actions', () => {
    it('wires Edit statement', () => {
      expect(button({}, 'Edit statement').props.onClick).toBe(handlers.onEditStatement);
    });

    it('shows Cancel to a role that may cancel', () => {
      expect(button({}, 'Cancel').props.onClick).toBe(handlers.onCancel);
    });

    it('hides Cancel without the permission', () => {
      expect(button({ canCancel: false }, 'Cancel')).toBeUndefined();
    });

    it('wires the bulk buttons with the page rows', () => {
      button({}, 'Tick all on page').props.onClick();
      button({}, 'Untick all').props.onClick();

      expect(handlers.onTickAll).toHaveBeenCalledWith(ROWS);
      expect(handlers.onUntickAll).toHaveBeenCalledWith(ROWS);
    });

    it('wires Show only uncleared', () => {
      const [checkbox] = findAll(tree({ onlyUncleared: true }), (node) => node.props?.id === 'reconcile-only-uncleared');

      expect(checkbox.props.checked).toBeTrue();
      expect(checkbox.props.onChange).toBe(handlers.onToggleOnlyUncleared);
    });
  });

  describe('Cancel confirmation', () => {
    function modal(overrides) {
      return findAll(tree(overrides), (node) => node.type === ConfirmModal)[0].props;
    }

    it('is closed by default', () => {
      expect(modal({}).show).toBeFalse();
    });

    it('opens with the cancel title and wires confirm and dismiss', () => {
      const props = modal({ cancelConfirm: true });

      expect(props.show).toBeTrue();
      expect(props.title).toBe('Cancel reconciliation');
      expect(props.confirmLabel).toBe('Cancel reconciliation');
      expect(props.onConfirm).toBe(handlers.onConfirmCancel);
      expect(props.onCancel).toBe(handlers.onDismissCancel);
    });
  });

  it('renders the error', () => {
    const error = { kind: 'conflict', code: 'X', message: 'Boom', messages: ['Boom'] };

    expect(output({ error }).contains('Boom')).toBeTrue();
  });
});
