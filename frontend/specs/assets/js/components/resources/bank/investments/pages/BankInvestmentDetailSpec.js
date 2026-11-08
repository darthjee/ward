import React from 'react';
import BankInvestmentDetail from '../../../../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentDetail.jsx';
import BankInvestmentDetailHelper from '../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentDetailHelper.jsx';
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
    React.createElement(BankInvestmentDetail),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankInvestmentDetailHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankInvestmentDetail', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading state with a link back to the Investments list', () => {
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/investments')).toBeTrue();
  });

  it('reads the investment id and the page from the hash under an organization', () => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/investments/3?page=2' } });

    const { state } = capture(inContext(ORG));

    expect(state).toEqual(jasmine.objectContaining({
      context: ORG, accountId: '3', page: 2, data: null, error: null, actionPending: null, confirmation: null,
    }));
    expect(state.form.editing).toBeNull();
    expect(state.updateValue.values.value).toBe('');
  });

  it('passes the shortcut and Update value handlers with the detail handlers', () => {
    installFakeWindow({ location: { hash: '#/bank/investments/3' } });

    const { handlers } = capture(inContext());

    expect(Object.keys(handlers)).toEqual(jasmine.arrayContaining([
      'onStartNew', 'onSubmit', 'onEdit', 'onArchive', 'onConfirm',
      'onUpdateValueChange', 'onUpdateValueSubmit', 'onUpdateValueDismiss',
    ]));
    expect(() => handlers.onStartNew({ direction: 'in', description: 'Application', amount: '' })).not.toThrow();
  });
});
