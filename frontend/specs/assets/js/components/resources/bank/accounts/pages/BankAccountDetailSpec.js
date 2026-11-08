import React from 'react';
import BankAccountDetail from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountDetail.jsx';
import BankAccountDetailHelper from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountDetailHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/BankAccountLoader.js';
import { guardAccountType } from '../../../../../../../../assets/js/components/resources/bank/common/detail/accountTypeGuard.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

const ORG = { kind: 'organization', orgId: 5 };

function inContext(context = DEFAULT_OWNER_CONTEXT.context) {
  return () => React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(BankAccountDetail),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankAccountDetailHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankAccountDetail', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state with a link back to the list', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/accounts')).toBeTrue();
  });

  it('reads the account id and the page from the hash under an organization', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/accounts/12?page=3' } });

    const { state } = capture(inContext(ORG));

    expect(state).toEqual(jasmine.objectContaining({
      context: ORG, accountId: '12', page: 3, data: null, error: null, actionPending: null, confirmation: null,
    }));
    expect(state.form.editing).toBeNull();
  });

  it('falls back to page 1 for an invalid page', () => {
    installFakeWindow({ location: { hash: '#/bank/accounts/12?page=abc' } });

    expect(capture(inContext()).state.page).toBe(1);
  });

  it('passes every handler to the helper', () => {
    installFakeWindow({ location: { hash: '#/bank/accounts/12' } });

    const { handlers } = capture(inContext());

    expect(Object.keys(handlers)).toEqual(jasmine.arrayContaining([
      'onSubmit', 'onEdit', 'onNavigate', 'onArchive', 'onUnarchive', 'onDeleteAccount', 'onDeleteTransaction', 'onConfirm', 'onRetry', 'onRetryLoad',
    ]));
    expect(() => handlers.onDismiss()).not.toThrow();
    expect(() => handlers.onCancelConfirm()).not.toThrow();
  });

  [['Personal', { kind: 'personal' }, ''], ['an organization', ORG, '/orgs/5']].forEach(([label, context, prefix]) => {
    it(`redirects an investment deep-linked under /bank/accounts to the investments detail, in ${label}`, async () => {
      const client = jasmine.createSpyObj('client', ['getAccount', 'listTransactions']);
      const callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
      const navigate = jasmine.createSpy('navigate');

      client.getAccount.and.resolveTo({ id: 3, type: 'investment' });
      client.listTransactions.and.resolveTo({ transactions: [], opening: null, pagination: { total_count: 0, total_pages: 1 } });
      buildBankAccountLoadEffect(new BankAccountLoader(client), context, 3, 1, guardAccountType(
        callbacks,
        { base: '/bank/accounts', context, navigate },
      ))();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(navigate).toHaveBeenCalledWith(`#${prefix}/bank/investments/3`);
      expect(callbacks.onNotFound).not.toHaveBeenCalled();
      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });
  });
});
