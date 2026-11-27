import React from 'react';
import AccountHeaderHelper, {
  ARCHIVED_BANNER,
} from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 7, name: 'Car loan', currency: 'BRL', balance: '-9500.00', archived_at: null,
};
const noop = () => undefined;
const HANDLERS = {
  onArchive: noop, onUnarchive: noop, onDeleteAccount: noop, reconcile: { onReconcile: noop },
};

function output(state = {}, account = {}) {
  return renderedOutput(AccountHeaderHelper.render({
    account: { ...ACCOUNT, ...account },
    hasTransactions: false,
    actionPending: null,
    context: { kind: 'personal' },
    base: '/bank/debts',
    details: React.createElement('p', null, 'Debt info'),
    canManageAccounts: true,
    canDelete: true,
    ...state,
  }, HANDLERS));
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

describe('AccountHeaderHelper', () => {
  describe('permissions', () => {
    it('hides Edit and Archive without the manage-accounts permission', () => {
      const page = output({ canManageAccounts: false });

      expect(page.containsAttribute('href', '#/bank/debts/7/edit')).toBeFalse();
      expect(page.contains('Archive')).toBeFalse();
      expect(page.contains('Delete')).toBeTrue();
    });

    it('hides Rename and Unarchive on an archived account without the permission', () => {
      const page = output({ canManageAccounts: false }, { archived_at: '2026-02-01T00:00:00.000Z' });

      expect(page.contains('Rename')).toBeFalse();
      expect(page.contains('Unarchive')).toBeFalse();
      expect(page.contains(ARCHIVED_BANNER)).toBeTrue();
    });

    it('hides Delete without the delete permission', () => {
      const page = output({ canDelete: false });

      expect(page.contains('Delete')).toBeFalse();
      expect(page.containsAttribute('href', '#/bank/debts/7/edit')).toBeTrue();
      expect(page.contains('Archive')).toBeTrue();
    });

    it('hides every action when the permissions are not given (role not yet known)', () => {
      const page = output({ canManageAccounts: undefined, canDelete: undefined });

      expect(page.containsAttribute('href', '#/bank/debts/7/edit')).toBeFalse();
      expect(page.contains('Archive')).toBeFalse();
      expect(page.contains('Delete')).toBeFalse();
      expect(page.contains('Car loan')).toBeTrue();
    });
  });

  it('renders the name, the balance, then the section details', () => {
    expect(output().containsInOrder('Car loan', formatMoney('-9500.00', 'BRL'), 'Debt info')).toBeTrue();
  });

  describe('last reconciled line', () => {
    const LAST = { statement_date: '2026-03-31', statement_balance: '120.00', reconciled_at: '2026-04-01T10:00:00.000Z' };

    it('renders under the balance, before the details', () => {
      const page = output({}, { last_reconciliation: LAST });

      expect(page.containsInOrder('Balance:', 'Last reconciled:', 'Debt info')).toBeTrue();
    });

    it('is absent when the account was never reconciled', () => {
      expect(output({}, { last_reconciliation: null }).contains('Last reconciled')).toBeFalse();
      expect(output().contains('Last reconciled')).toBeFalse();
    });
  });

  it('links Edit under the given section base, in both contexts', () => {
    expect(output().containsAttribute('href', '#/bank/debts/7/edit')).toBeTrue();
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/debts/7/edit'))
      .toBeTrue();
    expect(output({ base: '/bank/accounts' }).containsAttribute('href', '#/bank/accounts/7/edit')).toBeTrue();
  });

  it('shows the banner, Rename and Unarchive when archived', () => {
    const page = output({}, { archived_at: '2026-02-01T00:00:00.000Z' });

    expect(page.contains(ARCHIVED_BANNER)).toBeTrue();
    expect(page.contains('>Rename<')).toBeTrue();
    expect(page.contains('>Unarchive<')).toBeTrue();
    expect(page.contains('>Delete<')).toBeFalse();
  });

  it('shows Delete only for an active account without transactions', () => {
    expect(output().contains('>Delete<')).toBeTrue();
    expect(output({ hasTransactions: true }).contains('>Delete<')).toBeFalse();
  });

  it('renders without a details block', () => {
    expect(output({ details: null }).contains('Car loan')).toBeTrue();
  });

  it('escapes the name', () => {
    expect(output({}, { name: '<img src=x>' }).containsTag('img')).toBeFalse();
  });

  describe('reconcile button', () => {
    const RECONCILE = { canWrite: true, pending: false };

    function buttons(state, account, handlers = HANDLERS) {
      const tree = AccountHeaderHelper.render({
        account: { ...ACCOUNT, ...account },
        hasTransactions: false,
        actionPending: null,
        context: { kind: 'personal' },
        base: '/bank/debts',
        canManageAccounts: true,
        canDelete: true,
        ...state,
      }, handlers);

      return findAll(tree, (node) => typeof node.props?.children === 'string'
        && ['Reconcile', 'Continue reconciliation'].includes(node.props.children));
    }

    it('shows Reconcile to a role that may write', () => {
      expect(output({ reconcile: RECONCILE }).contains('>Reconcile<')).toBeTrue();
    });

    it('shows Continue reconciliation when a statement is open', () => {
      const page = output({ reconcile: RECONCILE }, { open_reconciliation_id: 4 });

      expect(page.contains('>Continue reconciliation<')).toBeTrue();
      expect(page.contains('>Reconcile<')).toBeFalse();
    });

    it('is hidden when the account is archived', () => {
      expect(output({ reconcile: RECONCILE }, { archived_at: '2026-02-01T00:00:00.000Z' }).contains('Reconcile')).toBeFalse();
    });

    it('is hidden without the write permission', () => {
      expect(output({ reconcile: { ...RECONCILE, canWrite: false } }).contains('Reconcile')).toBeFalse();
    });

    it('is hidden when the reconcile state is not given', () => {
      expect(output().contains('Reconcile')).toBeFalse();
    });

    it('calls the handler on click', () => {
      const onReconcile = jasmine.createSpy('onReconcile');
      const [button] = buttons({ reconcile: RECONCILE }, {}, { ...HANDLERS, reconcile: { onReconcile } });

      button.props.onClick();

      expect(onReconcile).toHaveBeenCalled();
    });
  });
});
