import React from 'react';
import useBillHistoryPage, {
  readBillHistoryId,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/hooks/useBillHistoryPage.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

describe('useBillHistoryPage', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('reads the bill id from the hash, in both contexts', () => {
    expect(readBillHistoryId('#/bank/bills/9/history')).toBe('9');
    expect(readBillHistoryId('#/orgs/5/bank/bills/9/history')).toBe('9');
  });

  it('starts loading', () => {
    installFakeWindow({ location: { hash: '#/bank/bills/9/history' } });
    let result;

    function Probe() {
      result = useBillHistoryPage();
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.notFound).toBeFalse();
    expect(result.state).toEqual({ bill: null, provider: null, loadError: null });
    expect(result.onRetryLoad).toEqual(jasmine.any(Function));
  });
});
