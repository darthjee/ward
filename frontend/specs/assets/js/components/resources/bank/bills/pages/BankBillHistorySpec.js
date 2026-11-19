import React from 'react';
import BankBillHistory from '../../../../../../../../assets/js/components/resources/bank/bills/pages/BankBillHistory.jsx';
import BankBillHistoryHelper from '../../../../../../../../assets/js/components/resources/bank/bills/pages/helpers/BankBillHistoryHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

function inContext(context = { kind: 'personal' }) {
  return () => React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(BankBillHistory),
  );
}

describe('BankBillHistory', () => {
  beforeEach(() => {
    installFakeWindow({ location: { hash: '#/orgs/5/bank/bills/9/history' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the loading page through the helper, with the owner context', () => {
    spyOn(BankBillHistoryHelper, 'render').and.returnValue(React.createElement('div', null, 'page'));
    const context = { kind: 'organization', orgId: 5 };

    expect(renderedOutput(React.createElement(inContext(context))).contains('page')).toBeTrue();
    expect(BankBillHistoryHelper.render).toHaveBeenCalledWith(
      { bill: null, provider: null, loadError: null, context },
      { onRetryLoad: jasmine.any(Function) },
    );
  });
});
