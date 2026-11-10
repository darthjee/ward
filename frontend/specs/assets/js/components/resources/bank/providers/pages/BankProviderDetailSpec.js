import React from 'react';
import BankProviderDetail from '../../../../../../../../assets/js/components/resources/bank/providers/pages/BankProviderDetail.jsx';
import BankProviderDetailHelper from '../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx';
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
    React.createElement(BankProviderDetail),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankProviderDetailHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankProviderDetail', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state with a link back to the Providers list', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/providers')).toBeTrue();
  });

  it('reads the provider id and the page from the hash under an organization', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/providers/3?page=2' } });

    const { state } = capture(inContext(ORG));

    expect(state).toEqual(jasmine.objectContaining({
      context: ORG, accountId: '3', page: 2, data: null, error: null, actionPending: null, confirmation: null,
    }));
    expect(state.form.editing).toBeNull();
    expect(state.markUnsentPending).toBeFalse();
  });

  it('passes the shortcut and Mark as unsent handlers with the detail handlers', () => {
    installFakeWindow({ location: { hash: '#/bank/providers/3' } });

    const { handlers } = capture(inContext());

    expect(Object.keys(handlers)).toEqual(jasmine.arrayContaining([
      'onStartNew', 'onSubmit', 'onEdit', 'onArchive', 'onConfirm',
      'onMarkUnsent',
    ]));
    expect(() => handlers.onStartNew({ direction: 'out', description: 'Charge', amount: '' })).not.toThrow();
  });
});
