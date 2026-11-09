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
const HANDLERS = new Proxy({}, { get: () => noop });

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
    ...overrides,
  };
}

describe('AccountDetailHelper', () => {
  let options;

  beforeEach(() => {
    options = {
      base: '/bank/things',
      backLabel: 'Things',
      renderHeader: jasmine.createSpy('renderHeader').and.returnValue(React.createElement('h1', null, 'HEADER')),
    };
  });

  it('links back to the section list with its label', () => {
    expect(renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options))
      .containsInOrder('href="#/bank/things"', '← Things')).toBeTrue();
  });

  it('renders the section header with the has-transactions signal', () => {
    renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options));

    expect(options.renderHeader).toHaveBeenCalledWith({
      account: ACCOUNT, hasTransactions: false, actionPending: null, context: { kind: 'personal' },
    }, HANDLERS);
  });

  it('renders the shortcuts slot between the Ledger heading and the inline form', () => {
    const renderShortcuts = jasmine.createSpy('renderShortcuts').and.returnValue(React.createElement('p', null, 'SHORTCUTS'));
    const pageState = state({ extra: 'X' });
    const page = renderedOutput(AccountDetailHelper.render(pageState, HANDLERS, { ...options, renderShortcuts }));

    expect(page.containsInOrder('HEADER', 'Ledger', 'SHORTCUTS', 'New transaction')).toBeTrue();
    expect(renderShortcuts).toHaveBeenCalledWith(ACCOUNT, HANDLERS, pageState);
  });

  it('renders without shortcuts', () => {
    expect(renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options)).containsInOrder('Ledger', 'New transaction'))
      .toBeTrue();
  });

  describe('per-row slot', () => {
    const ROW = {
      id: 7, date: '2026-05-02', amount: '-1.00', description: 'Charge', notes: null, balance: '0.00',
    };
    const WITH_ROW = { account: ACCOUNT, ledger: { ...LEDGER, transactions: [ROW] } };

    it('passes the transaction, the handlers and the page state', () => {
      const renderRowExtra = jasmine.createSpy('renderRowExtra').and.returnValue('ROW EXTRA');
      const pageState = state({ data: WITH_ROW });
      const page = renderedOutput(AccountDetailHelper.render(pageState, HANDLERS, { ...options, renderRowExtra }));

      expect(page.containsInOrder('Charge', 'ROW EXTRA')).toBeTrue();
      expect(renderRowExtra).toHaveBeenCalledWith(ROW, HANDLERS, pageState);
    });

    it('still renders on an archived account', () => {
      const archived = { ...WITH_ROW, account: { ...ACCOUNT, archived_at: '2026-01-01T00:00:00Z' } };
      const page = renderedOutput(AccountDetailHelper.render(state({ data: archived }), HANDLERS, {
        ...options, renderRowExtra: () => 'ROW EXTRA',
      }));

      expect(page.contains('ROW EXTRA')).toBeTrue();
    });
  });

  describe('confirmation kinds', () => {
    function confirmModal(confirmation, overrides = {}) {
      const element = AccountDetailHelper.render(state({ confirmation, ...overrides }), HANDLERS, options);
      const found = [];
      const walk = (node) => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }

        if (!node || typeof node !== 'object') {
          return;
        }

        if (node.props?.onConfirm && node.props?.title) {
          found.push(node);
        }

        walk(node.props?.children);
      };

      walk(element);
      return found[0].props;
    }

    it('confirms an account delete', () => {
      const props = confirmModal({ kind: 'account' });

      expect(props.title).toEqual('Delete account');
      expect(props.confirmLabel).toEqual('Delete');
      expect(props.children).toContain('Delete this account?');
    });

    it('confirms a transaction delete', () => {
      const props = confirmModal({ kind: 'transaction', transaction: { id: 1, description: 'Coffee' } });

      expect(props.title).toEqual('Delete transaction');
      expect(props.children).toContain('Coffee');
      expect(props.children).not.toContain('already sent to the accountant');
    });

    it('adds the warning to the delete of a sent charge', () => {
      const props = confirmModal({
        kind: 'transaction', transaction: { id: 1, description: 'Rent', sent_to_accountant_at: '2026-05-01T00:00:00Z' },
      });

      expect(props.children).toContain('Rent');
      expect(props.children).toContain('This charge was already sent to the accountant');
    });

    it('confirms saving a sent charge, pending while the form saves', () => {
      const form = { ...initialLedgerForm('2026-05-10'), pending: true };
      const props = confirmModal({ kind: 'sentEdit' }, { form });

      expect(props.confirmLabel).toEqual('Save');
      expect(props.children).toContain('This charge was already sent to the accountant');
      expect(props.pending).toBeTrue();
    });

    it('is pending while a delete runs', () => {
      expect(confirmModal({ kind: 'account' }, { actionPending: 'delete' }).pending).toBeTrue();
      expect(confirmModal({ kind: 'account' }).pending).toBeFalse();
    });

    it('is closed without a confirmation', () => {
      const props = confirmModal(null);

      expect(props.show).toBeFalse();
      expect(props.children).toBeNull();
    });
  });

  it('links the empty page back to page 1 under the section base', () => {
    const page = renderedOutput(AccountDetailHelper.render(state({
      page: 3, data: { account: ACCOUNT, ledger: { ...LEDGER, opening: null } },
    }), HANDLERS, options));

    expect(page.containsAttribute('href', '#/bank/things/3?page=1')).toBeTrue();
  });
});
