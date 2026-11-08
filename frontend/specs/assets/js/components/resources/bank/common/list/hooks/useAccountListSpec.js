import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountList from '../../../../../../../../../assets/js/components/resources/bank/common/list/hooks/useAccountList.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

const ORG = { kind: 'organization', orgId: 5 };

function probe(context = DEFAULT_OWNER_CONTEXT.context) {
  let result;
  const Probe = () => {
    result = useAccountList('debt');
    return null;
  };

  renderToStaticMarkup(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(Probe),
  ));

  return result;
}

describe('useAccountList', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts loading in the route context, archived hidden', () => {
    expect(probe(ORG)).toEqual(jasmine.objectContaining({
      context: ORG, accounts: null, error: null, archived: false, notFound: false,
    }));
  });

  it('reads ?archived=true from the hash', () => {
    installFakeWindow({ location: { hash: '#/bank/debts?archived=true' } });

    expect(probe().archived).toBeTrue();
  });

  it('wires Retry and dismiss', () => {
    const { handlers } = probe();

    expect(() => handlers.onRetry()).not.toThrow();
    expect(() => handlers.onDismiss()).not.toThrow();
  });
});
