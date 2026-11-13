import React from 'react';
import BillHistory from '../../../../../../../../assets/js/components/resources/bank/common/bills/BillHistory.jsx';
import BillHistoryHelper from '../../../../../../../../assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx';
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

  it('renders the loading Bill history', () => {
    const page = renderedOutput(React.createElement(BillHistory, {
      context: { kind: 'personal' }, account: { id: 7, currency: 'BRL', archived_at: null }, sourceType: 'debt',
    }));

    expect(page.containsInOrder('Bill history', 'Loading')).toBeTrue();
  });
});
