import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountDetail from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

function probe(base, context = DEFAULT_OWNER_CONTEXT.context, role = 'owner') {
  let result;
  const Probe = () => {
    result = useAccountDetail(base);
    return null;
  };

  renderToStaticMarkup(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1, role } },
    React.createElement(Probe),
  ));

  return result;
}

describe('useAccountDetail', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('reads the account id under the given section base', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7?page=4' } });

    const result = probe('/bank/debts', { kind: 'organization', orgId: 5 });

    expect(result.notFound).toBeFalse();
    expect(result.state).toEqual(jasmine.objectContaining({ accountId: '7', page: 4, data: null }));
    expect(result.handlers.onStartNew).toEqual(jasmine.any(Function));
    expect(result.reload).toEqual(jasmine.any(Function));
    expect(result.ledgerForm.form.editing).toBeNull();
    expect(result.ledgerForm.actions.reset).toEqual(jasmine.any(Function));
  });

  it('grants every account permission to an admin', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7' } });

    const { state } = probe('/bank/debts', { kind: 'organization', orgId: 5 }, 'admin');

    expect(state.canManageAccounts).toBeTrue();
    expect(state.canDelete).toBeTrue();
    expect(state.canEditPaymentTransactions).toBeTrue();
  });

  it('lets an owner edit payment-generated transactions', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7' } });

    const { state } = probe('/bank/debts', { kind: 'organization', orgId: 5 }, 'owner');

    expect(state.canEditPaymentTransactions).toBeTrue();
  });

  it('denies managing, deleting and editing payment transactions to a user', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7' } });

    const { state } = probe('/bank/debts', { kind: 'organization', orgId: 5 }, 'user');

    expect(state.canManageAccounts).toBeFalse();
    expect(state.canDelete).toBeFalse();
    expect(state.canEditPaymentTransactions).toBeFalse();
  });
});
