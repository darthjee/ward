import React from 'react';
import BillHistory from '../../../../../../../../assets/js/components/resources/bank/common/bills/BillHistory.jsx';
import BillHistoryHelper from '../../../../../../../../assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BillHistory', () => {
  it('renders the helper with the account, the source type and its own state', () => {
    spyOn(BillHistoryHelper, 'render').and.returnValue(React.createElement('div', null, 'history'));
    const account = { id: 7, currency: 'BRL' };

    const page = renderedOutput(React.createElement(BillHistory, {
      context: { kind: 'personal' }, account, sourceType: 'debt', onUndone: () => undefined,
    }));

    expect(page.contains('history')).toBeTrue();
    expect(BillHistoryHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({
        account, sourceType: 'debt', page: 1, data: null,
      }),
      jasmine.objectContaining({ onUndo: jasmine.any(Function), onNavigate: jasmine.any(Function) }),
    );
  });

  ['owner', 'admin', 'user'].forEach((role) => {
    it(`passes the undo permission of a ${role}`, () => {
      spyOn(BillHistoryHelper, 'render').and.returnValue(React.createElement('div'));

      renderedOutput(React.createElement(
        OwnerContext.Provider,
        { value: { ...DEFAULT_OWNER_CONTEXT, role } },
        React.createElement(BillHistory, {
          context: { kind: 'organization', orgId: 5 }, account: { id: 7, currency: 'BRL' }, sourceType: 'debt',
        }),
      ));

      expect(BillHistoryHelper.render.calls.mostRecent().args[0].canUndo).toBe(role !== 'user');
    });
  });

  it('renders the loading Bill history', () => {
    const page = renderedOutput(React.createElement(BillHistory, {
      context: { kind: 'personal' }, account: { id: 7, currency: 'BRL', archived_at: null }, sourceType: 'debt',
    }));

    expect(page.containsInOrder('Bill history', 'Loading')).toBeTrue();
  });

  it('renders the loading history of one provider bill', () => {
    const page = renderedOutput(React.createElement(BillHistory, {
      context: { kind: 'personal' }, account: { id: 7, currency: 'BRL', archived_at: null }, sourceType: 'provider_expense', billId: 12,
    }));

    expect(page.containsInOrder('Bill history', 'Loading')).toBeTrue();
  });
});
