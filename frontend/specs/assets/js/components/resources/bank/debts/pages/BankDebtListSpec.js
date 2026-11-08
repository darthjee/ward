import React from 'react';
import BankDebtList from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtList.jsx';
import BankDebtListHelper from '../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtListHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

const ORG = { kind: 'organization', orgId: 5 };

function inContext(context = DEFAULT_OWNER_CONTEXT.context) {
  return () => React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(BankDebtList),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankDebtListHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankDebtList', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state in Personal', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.containsElement('h1', 'Debts')).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts/new')).toBeTrue();
  });

  it('renders under an organization with org links', () => {
    const page = renderedOutput(React.createElement(inContext(ORG)));

    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/new')).toBeTrue();
  });

  it('reads ?archived=true from the hash', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/debts?archived=true' } });

    expect(capture(inContext(ORG)).state).toEqual({
      accounts: null, error: null, archived: true, context: ORG,
    });
  });

  it('wires Retry and dismiss', () => {
    const { handlers } = capture(inContext());

    expect(() => handlers.onRetry()).not.toThrow();
    expect(() => handlers.onDismiss()).not.toThrow();
  });
});
