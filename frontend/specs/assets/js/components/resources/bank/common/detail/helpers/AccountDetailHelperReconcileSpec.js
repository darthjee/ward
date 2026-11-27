import React from 'react';
import AccountDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 3, name: 'Thing', currency: 'BRL', balance: '1.00', archived_at: null,
};
const LEDGER = {
  transactions: [],
  opening: { date: '2026-01-01', amount: '1.00', balance: '1.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 1, total_count: 0,
  },
};
const noop = () => undefined;
const RECONCILE_HANDLERS = new Proxy({}, { get: () => noop });
const HANDLERS = new Proxy({}, { get: (_target, key) => (key === 'reconcile' ? RECONCILE_HANDLERS : noop) });

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
    accountId: '3',
    page: 1,
    data: { account: ACCOUNT, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    canManageAccounts: true,
    canDelete: true,
    canEditPaymentTransactions: true,
    ...overrides,
  };
}

describe('AccountDetailHelper (reconciliation)', () => {
  let options;

  beforeEach(() => {
    options = {
      base: '/bank/things',
      backLabel: 'Things',
      renderHeader: jasmine.createSpy('renderHeader').and.returnValue(React.createElement('h1', null, 'HEADER')),
    };
  });

  describe('reconcile mode', () => {
    const STATEMENT = {
      id: 4, statement_date: '2026-03-31', statement_balance: '10.00', cleared_balance: '10.00', difference: '0.00',
    };
    const RECONCILE = {
      mode: 'active', statement: STATEMENT, ticked: new Map(), onlyUncleared: false, pending: false, error: null,
      cancelConfirm: false, canWrite: true, canCancel: true,
    };

    function render(reconcile, extraOptions = {}) {
      return renderedOutput(AccountDetailHelper.render(state({ reconcile }), HANDLERS, { ...options, ...extraOptions }));
    }

    it('renders the summary bar and the Cleared column in active mode', () => {
      const page = render(RECONCILE);

      expect(page.contains('aria-label="Reconciliation"')).toBeTrue();
      expect(page.contains('Cleared')).toBeTrue();
    });

    it('renders the section after the header slot', () => {
      const page = render(RECONCILE, { renderAfterHeader: () => 'AFTER-HEADER' });

      expect(page.containsInOrder('HEADER', 'AFTER-HEADER', 'Reconciliation')).toBeTrue();
    });

    it('is gone once the mode is off', () => {
      const page = render({ ...RECONCILE, mode: 'off', statement: null });

      expect(page.contains('aria-label="Reconciliation"')).toBeFalse();
      expect(page.contains('Cleared')).toBeFalse();
    });

    it('renders the statement form in form mode, without the checkbox column', () => {
      const page = render({
        ...RECONCILE, mode: 'form', formKind: 'start', fields: { statement_date: '2026-03-31', statement_balance: '' }, fieldErrors: {},
      });

      expect(page.contains('Start reconciliation')).toBeTrue();
      expect(page.contains('>Cleared<')).toBeFalse();
    });

    it('keeps the inline transaction form in active mode', () => {
      expect(render(RECONCILE).contains('id="ledger-description"')).toBeTrue();
    });

    it('passes the reconcile state to the header', () => {
      render(RECONCILE);

      expect(options.renderHeader.calls.mostRecent().args[0].reconcile).toBe(RECONCILE);
    });
  });

  describe('last reconciled header data', () => {
    const LAST = { statement_date: '2026-03-31', statement_balance: '10.00', reconciled_at: '2026-04-01T10:00:00.000Z' };

    it('hands the header the account of the (reloaded) page data, so a finish or an undo refreshes the line', () => {
      const reconciled = { ...ACCOUNT, last_reconciliation: LAST };

      AccountDetailHelper.render(state({ data: { account: reconciled, ledger: LEDGER } }), HANDLERS, options);
      expect(options.renderHeader.calls.mostRecent().args[0].account.last_reconciliation).toBe(LAST);

      AccountDetailHelper.render(state({ data: { account: { ...ACCOUNT, last_reconciliation: null }, ledger: LEDGER } }), HANDLERS, options);
      expect(options.renderHeader.calls.mostRecent().args[0].account.last_reconciliation).toBeNull();
    });

    it('reloads the account after an undo', () => {
      const handlers = {
        reconcile: { onReset: noop }, onRetryLoad: jasmine.createSpy('onRetryLoad'),
      };
      const [history] = findAll(AccountDetailHelper.render(state(), handlers, options), (node) => node.props?.historyVersion !== undefined);

      history.props.onUndone();

      expect(handlers.onRetryLoad).toHaveBeenCalled();
    });
  });

  describe('statements history', () => {
    ['/bank/accounts', '/bank/debts', '/bank/investments', '/bank/providers'].forEach((base) => {
      it(`is rendered after the ledger under ${base}`, () => {
        const page = renderedOutput(AccountDetailHelper.render(
          state(),
          HANDLERS,
          { ...options, base, renderAfterLedger: () => 'AFTER-LEDGER' },
        ));

        expect(page.containsInOrder('Ledger', 'AFTER-LEDGER', 'Statements history')).toBeTrue();
      });
    });

    it('reloads the account and resets the reconcile mode after an undo', () => {
      const handlers = {
        reconcile: { onReset: jasmine.createSpy('onReset') }, onRetryLoad: jasmine.createSpy('onRetryLoad'),
      };
      const tree = AccountDetailHelper.render(state(), handlers, options);
      const [history] = findAll(tree, (node) => node.props?.historyVersion !== undefined);

      history.props.onUndone();

      expect(handlers.reconcile.onReset).toHaveBeenCalled();
      expect(handlers.onRetryLoad).toHaveBeenCalled();
    });

    it('passes the history version of the reconcile state', () => {
      const tree = AccountDetailHelper.render(state({ reconcile: { mode: 'off', historyVersion: 3 } }), HANDLERS, options);
      const [history] = findAll(tree, (node) => node.props?.historyVersion !== undefined);

      expect(history.props.historyVersion).toBe(3);
    });
  });
});
