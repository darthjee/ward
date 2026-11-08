import React from 'react';
import BankDebtDetail from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtDetail.jsx';
import BankDebtDetailHelper from '../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtDetailHelper.jsx';
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
    React.createElement(BankDebtDetail),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankDebtDetailHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankDebtDetail', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state with a link back to the Debts list', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts')).toBeTrue();
  });

  it('reads the debt id and the page from the hash under an organization', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7?page=2' } });

    const { state } = capture(inContext(ORG));

    expect(state).toEqual(jasmine.objectContaining({
      context: ORG, accountId: '7', page: 2, data: null, error: null, actionPending: null, confirmation: null,
    }));
    expect(state.form.editing).toBeNull();
  });

  it('passes the shortcut handler with the detail handlers', () => {
    installFakeWindow({ location: { hash: '#/bank/debts/7' } });

    const { handlers } = capture(inContext());

    expect(Object.keys(handlers)).toEqual(jasmine.arrayContaining([
      'onStartNew', 'onSubmit', 'onEdit', 'onNavigate', 'onArchive', 'onUnarchive', 'onDeleteAccount', 'onConfirm',
    ]));
    expect(() => handlers.onStartNew({ direction: 'in', description: 'Payment', amount: '' })).not.toThrow();
  });

  [['Personal', { kind: 'personal' }, ''], ['an organization', ORG, '/orgs/5']].forEach(([label, context, prefix]) => {
    it(`redirects an investment deep-linked under /bank/debts to the investments detail, in ${label}`, async () => {
      const client = jasmine.createSpyObj('client', ['getAccount', 'listTransactions']);
      const callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
      const navigate = jasmine.createSpy('navigate');

      client.getAccount.and.resolveTo({ id: 3, type: 'investment' });
      client.listTransactions.and.resolveTo({ transactions: [], opening: null, pagination: { total_count: 0, total_pages: 1 } });
      buildBankAccountLoadEffect(new BankAccountLoader(client), context, 3, 1, guardAccountType(
        callbacks,
        { base: '/bank/debts', context, navigate },
      ))();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(navigate).toHaveBeenCalledWith(`#${prefix}/bank/investments/3`);
      expect(callbacks.onNotFound).not.toHaveBeenCalled();
      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });
  });
});
