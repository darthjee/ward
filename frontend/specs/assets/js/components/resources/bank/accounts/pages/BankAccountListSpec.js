import React from 'react';
import BankAccountList from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountList.jsx';
import BankAccountListHelper from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountListHelper.jsx';
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
    React.createElement(BankAccountList),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankAccountListHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankAccountList', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state in Personal', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.containsElement('h1', 'Accounts')).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/accounts/new')).toBeTrue();
  });

  it('renders under an organization with org links', () => {
    const page = renderedOutput(React.createElement(inContext(ORG)));

    expect(page.containsAttribute('href', '#/orgs/5/bank/accounts/new')).toBeTrue();
  });

  it('hides archived accounts by default', () => {
    expect(capture(inContext()).state.archived).toBeFalse();
  });

  it('reads ?archived=true from the hash', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/accounts?archived=true' } });

    const { state } = capture(inContext(ORG));

    expect(state).toEqual({
      accounts: null, error: null, archived: true, context: ORG,
    });
  });

  it('wires Retry and dismiss', () => {
    const { handlers } = capture(inContext());

    expect(() => handlers.onRetry()).not.toThrow();
    expect(() => handlers.onDismiss()).not.toThrow();
  });
});
