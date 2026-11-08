import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountDetail from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

function probe(base, context = DEFAULT_OWNER_CONTEXT.context) {
  let result;
  const Probe = () => {
    result = useAccountDetail(base);
    return null;
  };

  renderToStaticMarkup(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
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
  });
});
