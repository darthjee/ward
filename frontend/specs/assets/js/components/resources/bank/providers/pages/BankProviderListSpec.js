import React from 'react';
import BankProviderList from '../../../../../../../../assets/js/components/resources/bank/providers/pages/BankProviderList.jsx';
import BankProviderListHelper from '../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelper.jsx';
import BankAccountsLoader from '../../../../../../../../assets/js/components/resources/bank/common/list/controllers/BankAccountsLoader.js';
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
    React.createElement(BankProviderList),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankProviderListHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankProviderList', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state in Personal', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.containsElement('h1', 'Providers')).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/providers/new')).toBeTrue();
  });

  it('renders under an organization with org links', () => {
    const page = renderedOutput(React.createElement(inContext(ORG)));

    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/new')).toBeTrue();
  });

  it('reads ?archived=true from the hash', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/providers?archived=true' } });

    expect(capture(inContext(ORG)).state).toEqual({
      accounts: null, error: null, archived: true, context: ORG,
    });
  });

  it('wires Retry and dismiss', () => {
    const { handlers } = capture(inContext());

    expect(() => handlers.onRetry()).not.toThrow();
    expect(() => handlers.onDismiss()).not.toThrow();
  });

  it('asks the loader for provider-expense accounts only', async () => {
    const client = jasmine.createSpyObj('client', ['listAccounts']);
    const callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);

    client.listAccounts.and.resolveTo([]);
    await new BankAccountsLoader(client, { type: 'provider_expense' }).load(ORG, false, callbacks);

    expect(client.listAccounts).toHaveBeenCalledWith(ORG, { archived: false, type: 'provider_expense' });
  });
});
