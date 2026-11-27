import React from 'react';
import StatementsHistory from '../../../../../../../../assets/js/components/resources/bank/common/reconciliation/StatementsHistory.jsx';
import StatementsHistoryHelper from '../../../../../../../../assets/js/components/resources/bank/common/reconciliation/helpers/StatementsHistoryHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('StatementsHistory', () => {
  const ACCOUNT = { id: 7, currency: 'BRL', type: 'regular' };

  it('renders the helper with the account and its own state', () => {
    spyOn(StatementsHistoryHelper, 'render').and.returnValue(React.createElement('div', null, 'history'));

    const page = renderedOutput(React.createElement(StatementsHistory, {
      context: { kind: 'personal' }, account: ACCOUNT, historyVersion: 0, onUndone: () => undefined,
    }));

    expect(page.contains('history')).toBeTrue();
    expect(StatementsHistoryHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({ account: ACCOUNT, page: 1, data: null }),
      jasmine.objectContaining({ onUndo: jasmine.any(Function), onNavigate: jasmine.any(Function) }),
    );
  });

  [['owner', true], ['admin', true], ['user', false]].forEach(([role, expected]) => {
    it(`passes the undo permission of a ${role}`, () => {
      spyOn(StatementsHistoryHelper, 'render').and.returnValue(React.createElement('div'));

      renderedOutput(React.createElement(
        OwnerContext.Provider,
        { value: { ...DEFAULT_OWNER_CONTEXT, role } },
        React.createElement(StatementsHistory, {
          context: { kind: 'organization', orgId: 5 }, account: ACCOUNT, historyVersion: 0,
        }),
      ));

      expect(StatementsHistoryHelper.render.calls.mostRecent().args[0].canUndo).toBe(expected);
    });
  });

  it('renders the loading history', () => {
    const page = renderedOutput(React.createElement(StatementsHistory, {
      context: { kind: 'personal' }, account: ACCOUNT, historyVersion: 0,
    }));

    expect(page.containsInOrder('Statements history', 'Loading')).toBeTrue();
  });
});
